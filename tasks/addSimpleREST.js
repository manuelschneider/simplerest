(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  module.exports = function(grunt) {
    return grunt.registerTask("addSimpleREST", "create a deployer-js compatible service in dist", function() {
      var appConfig, code, config, content, file, header, item, itemIsGenerallyRequired, key, license, options, param, paramConfig, payloadContents, route, routes, routesHeaders, uiConfig, _i, _j, _k, _l, _len, _len1, _len2, _len3, _len4, _len5, _len6, _m, _n, _o, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
      options = this.options({
        singleton: null,
        dest: "dist/",
        routes: "routes",
        models: "models/",
        validators: "validators",
        conf: "conf/",
        dbMigrations: "db/"
      });
      if (options.singleton == null) {
        throw new Error("invalid options: singleton! (" + (JSON.stringify(options)) + ")");
      }
      _ref = ["" + options.dest + "/conf", "" + options.dest + "/doc", "" + options.dest + "/lib/__simpleREST", "" + options.dest + "/dbMigrations"];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        item = _ref[_i];
        if (require("fs").existsSync(item)) {
          require("wrench").rmdirSyncRecursive(item);
        }
      }
      _ref1 = ["" + options.dest + "/package.json", "" + options.dest + "/lib/index.js", "" + options.dest + "/lib/index.js.map"];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        item = _ref1[_j];
        if (require("fs").existsSync(item)) {
          require("fs").unlinkSync(item);
        }
      }
      if (!require('fs').existsSync("" + options.dest + "/")) {
        require("fs").mkdirSync("" + options.dest + "/");
      }
      require("wrench").copyDirSyncRecursive(__dirname + "/../lib", "" + options.dest + "/lib", {
        forceDelete: true
      });
      require("wrench").copyDirSyncRecursive(options.conf, "" + options.dest + "/conf", {
        forceDelete: true
      });
      grunt.file.copy("package.json", "" + options.dest + "/package.json");
      payloadContents = require("fs").readdirSync("./");
      for (_k = 0, _len2 = payloadContents.length; _k < _len2; _k++) {
        file = payloadContents[_k];
        if (file.substring(0, 7) === "LICENSE") {
          license = file;
          break;
        }
      }
      if (license == null) {
        grunt.file.copy(__dirname + "/assets/LICENSE-PROP", "" + options.dest + "/LICENSE-PROP");
      } else {
        grunt.file.copy(license, "" + options.dest + "/" + license);
      }
      _ref2 = ['routes', 'validators'];
      for (_l = 0, _len3 = _ref2.length; _l < _len3; _l++) {
        item = _ref2[_l];
        code = require("coffee-script").compile(require("fs").readFileSync(options[item] + ".coffee", "utf-8"));
        grunt.file.write(options.dest + ("lib/__simpleREST/swagger/" + item + ".js"), code);
      }
      grunt.file.recurse(options.models, function(abspath, rootdir, subdir, fn) {
        var model;
        if (subdir == null) {
          subdir = ".";
        }
        model = require("cson").parseFileSync(abspath);
        return grunt.file.write(options.dest + ("lib/__simpleREST/swagger/models/" + subdir + "/" + (fn.substring(0, fn.length - 4)) + "json"), JSON.stringify(model));
      });
      if (require("fs").existsSync(options.dbMigrations)) {
        grunt.file.recurse(options.dbMigrations, function(abspath, rootdir, subdir, fn) {
          if (subdir == null) {
            subdir = ".";
          }
          if (fn.length > 7 && fn.substring(fn.length - 7) === '.coffee') {
            code = require("coffee-script").compile(require("fs").readFileSync(abspath, "utf-8"));
            return grunt.file.write(options.dest + ("dbMigrations/" + (fn.substring(0, fn.length - 7)) + ".js"), code);
          } else {
            return grunt.file.copy(abspath, "" + options.dest + "/" + fn);
          }
        });
      }
      require("wrench").copyDirSyncRecursive(__dirname + "/../lib/swagger-ui", options.dest + "lib/__simpleREST/swagger/swagger-ui", {
        forceDelete: true
      });
      appConfig = {
        appName: options.singleton,
        singleton: options.singleton
      };
      grunt.file.write(options.dest + "lib/__simpleREST/appConfig.json", JSON.stringify(appConfig));
      uiConfig = {
        server: "../swagger-docs",
        headerAuthParams: []
      };
      _ref3 = require(process.cwd() + "/" + options.dest + "lib/__simpleREST/swagger/validators");
      for (_m = 0, _len4 = _ref3.length; _m < _len4; _m++) {
        item = _ref3[_m];
        _ref4 = item.headerParams;
        for (_n = 0, _len5 = _ref4.length; _n < _len5; _n++) {
          header = _ref4[_n];
          if (_ref5 = header.toLowerCase(), __indexOf.call(uiConfig.headerAuthParams, _ref5) < 0) {
            uiConfig.headerAuthParams.push(header.toLowerCase());
          }
        }
      }
      routesHeaders = [];
      routes = require(process.cwd() + "/" + options.dest + "lib/__simpleREST/preprocessSwaggerRoutes")(require(process.cwd() + "/" + options.dest + "lib/__simpleREST/swagger/routes"));
      for (route in routes) {
        content = routes[route];
        for (key in content) {
          config = content[key];
          if (key === 'GET' || key === 'POST' || key === 'PUT' || key === 'DELETE') {
            if (config.params != null) {
              _ref6 = config.params;
              for (param in _ref6) {
                paramConfig = _ref6[param];
                if (paramConfig.paramType === 'header' && !(__indexOf.call(routesHeaders, param) >= 0)) {
                  routesHeaders.push(param);
                }
              }
            }
          }
        }
      }
      for (_o = 0, _len6 = routesHeaders.length; _o < _len6; _o++) {
        item = routesHeaders[_o];
        itemIsGenerallyRequired = true;
        for (route in routes) {
          content = routes[route];
          for (key in content) {
            config = content[key];
            if (key === 'GET' || key === 'POST' || key === 'PUT' || key === 'DELETE') {
              if ((((_ref7 = config.params) != null ? _ref7[item] : void 0) == null) || config.params[item].paramType !== 'header') {
                itemIsGenerallyRequired = false;
                break;
              }
            }
          }
        }
        if (itemIsGenerallyRequired) {
          uiConfig.headerAuthParams.push(item.toLowerCase());
        }
      }
      return grunt.file.write(options.dest + "lib/__simpleREST/swagger/swagger-ui/config.json", JSON.stringify(uiConfig));
    });
  };

}).call(this);

//# sourceMappingURL=../tasks/addSimpleREST.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */
require('source-map-support').install();