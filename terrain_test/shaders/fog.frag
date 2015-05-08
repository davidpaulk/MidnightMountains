#ifdef USE_FOG
    vec3 diff = normalize( vWorldPosition - cameraPosition );
    //vec3 diff = normalize(vWorldPosition);
	#ifdef USE_LOGDEPTHBUF_EXT

		float depth = gl_FragDepthEXT / gl_FragCoord.w;

	#else

		float depth = gl_FragCoord.z / gl_FragCoord.w;

	#endif

	#ifdef FOG_EXP2

		float fogFactor = exp2( - square( fogDensity ) * square( depth ) * LOG2 );
		fogFactor = whiteCompliment( fogFactor );

	#else

		float fogFactor = smoothstep( fogNear, fogFar, depth );

	#endif
	
	//outgoingLight = mix( outgoingLight, fogColor, fogFactor );
        vec3 newColor = calcColor(diff);
	//outgoingLight = mix( outgoingLight, abs(diff), fogFactor );
	outgoingLight = mix( outgoingLight, newColor, fogFactor );

#endif
