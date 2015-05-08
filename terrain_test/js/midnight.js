// Parameters
var Options = {
    seed: Math.random() * 100,
    heightMultiplier: 30,
    worldWidth: 32,
    worldDepth: 32,
    cellSize: 1500,
    cellRange: 4,
    //bgColor: 0xbfd1e5,
    bgColor: 0x111111,
    fastSpeed: 2000,
    slowSpeed: 0,
    lookSpeed: 0.2
};
// End parameters

if (!Detector.webgl) {
    Detector.addGetWebGLMessage();
    document.getElementById('container').innerHTML = "";
}

var stats;
var camera, controls, scene, renderer;
var clock = new THREE.Clock();
var cells = new Utils.PairMap();
var cellX;
var cellZ;
var spheres = [];
var maxDist = Options.cellSize * Options.cellRange;
var frame = 0;
var terrainScene;
var sphereScene;
var sphereOctree;
var score = 0;
var backgroundMusic = null;
var dead = false;
var data;
var light;
var celShader;
var sky;
var startTime = null;

init();
animate();

function start() {
    $("#menu").fadeOut(500, function() {
        controls.movementEnabled = true;
        controls.lookSpeed = Options.lookSpeed;
    });
}

function init() {
    celShader = Utils.getURL("shaders/cel.vs");

    var container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 20000);

    scene = new THREE.Scene();
    //scene.fog = new THREE.FogExp2(Options.bgColor, 0.0004);
    scene.fog = new THREE.Fog(Options.bgColor, maxDist * 3 / 4, maxDist);

    controls = new THREE.FirstPersonControls(camera);
    controls.fastSpeed = Options.fastSpeed;
    controls.slowSpeed = Options.slowSpeed;
    controls.lookSpeed = 0;
    controls.movementEnabled = false;

    terrainScene = new THREE.Object3D();
    scene.add(terrainScene);
    addCell(0, 0);

    // Set starting position
    camera.position.x = 0;
    camera.position.z = 0;
    findGround(camera.position);
    camera.position.y += 200;

    var directionalLight = new THREE.DirectionalLight( 0xffffff, 1.0 );
    directionalLight.position.set( 1, 1, 1 );
    //scene.add( directionalLight );

    light = new THREE.PointLight( 0xffffff, 2, 6000 );
    light.position.set(0,2000,0);
    scene.add(light);

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor(Options.bgColor);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    container.innerHTML = "";

    container.appendChild(renderer.domElement);

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild(stats.domElement);

    window.addEventListener('resize', onWindowResize, false);
    sphereScene = new THREE.Object3D();
    scene.add(sphereScene);
    sphereOctree = new THREE.Octree({
        undeferred: false,
        depthMax: Infinity,
        objectsThreshold: 8,
        overlapPct: 0.15
    });

    backgroundMusic = Sound.play("./sounds/music.mp3");

    var skyGeometry = new THREE.SphereGeometry(maxDist * 2, 32, 32);
    var skyMaterial = new THREE.MeshBasicMaterial({color: 0xff00, side: THREE.BackSide, fog: false});
    sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.position.set(camera.position.x, 0, camera.position.z);
    scene.add(sky);

    // TODO remove once the menu is enabled
    controls.movementEnabled = true;
    controls.lookSpeed = Options.lookSpeed;
}

function findGround(pos) {
    pos.y = -10000;
    var raycaster = new THREE.Raycaster(pos, new THREE.Vector3(0, 1, 0));
    var intersects = raycaster.intersectObject(terrainScene, true);
    if (intersects.length == 0) {
        console.log('no ground found');
    } else {
        pos.y = intersects[0].point.y;
    }
}

function addCell(iOff, jOff) {
    data = generateHeight(Options.worldWidth, Options.worldDepth, iOff, jOff);
    var geometry = new THREE.PlaneBufferGeometry(Options.cellSize, Options.cellSize, Options.worldWidth - 1, Options.worldDepth - 1);
    geometry.applyMatrix(new THREE.Matrix4().makeRotationX(- Math.PI / 2));

    var vertices = geometry.attributes.position.array;

    for (var i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3) {
        vertices[j + 1] = data[i] * Options.heightMultiplier;
    }

    /* David's texture code */
    /*var mountainTexture = THREE.ImageUtils.loadTexture( "js/textures/mountain.jpg" );
    mountainTexture.wrapS = THREE.RepeatWrapping;
    mountainTexture.wrapT = THREE.RepeatWrapping;
    mountainTexture.repeat.set( 4, 4 );*/

    //var texture = new THREE.Texture(mountainTexture);
    var texture = new THREE.Texture(generateTexture(data, Options.worldWidth, Options.worldDepth), THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
    texture.needsUpdate = true;

    geometry.computeVertexNormals();

    var lambertShader = THREE.ShaderLib['lambert'];
    var uniforms = THREE.UniformsUtils.clone(lambertShader.uniforms);
    // TODO figure out wtf is going on here
    uniforms["myColor"] = { type: "c", value: new THREE.Color(0x774400) };
    var material = new THREE.ShaderMaterial({
        defines: {"USE_COLOR": ""},
        uniforms: uniforms,
        vertexColors: THREE.VertexColors,
        vertexShader: [
            "#define LAMBERT",
            "#define USE_COLOR",
            "varying vec3 vLightFront;",
            "uniform vec3 myColor;",
            "#ifdef DOUBLE_SIDED",
            "   varying vec3 vLightBack;",
            "#endif",
            THREE.ShaderChunk[ "common" ],
            THREE.ShaderChunk[ "map_pars_vertex" ],
            THREE.ShaderChunk[ "lightmap_pars_vertex" ],
            THREE.ShaderChunk[ "envmap_pars_vertex" ],
            THREE.ShaderChunk[ "lights_lambert_pars_vertex" ],
            THREE.ShaderChunk[ "color_pars_vertex" ],
            THREE.ShaderChunk[ "morphtarget_pars_vertex" ],
            THREE.ShaderChunk[ "skinning_pars_vertex" ],
            THREE.ShaderChunk[ "shadowmap_pars_vertex" ],
            THREE.ShaderChunk[ "logdepthbuf_pars_vertex" ],
            "void main() {",

                THREE.ShaderChunk[ "map_vertex" ],
                THREE.ShaderChunk[ "lightmap_vertex" ],
                //THREE.ShaderChunk[ "color_vertex" ],
                "vColor.xyz = inputToLinear( myColor.xyz );",

                THREE.ShaderChunk[ "morphnormal_vertex" ],
                THREE.ShaderChunk[ "skinbase_vertex" ],
                THREE.ShaderChunk[ "skinnormal_vertex" ],
                THREE.ShaderChunk[ "defaultnormal_vertex" ],

                THREE.ShaderChunk[ "morphtarget_vertex" ],
                THREE.ShaderChunk[ "skinning_vertex" ],
                THREE.ShaderChunk[ "default_vertex" ],
                THREE.ShaderChunk[ "logdepthbuf_vertex" ],

                THREE.ShaderChunk[ "worldpos_vertex" ],
                THREE.ShaderChunk[ "envmap_vertex" ],
                celShader,
                // document.getElementById('shader').text, //THREE.ShaderChunk[ "lights_lambert_vertex" ],
                THREE.ShaderChunk[ "shadowmap_vertex" ],

            "}"

        ].join("\n"),

        fragmentShader: "#define USE_COLOR\n"+lambertShader.fragmentShader,
        lights:true,
        fog: true
    });
    //var material = new THREE.MeshLambertMaterial({ color: 0x663300 });
    //var material = new THREE.MeshBasicMaterial({ map: texture });
    var mesh = new THREE.Mesh(geometry, material);

    var meshShadow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side:THREE.BackSide, color:0x0 }));
    meshShadow.scale.multiplyScalar(1.003);

    var cell = new THREE.Object3D();
    cell.add(mesh);
    cell.add(meshShadow);
    terrainScene.add(cell);

    cell.translateX(iOff * Options.cellSize);
    cell.translateZ(jOff * Options.cellSize);

    cells.set(iOff, jOff, cell);

    return cell;
}

function removeCell(i, j) {
    var cell = cells.remove(i, j);
    if (cell) {
        terrainScene.remove(cell);
    }
}

function addSphere() {
    var sphere = new THREE.Object3D();

    var geometry = new THREE.SphereGeometry(20, 32, 32);
    var material = new THREE.MeshBasicMaterial({color: 0xffff00});
    var materialOutline = new THREE.MeshBasicMaterial({color: 0x0, side: THREE.BackSide });
    var sphereBody = new THREE.Mesh(geometry, material);
    var sphereOutline = new THREE.Mesh(geometry, materialOutline);
    sphereOutline.scale.multiplyScalar(1.2);
    sphere.add(sphereBody);
    sphere.add(sphereOutline);

    var disk;
    var dir3 = camera.getWorldDirection();
    var dir = new THREE.Vector2(dir3.x, dir3.z);
    do {
        disk = Random.disk(maxDist);
    } while (dir.dot(disk) <= 0);
    var offset = 1000;
    sphere.position.x = camera.position.x + dir.x * offset + disk.x;
    sphere.position.z = camera.position.z + dir.y * offset + disk.y;
    findGround(sphere.position);
    sphere.position.y += 500;
    sphereScene.add(sphere);
    sphereOctree.add(sphere);
    return sphere;
}

function generateHeight(width, height, iOff, jOff) {
    var size = width * height, data = new Uint8Array(size),
        perlin = new ImprovedNoise(), quality = 1;
    var z = Options.seed;
    var iOff = iOff || 0;
    var jOff = jOff || 0;
    var globalOffset = 1e6;
    iOff += globalOffset;
    jOff += globalOffset;

    for (var j = 0; j < 4; j ++) {
        for (var i = 0; i < size; i ++) {
            var x = i % width, y = ~~ (i / width);
            x += iOff * (width - 1);
            y += jOff * (height - 1);
            data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);
        }
        quality *= 5;

    }
    return data;
}

function generateTexture(data, width, height) {
    var canvas, canvasScaled, context, image, imageData,
    level, diff, vector3, sun, shade;

    vector3 = new THREE.Vector3(0, 0, 0);

    sun = new THREE.Vector3(1, 1, 1);
    sun.normalize();

    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    context = canvas.getContext('2d');
    context.fillStyle = '#000';
    context.fillRect(0, 0, width, height);

    image = context.getImageData(0, 0, canvas.width, canvas.height);
    imageData = image.data;

    for (var i = 0, j = 0, l = imageData.length; i < l; i += 4, j ++) {
        xMin = Utils.clamp(j - 2, 0, data.length - 1);
        xMax = Utils.clamp(j + 2, 0, data.length - 1);
        zMin = Utils.clamp(j - width * 2, 0, data.length - 1);
        zMax = Utils.clamp(j + width * 2, 0, data.length - 1);

        vector3.x = data[xMin] - data[xMax];
        vector3.y = 2;
        vector3.z = data[zMin] - data[zMax];
        vector3.normalize();

        shade = vector3.dot(sun);
        shade = Utils.quantize(shade, 0.4);

        imageData[i] = (96 + shade * 128) * (0.5 + data[j] * 0.007);
        imageData[i + 1] = (32 + shade * 96) * (0.5 + data[j] * 0.007);
        imageData[i + 2] = (shade * 96) * (0.5 + data[j] * 0.007);

    }

    context.putImageData(image, 0, 0);

    // Scaled 4x
    canvasScaled = document.createElement('canvas');
    canvasScaled.width = width * 4;
    canvasScaled.height = height * 4;

    context = canvasScaled.getContext('2d');
    context.scale(4, 4);
    context.drawImage(canvas, 0, 0);

    image = context.getImageData(0, 0, canvasScaled.width, canvasScaled.height);
    imageData = image.data;

    for (var i = 0, l = imageData.length; i < l; i += 4) {
        var v = ~~ (Math.random() * 5);

        imageData[i] += v;
        imageData[i + 1] += v;
        imageData[i + 2] += v;
    }

    context.putImageData(image, 0, 0);

    return canvasScaled;
}

function loadCells() {
    function posToCell(p) {
        return Math.floor((p + Options.cellSize / 2) / Options.cellSize);
    }
    var range = Options.cellRange * 2 + 1;
    var off = Options.cellRange;
    var currX = posToCell(camera.position.x);
    var currZ = posToCell(camera.position.z);
    if (currX === cellX && currZ === cellZ) {
        return;
    }
    var xMin = currX - off;
    var xMax = currX + off;
    var zMin = currZ - off;
    var zMax = currZ + off;
    cells.each(function(x, z) {
        if (x < xMin || x > xMax ||
            z < zMin || z > zMax) {
            removeCell(x, z);
        }
    });
    for (var i = xMin; i <= xMax; i++) {
        for (var j = zMin; j <= zMax; j++) {
            if (!cells.get(i, j)) {
                setTimeout(addCell, 0, i, j);
            }
        }
    }
    cellX = currX;
    cellZ = currZ;
}

function checkCollision() {
    var nextPos = camera.position.clone().add(camera.getWorldDirection().clone().normalize().multiplyScalar(50));
    var raycaster = new THREE.Raycaster(nextPos, new THREE.Vector3(0, -1, 0));
    var intersects = raycaster.intersectObject(terrainScene, true);
    if (intersects.length == 0) {
        if (backgroundMusic) Sound.stop(backgroundMusic);
        Sound.play("./sounds/dead.wav");
        $("#dead").fadeIn(100, 'linear'); dead = true;
    }
}

function checkSphereCollision() {
    var results = sphereOctree.search(camera.position, 0, true);
    for (var i = 0; i < results.length; i++) {
        var sphere = results[i].object;
        if (camera.position.distanceTo(sphere.position) < 200) {
            score++;
            $("#score").text(score);
            Sound.play('./sounds/coin.mp3');
            sphereScene.remove(sphere);
            sphereOctree.remove(sphere);
        }
    }
}

function render() {
    controls.update(clock.getDelta());
    if (controls.moving && startTime === null) {
        startTime = clock.getElapsedTime();
    }
    if (startTime !== null) {
        var elapsed = clock.getElapsedTime() - startTime;
        var minutes = Math.floor(elapsed / 60);
        var seconds = Math.floor(elapsed % 60);
        if (seconds < 10) {
            seconds = "0" + seconds;
        }
        $("#time").text(minutes + ":" + seconds);
    }

    renderer.render(scene, camera);
    light.position.set(camera.position.x, camera.position.y, camera.position.z);
    sky.position.set(camera.position.x, camera.position.y, camera.position.z);
    sphereOctree.update();
    loadCells();
    checkCollision();
    checkSphereCollision();
    if (frame % 32 === 0) setTimeout(addSphere, 0);
}

function animate() {
    if (dead) return;
    requestAnimationFrame(animate);

    var texture = new THREE.Texture(generateTexture(data, Options.worldWidth, Options.worldDepth), THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
    frame++;
    render();
    stats.update();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    controls.handleResize();
}
