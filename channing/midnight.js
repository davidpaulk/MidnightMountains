if ( ! Detector.webgl ) {

    Detector.addGetWebGLMessage();
    document.getElementById( 'container' ).innerHTML = "";

}

var container, stats;

var camera, controls, scene, renderer;

var mesh, texture;

var heightMultiplier = 30;
var worldWidth = worldDepth = 32;
var cellSize = 1500;
var cellRange = 9;
/*
   var heightMultiplier = 20;
   var worldWidth = worldDepth = 256;
   var cellSize = 7500;
   var cellRange = 1;
   */

var worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2;

var clock = new THREE.Clock();
var cells = {};
var cellX;
var cellZ;
var seed = Math.random() * 100;
var data, moreData;

init();
animate();

function init() {

    container = document.getElementById( 'container' );

    camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 20000 );

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2( 0xbfd1e5, 0.0004 );
    //scene.fog = new THREE.FogExp2( 0xefd1b5, 0.0005 );
    //scene.fog = new THREE.Fog( 0xbfd1e5, 0, 1000);

    controls = new THREE.FirstPersonControls( camera );
    controls.movementSpeed = 2000;
    controls.lookSpeed = 0.2;

    addCell(0, 0);

    camera.position.x = 0;
    // very negative
    camera.position.y = -10000;
    camera.position.z = 0;

    // find ceiling
    var raycaster = new THREE.Raycaster(camera.position, new THREE.Vector3(0, 1, 0));
    var intersects = raycaster.intersectObject(scene, true);
    if (intersects.length == 0) {
        console.log('wtf');
        camera.position.y = 3000;
    } else {
        camera.position.y = intersects[0].point.y + 200;
    }

    renderer = new THREE.WebGLRenderer();
    renderer.setClearColor( 0xbfd1e5 );
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );

    container.innerHTML = "";

    container.appendChild( renderer.domElement );

    stats = new Stats();
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.top = '0px';
    container.appendChild( stats.domElement );

    //

    window.addEventListener( 'resize', onWindowResize, false );
}

function addCell(iOff, jOff) {
    var data = generateHeight( worldWidth, worldDepth, iOff, jOff);
    var geometry = new THREE.PlaneBufferGeometry( cellSize, cellSize, worldWidth - 1, worldDepth - 1 );
    geometry.applyMatrix( new THREE.Matrix4().makeRotationX( - Math.PI / 2 ) );

    var vertices = geometry.attributes.position.array;

    for ( var i = 0, j = 0, l = vertices.length; i < l; i ++, j += 3 ) {
        vertices[ j + 1 ] = data[ i ] * heightMultiplier;
    }

    texture = new THREE.Texture( generateTexture( data, worldWidth, worldDepth ), THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping );
    texture.needsUpdate = true;

    mesh = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { map: texture } ) );

    var meshShadow = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { map: texture, side:THREE.BackSide, color:0x0 } ) );
    meshShadow.scale.multiplyScalar(1.003);

    var cell = new THREE.Object3D();
    cell.add(mesh);
    cell.add(meshShadow);
    scene.add(cell);

    cell.translateX(iOff * cellSize);
    cell.translateZ(jOff * cellSize);

    cells[[iOff, jOff]] = cell;

    return cell;
}

function removeCell(i, j) {
    var cell = cells[[i, j]];
    if (!cell) {
        return;
    }
    scene.remove(cell);
    delete cells[[i, j]];
}

function addSphere() {
    var geometry = new THREE.SphereGeometry( 5, 320, 320 );
    var material = new THREE.MeshLambertMaterial( {color: 0xffff00} );
    var sphere = new THREE.Mesh( geometry, material );
    sphere.translateY(1000);
    //scene.add( sphere );
}

function onWindowResize() {

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );

    controls.handleResize();

}

function generateHeight( width, height, iOff, jOff ) {
    var size = width * height, data = new Uint8Array( size ),
        perlin = new ImprovedNoise(), quality = 1;
    var z = seed;

    var iOff = iOff || 0;
    var jOff = jOff || 0;
    var globalOffset = 1e6;
    iOff += 1000;
    jOff += 1000;

    for ( var j = 0; j < 4; j ++ ) {
        for ( var i = 0; i < size; i ++ ) {
            var x = i % width, y = ~~ ( i / width );
            x += iOff * (width - 1);
            y += jOff * (height - 1);
            data[ i ] += Math.abs( perlin.noise( x / quality, y / quality, z ) * quality * 1.75 );

        }

        quality *= 5;

    }

    return data;

}

function quantize(val, round) {
    var rem = val % round;
    if (rem < val / 2) {
        return val - rem;
    } else {
        return val + round - rem;
    }
}

function generateTexture( data, width, height ) {

    var canvas, canvasScaled, context, image, imageData,
        level, diff, vector3, sun, shade;

    vector3 = new THREE.Vector3( 0, 0, 0 );

    sun = new THREE.Vector3( 1, 1, 1 );
    sun.normalize();

    canvas = document.createElement( 'canvas' );
    canvas.width = width;
    canvas.height = height;

    context = canvas.getContext( '2d' );
    context.fillStyle = '#000';
    context.fillRect( 0, 0, width, height );

    image = context.getImageData( 0, 0, canvas.width, canvas.height );
    imageData = image.data;

    function clamp(x, min, max) {
        if (x < min) {
            return min;
        } else if (x > max) {
            return max;
        }
        return x;
    }

    for ( var i = 0, j = 0, l = imageData.length; i < l; i += 4, j ++ ) {
        xMin = clamp(j - 2, 0, data.length - 1);
        xMax = clamp(j + 2, 0, data.length - 1);
        zMin = clamp(j - width * 2, 0, data.length - 1);
        zMax = clamp(j + width * 2, 0, data.length - 1);

        vector3.x = data[ xMin ] - data[ xMax ];
        vector3.y = 2;
        vector3.z = data[ zMin ] - data[ zMax ];
        vector3.normalize();

        shade = vector3.dot( sun );
        shade = quantize(shade, 0.4);

        imageData[ i ] = ( 96 + shade * 128 ) * ( 0.5 + data[ j ] * 0.007 );
        imageData[ i + 1 ] = ( 32 + shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
        imageData[ i + 2 ] = ( shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
    }

    context.putImageData( image, 0, 0 );

    // Scaled 4x

    canvasScaled = document.createElement( 'canvas' );
    canvasScaled.width = width * 4;
    canvasScaled.height = height * 4;

    context = canvasScaled.getContext( '2d' );
    context.scale( 4, 4 );
    context.drawImage( canvas, 0, 0 );

    image = context.getImageData( 0, 0, canvasScaled.width, canvasScaled.height );
    imageData = image.data;

    for ( var i = 0, l = imageData.length; i < l; i += 4 ) {

        var v = ~~ ( Math.random() * 5 );

        imageData[ i ] += v;
        imageData[ i + 1 ] += v;
        imageData[ i + 2 ] += v;

    }

    context.putImageData( image, 0, 0 );

    return canvasScaled;

}

//

var dead = false;
function animate() {
    if (dead) return;
    requestAnimationFrame( animate );
    render();
    stats.update();

}

function checkCollision() {
    var nextPos = camera.position.clone().add(camera.getWorldDirection().clone().normalize().multiplyScalar(50));
    var raycaster = new THREE.Raycaster(nextPos, new THREE.Vector3(0, -1, 0));
    var intersects = raycaster.intersectObject(scene, true);
    if (intersects.length == 0) {
        $("#dead").fadeIn(100, 'linear');
        dead = true;
    }
}

function loadCells() {
    function posToCell(p) {
        return Math.floor((p + cellSize / 2) / cellSize);
    }
    var range = cellRange;
    var off = Math.floor(range / 2);
    var currX = posToCell(camera.position.x);
    var currZ = posToCell(camera.position.z);
    if (currX === cellX && currZ === cellZ) {
        return;
    }
    var xMin = currX - off;
    var xMax = currX + off;
    var zMin = currZ - off;
    var zMax = currZ + off;
    for (var key in cells) {
        if (!cells.hasOwnProperty(key)) continue;
        var split = key.split(",");
        var x = parseInt(split[0]);
        var z = parseInt(split[1]);
        if (x < xMin || x > xMax ||
                z < zMin || z > zMax) {
            removeCell(x, z);
        }
    }
    for (var i = xMin; i <= xMax; i++) {
        for (var j = zMin; j <= zMax; j++) {
            if (!cells[[i, j]]) {
                addCell(i, j);
            }
        }
    }
    cellX = currX;
    cellZ = currZ;
}

function render() {
    controls.update( clock.getDelta() );
    renderer.render( scene, camera );
    loadCells();
    checkCollision();
    //window.setTimeout(loadCells, 0);
}
