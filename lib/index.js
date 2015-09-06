(function() {
  var appConfig, log, servers, singleton;

  appConfig = JSON.parse(require("fs").readFileSync(__dirname + "/__simpleREST/appConfig.json"));

  log = null;

  singleton = null;

  servers = {};

  module.exports = {
    run: function(sysDirs, info, syslog, netConfig, dbConfig) {
      var config, configFiles, pathPrefix, processedConfig, restify, server, singletonConfig, sslServer;
      log = syslog;
      log.info("starting service...");
      log.debug("reading config..");
      processedConfig = require("./__simpleREST/prepareConfig")(sysDirs.conf, netConfig, dbConfig, log);
      if (processedConfig == null) {
        return;
      }
      netConfig = processedConfig.netConfig, dbConfig = processedConfig.dbConfig, configFiles = processedConfig.configFiles;
      log.debug("instanciating singleton");
      singletonConfig = {
        sysDirs: sysDirs,
        version: info.version,
        log: log,
        netConfig: netConfig,
        dbConfig: dbConfig,
        files: configFiles
      };
      singleton = new (require("./" + appConfig.singleton))(singletonConfig);
      pathPrefix = "";
      if (configFiles.master.proxyUrl != null) {
        pathPrefix = require('url').parse(configFiles.master.proxyUrl).pathname;
        if (pathPrefix.substring(pathPrefix.length - 1) === '/') {
          pathPrefix = pathPrefix.substring(0, pathPrefix.length - 1);
        }
        log.info("modifying, swagger, routes and redirects for proxy-config:" + (" " + configFiles.master.proxyUrl + ", pathPrefix: " + pathPrefix));
      }
      log.debug("configuring restify");
      restify = require('restify');
      if (netConfig.ports.tcp.http != null) {
        log.debug("configuring restify for http");
        server = restify.createServer({
          name: appConfig.appName,
          version: info.version,
          log: log
        });
        if (configFiles.master.sslOnly) {
          if (netConfig.ports.tcp.https == null) {
            log.error("sslOnly is 'true' but no https port defined --> cannot start.");
            throw new Error("sslOnly is 'true' but no https port defined --> cannot start.");
          }
          server.get(/.*/, function(req, res, next) {
            res.header("Location", "https://" + netConfig.hostname + ":" + netConfig.ports.tcp.https + "/");
            return res.send(301);
          });
        } else {
          if (configFiles.master.proxyUrl != null) {
            server.use(function(req, res, next) {
              var newPath;
              if ((new RegExp("" + (pathPrefix.replace(/\//, "\/", 'g')) + "\/swagger-ui\/?.*")).test(req.path())) {
                newPath = req.path().substring(pathPrefix.length);
                req.path = (function(path) {
                  return path;
                }).bind(null, newPath);
              }
              if (!/swagger-docs/.test(req.path())) {
                req.url = req.url.substring(pathPrefix.length);
              }
              return next(req, res, next);
            });
            server.get(new RegExp("^" + (pathPrefix.replace(/\//, "\/", 'g')) + "\/(swagger-ui\/?)?$"), function(req, res, next) {
              res.header("Location", "" + pathPrefix + "/swagger-ui/index.html");
              return res.send(301);
            });
            server.get(new RegExp("" + (pathPrefix.replace(/\//, "\/", 'g')) + "\/swagger-ui\/?.*"), restify.serveStatic({
              directory: __dirname + '/__simpleREST/swagger/'
            }));
          } else {
            server.get(/^\/(swagger-ui\/?)?$/, function(req, res, next) {
              res.header("Location", "/swagger-ui/index.html");
              return res.send(301);
            });
            server.get(/\/swagger-ui\/?.*/, restify.serveStatic({
              directory: __dirname + '/__simpleREST/swagger/'
            }));
          }
          server.use(restify.bodyParser());
          server.use(restify.queryParser());
        }
      }
      if (netConfig.ports.tcp.https != null) {
        log.debug("configuring restify for https");
        config = {
          name: appConfig.appName,
          version: info.version,
          log: log,
          certificate: netConfig.ssl["default"].crt,
          key: netConfig.ssl["default"].key
        };
        if (netConfig.ssl["default"].ca != null) {
          config.ca = netConfig.ssl["default"].ca;
        }
        sslServer = restify.createServer(config);
        if (configFiles.master.proxyUrl != null) {
          sslServer.use(function(req, res, next) {
            var newPath;
            if ((new RegExp("" + (pathPrefix.replace(/\//, "\/", 'g')) + "\/swagger-ui\/?.*")).test(req.path())) {
              newPath = req.path().substring(pathPrefix.length);
              req.path = (function(path) {
                return path;
              }).bind(null, newPath);
            }
            if (!/swagger-docs/.test(req.path())) {
              req.url = req.url.substring(pathPrefix.length);
            }
            return next(req, res, next);
          });
          sslServer.get(new RegExp("^" + (pathPrefix.replace(/\//, "\/", 'g')) + "\/(swagger-ui\/?)?$"), function(req, res, next) {
            res.header("Location", "" + pathPrefix + "/swagger-ui/index.html");
            return res.send(301);
          });
          sslServer.get(new RegExp("" + (pathPrefix.replace(/\//, "\/", 'g')) + "\/swagger-ui\/?.*"), restify.serveStatic({
            directory: __dirname + '/__simpleREST/swagger/'
          }));
        } else {
          sslServer.get(/^\/(swagger-ui\/?)?$/, function(req, res, next) {
            res.header("Location", "/swagger-ui/index.html");
            return res.send(301);
          });
          sslServer.get(/\/swagger-ui\/?.*/, restify.serveStatic({
            directory: __dirname + '/__simpleREST/swagger/'
          }));
        }
        sslServer.use(restify.bodyParser());
        sslServer.use(restify.queryParser());
      }
      log.debug("configuring swagger");
      if ((server != null) && !configFiles.master.sslOnly) {
        require("./__simpleREST/bootstrapSwagger")(server, singleton, singletonConfig, configFiles, info, netConfig.hostname, netConfig.ports.tcp.http, false, pathPrefix);
      }
      if (sslServer != null) {
        require("./__simpleREST/bootstrapSwagger")(sslServer, singleton, singletonConfig, configFiles, info, netConfig.hostname, netConfig.ports.tcp.https, true, pathPrefix);
      }
      log.debug("firing everything up");
      if (server != null) {
        server.listen(netConfig.ports.tcp.http, netConfig.hostname);
        servers['http'] = server;
        log.info("service listening on port " + netConfig.ports.tcp.http + " for http");
      }
      if (sslServer != null) {
        sslServer.listen(netConfig.ports.tcp.https, netConfig.hostname);
        servers['https'] = sslServer;
        return log.info("service listening on port " + netConfig.ports.tcp.https + " for https");
      }
    },
    stop: function() {
      var name, server;
      for (name in servers) {
        server = servers[name];
        server.close();
      }
      if (singleton.destroy != null) {
        return singleton.destroy();
      }
    }
  };

}).call(this);

//# sourceMappingURL=../lib/index.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */