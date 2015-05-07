// This provides a suite of random functions for convenience.
var Random = {
    // Generate a point in a 2d disk.
    disk: function(radius, center) {
        var pos;
        do {
            pos = new THREE.Vector2(1 - 2 * Math.random(), 1 - 2 * Math.random());
        } while (pos.length() > 1.0); 
        if (radius) pos.multiplyScalar(radius);
        if (center) pos.add(center);
        return pos;
    },

    // Generate a point in a 3d ball.
    ball: function(radius, center) {
        var pos;
        do {
            pos = new THREE.Vector3(1.0 - 2.0 * Math.random(),
                    1.0 - 2.0 * Math.random(),
                    1.0 - 2.0 * Math.random());
        } while (pos.length() > 1.0);
        if (radius) pos.multiplyScalar(radius);
        if (center) pos.add(center);
        return pos;
    },

    // Generate a point on the surface of a 3d sphere.
    sphere: function(radius, center) {
        var pos = Random.ball().normalize();
        if (radius) pos.multiplyScalar(radius);
        if (center) pos.add(center);
        return pos;
    }
};


