/**
 * Code initially released under MIT by worldline for swagger-jack, see
 *   https://github.com/worldline/swagger-jack/blob/master/src/validator.coffee
 *
 * Copied by Manuel Schneider <scriptlets@efreetsystems.de> for simpleREST.
*/


(function() {
  var _;

  _ = require('underscore');

  module.exports = {
    pathToRoute: function(original) {
      var route;
      route = (original.match(/^\//) ? '' : '/') + original.replace(/\{([^\}]+)\}/g, ':$1');
      return route.replace(/\/$/, '');
    },
    cast: function(type, value) {
      var original;
      switch (type) {
        case 'number':
        case 'integer':
          original = value;
          value = value !== void 0 && value !== '' ? Number(value) : void 0;
          value = isNaN(value) ? original : value;
          break;
        case 'boolean':
          switch (value) {
            case 'true':
              value = true;
              break;
            case 'false':
              value = false;
          }
          break;
        case 'object':
          if (_.isString(value)) {
            value = JSON.parse(value);
          }
      }
      return value;
    },
    generate: function() {
      var n, name;
      name = [];
      while (name.length < 12) {
        n = Math.floor(Math.random() * 62);
        name.push(n < 10 ? n : String.fromCharCode(n + (n < 36 ? 55 : 61)));
      }
      return name.join('');
    },
    extractParameters: function(path) {
      var i, pathParamsNames, regex;
      pathParamsNames = {};
      i = 0;
      regex = new RegExp(path.replace(/:([^\/]+)/g, function(match, key) {
        pathParamsNames[key] = ++i;
        return '([^\/]*)';
      }));
      return [regex, pathParamsNames];
    },
    extractBasePath: function(descriptor) {
      var basePath, match;
      if (descriptor.basePath.match(/\/$/)) {
        descriptor.basePath = descriptor.basePath.slice(0, +(descriptor.basePath.length - 2) + 1 || 9e9);
      }
      match = descriptor.basePath.match(/^https?:\/\/[^\/]+(?::\d+)?(\/.+)?$/);
      if (!match) {
        throw new Error("basePath " + descriptor.basePath + " is not a valid url address");
      }
      basePath = match[1] || '';
      if (basePath[basePath.length - 1] === '/') {
        basePath = basePath.slice(0, +(basePath.length - 1) + 1 || 9e9);
      }
      return basePath;
    }
  };

}).call(this);

//# sourceMappingURL=../../lib/__simpleREST/swagger-jack-utils.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */