(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(server, singleton, singletonConfig, configFiles, info, hostname, port, ssl, pathPrefix) {
    var allowedHeaders, config, content, file, header, key, log, models, param, paramConfig, route, routes, setHeaders, swagger, validator, validators, _i, _j, _k, _l, _len, _len1, _len2, _len3, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
    log = singletonConfig.log;
    swagger = new require("swagger-node-restify").factory();
    swagger.setAppHandler(server);
    validators = require(__dirname + "/swagger/validators");
    log.debug("importing swagger-models");
    models = {};
    _ref = require("fs").readdirSync(__dirname + "/swagger/models/");
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      file = _ref[_i];
      if (require("path").extname(file) === ".json") {
        models[require("path").basename(file, '.json')] = JSON.parse(require("fs").readFileSync(__dirname + "/swagger/models/" + file));
      }
    }
    swagger.addModels(models);
    log.debug("importing swagger-routing");
    routes = require("./preprocessSwaggerRoutes")(require(__dirname + "/swagger/routes"), pathPrefix);
    log.debug("routes: ", routes);
    require("./createSwaggerRoutes")(swagger, routes, singleton, singletonConfig, pathPrefix);
    log.debug("set some more swagger-config");
    allowedHeaders = ["Content-Type"];
    for (_j = 0, _len1 = validators.length; _j < _len1; _j++) {
      validator = validators[_j];
      _ref1 = validator.headerParams;
      for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
        header = _ref1[_k];
        if (_ref2 = header.toLowerCase(), __indexOf.call(allowedHeaders, _ref2) < 0) {
          allowedHeaders.push(header.toLowerCase());
        }
      }
    }
    for (route in routes) {
      content = routes[route];
      for (key in content) {
        config = content[key];
        if (key === 'GET' || key === 'POST' || key === 'PUT' || key === 'DELETE') {
          if (config.params != null) {
            _ref3 = config.params;
            for (param in _ref3) {
              paramConfig = _ref3[param];
              if (paramConfig.paramType === 'header' && !(_ref4 = param.toLowerCase(), __indexOf.call(allowedHeaders, _ref4) >= 0)) {
                allowedHeaders.push(param.toLowerCase());
              }
            }
          }
        }
      }
    }
    log.debug("headers: " + (allowedHeaders.join(", ")));
    setHeaders = (function(corsAllowedOrigin, allowedHeaders, res) {
      res.header("Content-Type", "application/json; charset=utf-8");
      res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.header('Access-Control-Allow-Origin', corsAllowedOrigin);
      res.header('Access-Control-Allow-Headers', allowedHeaders.join(", "));
      return void 0;
    }).bind(null, configFiles.master.corsAllowedOrigin, allowedHeaders);
    swagger.overridable.setHeaders = setHeaders;
    for (_l = 0, _len3 = allowedHeaders.length; _l < _len3; _l++) {
      header = allowedHeaders[_l];
      require("restify").CORS.ALLOW_HEADERS.push(header);
    }
    swagger.setApiInfo({
      title: configFiles.master.proxyUrl != null ? "" + info.name + " at " + configFiles.master.proxyUrl : "" + info.name + " on " + hostname,
      description: info.description,
      termsOfServiceUrl: null,
      contact: configFiles.master.adminMail,
      licenseUrl: (_ref5 = info.licenses) != null ? (_ref6 = _ref5[0]) != null ? _ref6.url : void 0 : void 0,
      web: info.homepage,
      bugs: (_ref7 = info.bugs) != null ? _ref7.url : void 0
    });
    swagger.configureSwaggerPaths("", "" + pathPrefix + "/swagger-docs", "");
    if (configFiles.master.proxyUrl) {
      if (configFiles.master.proxyUrl.substring(configFiles.master.proxyUrl.length - 1) === "/") {
        return swagger.configure(configFiles.master.proxyUrl.substring(0, configFiles.master.proxyUrl.length), info.version);
      } else {
        return swagger.configure(configFiles.master.proxyUrl, info.version);
      }
    } else if (ssl) {
      return swagger.configure("https://" + hostname + ":" + port, info.version);
    } else {
      return swagger.configure("http://" + hostname + ":" + port, info.version);
    }
  };

}).call(this);

//# sourceMappingURL=../../lib/__simpleREST/bootstrapSwagger.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */