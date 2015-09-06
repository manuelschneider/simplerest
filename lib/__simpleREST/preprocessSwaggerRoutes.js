/**
 * this methods expands the 'inheritance', if some item is set for a route and not for specific calls
 * it is copied to the call
 * @param  {SwaggerRoutes} routes
 * @return {SwaggerRoutes}
*/


(function() {
  module.exports = function(routes, pathPrefix) {
    var content, key, method, param, paramConfig, route, routeConfig, _i, _len, _ref;
    for (route in routes) {
      routeConfig = routes[route];
      for (key in routeConfig) {
        content = routeConfig[key];
        if (key !== 'GET' && key !== 'POST' && key !== 'PUT' && key !== 'DELETE') {
          _ref = ['GET', 'POST', 'PUT', 'DELETE'];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            method = _ref[_i];
            if (routeConfig[method] != null) {
              if (routeConfig[method][key] == null) {
                routeConfig[method][key] = content;
              } else if (key === "params") {
                for (param in content) {
                  paramConfig = content[param];
                  if (routeConfig[method][key][param] == null) {
                    routeConfig[method][key][param] = paramConfig;
                  }
                }
              }
            }
          }
        }
      }
    }
    return routes;
  };

}).call(this);

//# sourceMappingURL=../../lib/__simpleREST/preprocessSwaggerRoutes.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */