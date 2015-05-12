vLightFront = vec3( 0.0 );

transformedNormal = normalize( transformedNormal );
float quantization = 3.;

#if MAX_DIR_LIGHTS > 0

for( int i = 0; i < MAX_DIR_LIGHTS; i ++ ) {

    vec3 dirVector = transformDirection( directionalLightDirection[ i ], viewMatrix );

    float dotProduct = dot( transformedNormal, dirVector );
    if (dotProduct < 0.2) dotProduct = 0.;
    else if (dotProduct < 0.6) dotProduct = 0.4;
    else dotProduct = 0.8;
    /*
    dotProduct = dotProduct * quantization;
    dotProduct = floor(dotProduct + 0.5);
    dotProduct = dotProduct / quantization;
    */
    vec3 directionalLightWeighting = vec3( max( dotProduct, 0.0 ) );

    #ifdef WRAP_AROUND

        vec3 directionalLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );
        directionalLightWeighting = mix( directionalLightWeighting, directionalLightWeightingHalf, wrapRGB );

    #endif

    vLightFront += directionalLightColor[ i ] * directionalLightWeighting;

}

#endif

#if MAX_POINT_LIGHTS > 0

    for( int i = 0; i < MAX_POINT_LIGHTS; i ++ ) {

        vec4 lPosition = viewMatrix * vec4( pointLightPosition[ i ], 1.0 );
        vec3 lVector = lPosition.xyz - mvPosition.xyz;

        float attenuation = calcLightAttenuation( length( lVector ), pointLightDistance[ i ], pointLightDecay[ i ] );

        lVector = normalize( lVector );
        float dotProduct = dot( transformedNormal, lVector );
        /*
        dotProduct = dotProduct * quantization;
        dotProduct = floor(dotProduct + 0.5);
        dotProduct = dotProduct / quantization;
        */
    if (dotProduct < 0.2) dotProduct = 0.;
    else if (dotProduct < 0.6) dotProduct = 0.4;
    else dotProduct = 0.8;

        vec3 pointLightWeighting = vec3( max( dotProduct, 0.0 ) );

        #ifdef WRAP_AROUND

            vec3 pointLightWeightingHalf = vec3( max( 0.5 * dotProduct + 0.5, 0.0 ) );
            pointLightWeighting = mix( pointLightWeighting, pointLightWeightingHalf, wrapRGB );


        #endif

        vLightFront += pointLightColor[ i ] * pointLightWeighting * attenuation;


    }

#endif

vLightFront += ambientLightColor;

