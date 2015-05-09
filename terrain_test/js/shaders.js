var Shaders = {
    shaders: {},
    load: function(file) {
        Shaders.shaders[file] = Utils.getURL('shaders/' + file);
    },
    shader: function(file) {
        return Shaders.shaders[file];
    }
};
Shaders.load('cel.vert');
Shaders.load('sky.frag');
Shaders.load('fog.frag');

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
        Shaders.shader('sky.frag'),
        "void main() ",
        "{",
        "vec3 direction = normalize(vWorldPosition - cameraPos);",
        "vec3 color = calcColor(direction);",
        "gl_FragColor.rgb = color;",
        "gl_FragColor.a = 1.0;",
        "}"
    ].join("\n")
};

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

THREE.ShaderLib['mountain'] = {
    uniforms: THREE.UniformsUtils.clone(THREE.ShaderLib['lambert'].uniforms),
    vertexShader: [
        "#define LAMBERT",
        "varying vec3 vLightFront;",
        "uniform vec3 myColor;",
        "varying vec3 vWorldPosition;",
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
        "vec4 worldPos = modelMatrix * vec4( position, 1.0 );",              
        "vWorldPosition = worldPos.xyz;",

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
        Shaders.shader('cel.vert'),
        // document.getElementById('shader').text, //THREE.ShaderChunk[ "lights_lambert_vertex" ],
        THREE.ShaderChunk[ "shadowmap_vertex" ],

        "}"
    ].join("\n"),
    fragmentShader: [
        Shaders.shader('sky.frag'),

        "uniform vec3 diffuse;",
        "uniform vec3 emissive;",
        "uniform float opacity;",
        "varying vec3 vLightFront;",
        "#ifdef DOUBLE_SIDED",
        "   varying vec3 vLightBack;",
        "#endif",
        THREE.ShaderChunk[ "common" ],
        THREE.ShaderChunk[ "color_pars_fragment" ],
        THREE.ShaderChunk[ "map_pars_fragment" ],
        THREE.ShaderChunk[ "alphamap_pars_fragment" ],
        THREE.ShaderChunk[ "lightmap_pars_fragment" ],
        THREE.ShaderChunk[ "envmap_pars_fragment" ],
        THREE.ShaderChunk[ "fog_pars_fragment" ],
        THREE.ShaderChunk[ "shadowmap_pars_fragment" ],
        THREE.ShaderChunk[ "specularmap_pars_fragment" ],
        THREE.ShaderChunk[ "logdepthbuf_pars_fragment" ],

        "void main() {",
        "   vec3 outgoingLight = vec3( 0.0 );", // outgoing light does not have an alpha, the surface does
        "   vec4 diffuseColor = vec4( diffuse, opacity );",
        THREE.ShaderChunk[ "logdepthbuf_fragment" ],
        THREE.ShaderChunk[ "map_fragment" ],
        THREE.ShaderChunk[ "color_fragment" ],
        THREE.ShaderChunk[ "alphamap_fragment" ],
        THREE.ShaderChunk[ "alphatest_fragment" ],
        THREE.ShaderChunk[ "specularmap_fragment" ],

        "   #ifdef DOUBLE_SIDED",

        //"float isFront = float( gl_FrontFacing );",
        //"gl_FragColor.xyz *= isFront * vLightFront + ( 1.0 - isFront ) * vLightBack;",

        "       if ( gl_FrontFacing )",
        "           outgoingLight += diffuseColor.rgb * vLightFront + emissive;",
        "       else",
        "           outgoingLight += diffuseColor.rgb * vLightBack + emissive;",

        "   #else",

        "       outgoingLight += diffuseColor.rgb * vLightFront + emissive;",

        "   #endif",

        THREE.ShaderChunk[ "lightmap_fragment" ],
        THREE.ShaderChunk[ "envmap_fragment" ],
        THREE.ShaderChunk[ "shadowmap_fragment" ],

        THREE.ShaderChunk[ "linear_to_gamma_fragment" ],

        Shaders.shader('fog.frag'),
        //THREE.ShaderChunk[ "fog_fragment" ],

        "   gl_FragColor = vec4( outgoingLight, diffuseColor.a );", // TODO, this should be pre-multiplied to allow for bright highlights on very transparent objects

        "}"
    ].join("\n")
}
THREE.ShaderLib['mountain'].uniforms.luminance =   { type: "f", value:1.13 };
THREE.ShaderLib['mountain'].uniforms.turbidity =   { type: "f", value:4 };
THREE.ShaderLib['mountain'].uniforms.reileigh =    { type: "f", value:2 };
THREE.ShaderLib['mountain'].uniforms.mieCoefficient =  { type: "f", value:0.005 };
THREE.ShaderLib['mountain'].uniforms.mieDirectionalG = { type: "f", value:0.93 };
