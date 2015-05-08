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
    slowSpeed: 1000,
    dayLength: 4.,
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
    celShader = Utils.getURL("shaders/cel.vs");

    var container = document.getElementById('container');

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.5, 2000000 );

    scene = new THREE.Scene();
    initSky();
    //scene.fog = new THREE.FogExp2(Options.bgColor, 0.0004);
    // scene.fog = new THREE.Fog(Options.bgColor, maxDist * 3 / 4, maxDist);

    controls = new THREE.FirstPersonControls(camera);
    controls.fastSpeed = Options.fastSpeed;
    controls.slowSpeed = Options.slowSpeed;
    controls.lookSpeed = 0;
    controls.movementEnabled = false;

    /* David's texture code */
    var mountainTexture = THREE.ImageUtils.loadTexture( "js/textures/mountain_2.jpg" );
    mountainMaterial = new THREE.MeshLambertMaterial({ map: mountainTexture });
    mountainMaterial.normalMap = THREE.ImageUtils.loadTexture( "js/textures/mountain_2_normal.jpg" ).rgb;

    terrainScene = new THREE.Object3D();
    scene.add(terrainScene);
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

    //var texture = new THREE.Texture(mountainTexture);
    //var texture = new THREE.Texture(generateTexture(data, Options.worldWidth, Options.worldDepth), THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping);
    //texture.needsUpdate = true;

    geometry.computeVertexNormals();

    var lambertShader = THREE.ShaderLib['lambert'];
    var uniforms = THREE.UniformsUtils.clone(lambertShader.uniforms);
    // TODO figure out wtf is going on here
    uniforms["myColor"] = { type: "c", value: new THREE.Color(0x774400) };
    /*var material = new THREE.ShaderMaterial({
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
    });*/
    //var material = new THREE.MeshLambertMaterial({ color: 0x663300 });
    var mesh = new THREE.Mesh(geometry, mountainMaterial);

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


THREE.ShaderLib['sky'] = {

    uniforms: {

        luminance:   { type: "f", value:1 },
        turbidity:   { type: "f", value:2 },
        reileigh:    { type: "f", value:1 },
        mieCoefficient:  { type: "f", value:0.005 },
        mieDirectionalG: { type: "f", value:0.8 },
        sunPosition:     { type: "v3", value: new THREE.Vector3() }

    },

    vertexShader: [

        "varying vec3 vWorldPosition;",

        "void main() {",

            "vec4 worldPosition = modelMatrix * vec4( position, 1.0 );",
            "vWorldPosition = worldPosition.xyz;",

            "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

        "}",

    ].join("\n"),

    fragmentShader: [

        "uniform sampler2D skySampler;",
        "uniform vec3 sunPosition;",
        "varying vec3 vWorldPosition;",

        "vec3 cameraPos = vec3(0., 0., 0.);",
        "// uniform sampler2D sDiffuse;",
        "// const float turbidity = 10.0; //",
        "// const float reileigh = 2.; //",
        "// const float luminance = 1.0; //",
        "// const float mieCoefficient = 0.005;",
        "// const float mieDirectionalG = 0.8;",

        "uniform float luminance;",
        "uniform float turbidity;",
        "uniform float reileigh;",
        "uniform float mieCoefficient;",
        "uniform float mieDirectionalG;",

        "vec3 sunDirection = normalize(sunPosition);",
        "float reileighCoefficient = reileigh;",

        "// constants for atmospheric scattering",
        "const float e = 2.71828182845904523536028747135266249775724709369995957;",
        "const float pi = 3.141592653589793238462643383279502884197169;",

        "const float n = 1.0003; // refractive index of air",
        "const float N = 2.545E25; // number of molecules per unit volume for air at",
                                "// 288.15K and 1013mb (sea level -45 celsius)",
        "const float pn = 0.035;    // depolatization factor for standard air",

        "// wavelength of used primaries, according to preetham",
        "const vec3 lambda = vec3(680E-9, 550E-9, 450E-9);",

        "// mie stuff",
        "// K coefficient for the primaries",
        "const vec3 K = vec3(0.686, 0.678, 0.666);",
        "const float v = 4.0;",

        "// optical length at zenith for molecules",
        "const float rayleighZenithLength = 8.4E3;",
        "const float mieZenithLength = 1.25E3;",
        "const vec3 up = vec3(0.0, 1.0, 0.0);",

        "const float EE = 1000.0;",
        "const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;",
        "// 66 arc seconds -> degrees, and the cosine of that",

        "// earth shadow hack",
        "const float cutoffAngle = pi/1.95;",
        "const float steepness = 1.5;",


        "vec3 totalRayleigh(vec3 lambda)",
        "{",
            "return (8.0 * pow(pi, 3.0) * pow(pow(n, 2.0) - 1.0, 2.0) * (6.0 + 3.0 * pn)) / (3.0 * N * pow(lambda, vec3(4.0)) * (6.0 - 7.0 * pn));",
        "}",

        // see http://blenderartists.org/forum/showthread.php?321110-Shaders-and-Skybox-madness
        "// A simplied version of the total Reayleigh scattering to works on browsers that use ANGLE",
        "vec3 simplifiedRayleigh()",
        "{",
            "return 0.0005 / vec3(94, 40, 18);",
            // return 0.00054532832366 / (3.0 * 2.545E25 * pow(vec3(680E-9, 550E-9, 450E-9), vec3(4.0)) * 6.245);
        "}",

        "float rayleighPhase(float cosTheta)",
        "{   ",
            "return (3.0 / (16.0*pi)) * (1.0 + pow(cosTheta, 2.0));",
        "// return (1.0 / (3.0*pi)) * (1.0 + pow(cosTheta, 2.0));",
        "// return (3.0 / 4.0) * (1.0 + pow(cosTheta, 2.0));",
        "}",

        "vec3 totalMie(vec3 lambda, vec3 K, float T)",
        "{",
            "float c = (0.2 * T ) * 10E-18;",
            "return 0.434 * c * pi * pow((2.0 * pi) / lambda, vec3(v - 2.0)) * K;",
        "}",

        "float hgPhase(float cosTheta, float g)",
        "{",
            "return (1.0 / (4.0*pi)) * ((1.0 - pow(g, 2.0)) / pow(1.0 - 2.0*g*cosTheta + pow(g, 2.0), 1.5));",
        "}",

        "float sunIntensity(float zenithAngleCos)",
        "{",
            "return EE * max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithAngleCos))/steepness)));",
        "}",

        "// float logLuminance(vec3 c)",
        "// {",
        "//     return log(c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722);",
        "// }",

        "// Filmic ToneMapping http://filmicgames.com/archives/75",
        "float A = 0.15;",
        "float B = 0.50;",
        "float C = 0.10;",
        "float D = 0.20;",
        "float E = 0.02;",
        "float F = 0.30;",
        "float W = 1000.0;",

        "vec3 Uncharted2Tonemap(vec3 x)",
        "{",
           "return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;",
        "}",


        "void main() ",
        "{",
            "float sunfade = 1.0-clamp(1.0-exp((sunPosition.y/450000.0)),0.0,1.0);",

            "// luminance =  1.0 ;// vWorldPosition.y / 450000. + 0.5; //sunPosition.y / 450000. * 1. + 0.5;",

             "// gl_FragColor = vec4(sunfade, sunfade, sunfade, 1.0);",

            "reileighCoefficient = reileighCoefficient - (1.0* (1.0-sunfade));",

            "float sunE = sunIntensity(dot(sunDirection, up));",

            "// extinction (absorbtion + out scattering) ",
            "// rayleigh coefficients",

            // "vec3 betaR = totalRayleigh(lambda) * reileighCoefficient;",
            "vec3 betaR = simplifiedRayleigh() * reileighCoefficient;",

            "// mie coefficients",
            "vec3 betaM = totalMie(lambda, K, turbidity) * mieCoefficient;",

            "// optical length",
            "// cutoff angle at 90 to avoid singularity in next formula.",
            "float zenithAngle = acos(max(0.0, dot(up, normalize(vWorldPosition - cameraPos))));",
            "float sR = rayleighZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));",
            "float sM = mieZenithLength / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));",



            "// combined extinction factor  ",
            "vec3 Fex = exp(-(betaR * sR + betaM * sM));",

            "// in scattering",
            "float cosTheta = dot(normalize(vWorldPosition - cameraPos), sunDirection);",

            "float rPhase = rayleighPhase(cosTheta*0.5+0.5);",
            "vec3 betaRTheta = betaR * rPhase;",

            "float mPhase = hgPhase(cosTheta, mieDirectionalG);",
            "vec3 betaMTheta = betaM * mPhase;",


            "vec3 Lin = pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex),vec3(1.5));",
            "Lin *= mix(vec3(1.0),pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fex,vec3(1.0/2.0)),clamp(pow(1.0-dot(up, sunDirection),5.0),0.0,1.0));",

            "//nightsky",
            "vec3 direction = normalize(vWorldPosition - cameraPos);",
            "float theta = acos(direction.y); // elevation --> y-axis, [-pi/2, pi/2]",
            "float phi = atan(direction.z, direction.x); // azimuth --> x-axis [-pi/2, pi/2]",
            "vec2 uv = vec2(phi, theta) / vec2(2.0*pi, pi) + vec2(0.5, 0.0);",
            "// vec3 L0 = texture2D(skySampler, uv).rgb+0.1 * Fex;",
            "vec3 L0 = vec3(0.1) * Fex;",

            "// composition + solar disc",
            "//if (cosTheta > sunAngularDiameterCos)",
            "float sundisk = smoothstep(sunAngularDiameterCos,sunAngularDiameterCos+0.00002,cosTheta);",
            "// if (normalize(vWorldPosition - cameraPos).y>0.0)",
            "L0 += (sunE * 19000.0 * Fex)*sundisk;",


            "vec3 whiteScale = 1.0/Uncharted2Tonemap(vec3(W));",

            "vec3 texColor = (Lin+L0);   ",
            "texColor *= 0.04 ;",
            "texColor += vec3(0.0,0.001,0.0025)*0.3;",

            "float g_fMaxLuminance = 1.0;",
            "float fLumScaled = 0.1 / luminance;     ",
            "float fLumCompressed = (fLumScaled * (1.0 + (fLumScaled / (g_fMaxLuminance * g_fMaxLuminance)))) / (1.0 + fLumScaled); ",

            "float ExposureBias = fLumCompressed;",

            "vec3 curr = Uncharted2Tonemap((log2(2.0/pow(luminance,4.0)))*texColor);",
            "vec3 color = curr*whiteScale;",

            "vec3 retColor = pow(color,vec3(1.0/(1.2+(1.2*sunfade))));",


            "gl_FragColor.rgb = retColor;",

            "gl_FragColor.a = 1.0;",
        "}",

    ].join("\n")

};

var container, stats;

            var camera, controls, scene, renderer;

            var sky, sunSphere;

THREE.Sky = function () {

    var skyShader = THREE.ShaderLib[ "sky" ];
    var skyUniforms = THREE.UniformsUtils.clone( skyShader.uniforms );

    var skyMat = new THREE.ShaderMaterial( {
        fragmentShader: skyShader.fragmentShader,
        vertexShader: skyShader.vertexShader,
        uniforms: skyUniforms,
        side: THREE.BackSide
    } );

    var skyGeo = new THREE.SphereGeometry( 450000, 32, 15 );
    var skyMesh = new THREE.Mesh( skyGeo, skyMat );


    // Expose variables
    this.mesh = skyMesh;
    this.uniforms = skyUniforms;

};

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
    var a = 10.0;
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
            return;
            return;
        }
        sunlight.intensity = .5 * Math.sin(time/a)
        sunSphere.position.x = 0;
        sunSphere.position.y = Math.sin(time/a);
        sunSphere.position.z = Math.cos(time/a);
        sunlight.position.set(0, Math.sin(time/a), Math.cos(time/a));
        sky.uniforms.sunPosition.value.copy(sunSphere.position);
    }
}
