// Parameters
var Options = {
    seed: Math.random() * 150,
    heightMultiplier: 30,
    worldWidth: 32,
    worldDepth: 32,
    cellSize: 1500,
    cellRange: 8,
    //bgColor: 0xbfd1e5,
    bgColor: 0x111111,
    fastSpeed: 2000,
    slowSpeed: 0,
    dayLength: 2.,
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
var dayclock = new THREE.Clock();
var cells = new Utils.PairMap();
var cellX;
var cellZ;
var spheres = [];
var maxDist = Options.cellSize * Options.cellRange;
var frame = 0;
var terrainScene;
var sphereScene;
var sphereOctree;
var starScene;
var starMaterial;
var score = 0;
var backgroundMusic = null;
var dead = false;
var data;
var light;
var celShader;
var startTime = null;
var sunlight = new THREE.DirectionalLight( 0xffffff, 1.5 );
var sky;
var sunSphere;
var originalpos = new THREE.Vector3(0, 0, 0);
var uniforms;
var day = true;
var mountainUniforms;
var mountainMaterial;
init();
animate();

function start() {
    $("#menu").fadeOut(500, function() {
        controls.movementEnabled = true;
        controls.lookSpeed = Options.lookSpeed;
    });
}

function init() {
    var container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.5, 2000000 );

    scene = new THREE.Scene();
    initSky();
    //scene.fog = new THREE.FogExp2(Options.bgColor, 0.0004);
    scene.fog = new THREE.Fog(Options.bgColor, maxDist * 3 / 4, maxDist);

    controls = new THREE.FirstPersonControls(camera);
    controls.fastSpeed = Options.fastSpeed;
    controls.slowSpeed = Options.slowSpeed;
    controls.lookSpeed = 0;
    controls.movementEnabled = false;

    /* David's texture code */
    var mountainTexture = THREE.ImageUtils.loadTexture( "js/textures/mountain_2.jpg" );
    //mountainMaterial = new THREE.MeshLambertMaterial({ map: mountainTexture });
    //mountainMaterial.normalMap = THREE.ImageUtils.loadTexture( "js/textures/mountain_2_normal.jpg" ).rgb;

    terrainScene = new THREE.Object3D();
    scene.add(terrainScene);

    var shader = THREE.ShaderLib['mountain'];
    mountainUniforms = THREE.UniformsUtils.clone(shader.uniforms);
    mountainUniforms.sunPosition = { type: "v3", value: sunSphere.position.clone() };
    mountainUniforms.myColor = { type: "c", value: new THREE.Color(0x774400) };
    mountainUniforms.isDay.value = day ? 1 : 0;
    mountainMaterial = new THREE.ShaderMaterial({
        defines: {
            //USE_MAP: true
        },
        //map: mountainTexture,
        uniforms: mountainUniforms,
        vertexColors: THREE.VertexColors,
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        lights:true,
        fog: true
    });
    addCell(0, 0);

    // Set starting position
    camera.position.x = 0;
    camera.position.z = 0;
    findGround(camera.position);
    camera.position.y = 4000;

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
    
    starScene = new THREE.Object3D();
    starMaterial = new THREE.MeshBasicMaterial({color: 0xffffff});
    for (var i = 0; i < 100; i++) {
        var pos = Random.sphere(10000);
        if (pos.y < 0) {
            pos.setY(-pos.y);
        }
        var geometry = new THREE.SphereGeometry(5 + Math.random() * 10, 8, 8);
        var sphereBody = new THREE.Mesh(geometry, starMaterial);
        sphereBody.position.copy(pos);
        starScene.add(sphereBody);
    }
    scene.add(starScene);

    backgroundMusic = Sound.play("./sounds/music.mp3");

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

    geometry.computeVertexNormals();


    //var material = new THREE.MeshLambertMaterial({ color: 0x663300 });
    var mesh = new THREE.Mesh(geometry, mountainMaterial);
    //var mesh = new THREE.Mesh(geometry, material);

    var meshShadow = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side:THREE.BackSide, color:0x0 }));
    meshShadow.scale.multiplyScalar(1.003);

    var cell = new THREE.Object3D();
    cell.add(mesh);
    //cell.add(meshShadow);
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
    var material = new THREE.MeshPhongMaterial({color: 0xffff00});
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

function updateStars() {
    var day = Options.dayLength;
    var time = (clock.getElapsedTime() / day / Math.PI) % 2
    if (time < 1) {
        starScene.visible = false;
    } else if (1. < time && time < 1.1) {
        var b = (time - 1.) / 0.1;
        starScene.visible = true;
        starMaterial.color.setRGB(b, b, b);
    } else if (1.9 < time && time < 2.) {
        var b = 1. - (time - 1.9) / 0.1;
        starMaterial.color.setRGB(b, b, b);
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
    starScene.position.set(camera.position.x, camera.position.y + 500, camera.position.z);
    sphereOctree.update();
    loadCells();
    checkCollision();
    checkSphereCollision();
    updateSunPosition();
    updateStars();
    //if (frame % 32 === 0) setTimeout(addSphere, 0);
}

function animate() {
    if (dead) return;
    requestAnimationFrame(animate);

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


function initSky(){

    // Add Sky Mesh
    sky = new THREE.Sky();
    scene.add( sky.mesh );


    // Add Sun Helper
    sunSphere = new THREE.Mesh( new THREE.SphereGeometry( 20000, 30, 30 ),
        new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: false }));
    /// GUI

    var effectController  = {
        turbidity: 4,
        reileigh: 2,
        mieCoefficient: 0.005,
        mieDirectionalG: 0.93,
        luminance: 1.13,
        inclination: 0.49, // elevation / inclination
        azimuth: 0.25, // Facing front,
    }

    var distance = 400000;

    uniforms = sky.uniforms;
    uniforms.turbidity.value = effectController.turbidity;
    uniforms.reileigh.value = effectController.reileigh;
    uniforms.luminance.value = effectController.luminance;
    uniforms.mieCoefficient.value = effectController.mieCoefficient;
    uniforms.mieDirectionalG.value = effectController.mieDirectionalG;

    var theta = Math.PI * (effectController.inclination - 0.5);
    var phi = 2 * Math.PI * (effectController.azimuth - 0.5);

    sunSphere.position.x = distance * Math.cos(phi);
    sunSphere.position.y = distance * Math.sin(phi) * Math.sin(theta);
    sunSphere.position.z = distance * Math.sin(phi) * Math.cos(theta);
    sunlight.position.copy(sunSphere.position);
    originalpos.copy(sunSphere.position);
    scene.add(sunlight);

    sunSphere.visible = false;

    sky.uniforms.sunPosition.value.copy(sunSphere.position);
}

function updateSunPosition() {
    var time = dayclock.getElapsedTime();
    var a = Options.dayLength;
    if (day) {
        if (Math.sin(time/a) < 0.0) {
            day = false;
            dayclock = new THREE.Clock();
            sunSphere = new THREE.Mesh( new THREE.SphereGeometry( 10000000000000, 30, 30 ),
                new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: false }));
            var effectController  = {
                turbidity: 1,
                reileigh: 0,
                mieCoefficient: 0.0001,
                mieDirectionalG: 0.99,
                luminance: 1.1,
                inclination: 0.49, // elevation / inclination
                azimuth: 0.25, // Facing front,
            }
            uniforms = sky.uniforms;
            uniforms.turbidity.value = effectController.turbidity;
            uniforms.reileigh.value = effectController.reileigh;
            uniforms.luminance.value = effectController.luminance;
            uniforms.mieCoefficient.value = effectController.mieCoefficient;
            uniforms.mieDirectionalG.value = effectController.mieDirectionalG;
            sunlight.position.copy(originalpos);
            sunlight.intensity = .5 * Math.sin(time/a)
            sky.uniforms.sunPosition.value.copy(sunSphere.position);
            mountainUniforms.isDay.value = 0;
            return;
        }
        sunlight.intensity = 1.6 * Math.sin(time/a);
        sunSphere.position.x = 0;
        sunSphere.position.y = Math.sin(time/a);
        sunSphere.position.z = Math.cos(time/a);
        sunlight.position.set(0, Math.sin(time/a), Math.cos(time/a));
        sky.uniforms.sunPosition.value.copy(sunSphere.position);
    }
    else {
        if (Math.sin(time/a) < 0.0) {
            day = true;
            dayclock = new THREE.Clock();
            sunSphere = new THREE.Mesh( new THREE.SphereGeometry( 20000, 30, 30 ),
                new THREE.MeshBasicMaterial({color: 0xffffff, wireframe: false }));
            var effectController  = {
                turbidity: 4,
                reileigh: 2,
                mieCoefficient: 0.005,
                mieDirectionalG: 0.93,
                luminance: 1.13,
                inclination: 0.49, // elevation / inclination
                azimuth: 0.25, // Facing front,
            }
            uniforms = sky.uniforms;
            uniforms.turbidity.value = effectController.turbidity;
            uniforms.reileigh.value = effectController.reileigh;
            uniforms.luminance.value = effectController.luminance;
            uniforms.mieCoefficient.value = effectController.mieCoefficient;
            uniforms.mieDirectionalG.value = effectController.mieDirectionalG;
            sunlight.position.copy(originalpos);
            sunlight.intensity = 1.6 * Math.sin(time/a)
            sky.uniforms.sunPosition.value.copy(sunSphere.position);
            mountainUniforms.isDay.value = 1;
            return;
        }
        sunlight.intensity = .5 * Math.sin(time/a)
        sunSphere.position.x = 0;
        sunSphere.position.y = Math.sin(time/a);
        sunSphere.position.z = Math.cos(time/a);
        sunlight.position.set(0, Math.sin(time/a), Math.cos(time/a));
        sky.uniforms.sunPosition.value.copy(sunSphere.position);
    }

    mountainUniforms.sunPosition.value = sunSphere.position.clone();;
}
