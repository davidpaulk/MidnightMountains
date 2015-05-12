var Utils = {
    // Round val to the nearest multiple of round.
    quantize: function(val, round) {
        var rem = val % round;
        if (rem < val / 2) {
            return val - rem;
        } else {
            return val + round - rem;
        }
    },

    // Clamp x between min and max.
    clamp: function(x, min, max) {
        if (x < min) {
            return min;
        } else if (x > max) {
            return max;
        }
        return x;
    },
    getURL: function(url){
        return $.ajax({
            type: "GET",
            url: url,
            cache: false,
            async: false
        }).responseText;
    }
}

Utils.PairMap = function() {
    this.map = {};
}
Utils.PairMap.prototype.toKey = function(i, j) {
    return i + "," + j;
}
Utils.PairMap.prototype.fromKey = function(key) {
    var split = key.split(",");
    var i = parseInt(split[0]);
    var j = parseInt(split[1]);
    return [i, j];
}
Utils.PairMap.prototype.set = function(i, j, val) {
    this.map[this.toKey(i, j)] = val;
}
Utils.PairMap.prototype.get = function(i, j, val) {
    var key = this.toKey(i, j);
    if (!this.map[key]) return null;
    return this.map[key];
}
Utils.PairMap.prototype.remove = function(i, j, val) {
    var key = this.toKey(i, j);
    if (!this.map[key]) return null;
    var val = this.map[key];
    delete this.map[key];
    return val;
}
Utils.PairMap.prototype.each = function(fun) {
    for (var key in this.map) {
        if (!this.map.hasOwnProperty(key)) continue;
        var keys = this.fromKey(key);
        var val = this.map[key];
        fun(keys[0], keys[1], val);
    }
}
