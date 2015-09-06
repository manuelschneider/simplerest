(function() {
  module.exports = function(confDir, netConfig, dbConfig, log) {
    var configFiles, file, _i, _len, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;
    configFiles = {};
    _ref = require("fs").readdirSync(confDir);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      file = _ref[_i];
      if (require("path").extname(file) === ".cson") {
        log.debug("parsing file " + file);
        configFiles[require("path").basename(file, '.cson')] = require("cson").parseFileSync(confDir + file);
      } else {
        log.debug("ignoring file " + file + " as it is no cson");
      }
    }
    if (((_ref1 = configFiles.master) != null ? _ref1.corsAllowedOrigin : void 0) == null) {
      log.warn("no corsAllowedOrigin setting found in `master.cson`, defaulting to '*'");
      if (configFiles.master == null) {
        configFiles.master = {};
      }
      configFiles.master.corsAllowedOrigin = '*';
    }
    if (configFiles.master.sslOnly == null) {
      log.warn("no sslOnly setting found in `master.cson`, defaulting to 'true'");
      configFiles.master.sslOnly = true;
    }
    log.debug("preparing netConfig");
    if (netConfig.hostname == null) {
      log.warn("no hostname configured in `conf/net.conf` --> defaulting to 'localhost'");
      netConfig.hostname = 'localhost';
    }
    if (!((((_ref2 = netConfig.ports) != null ? (_ref3 = _ref2.tcp) != null ? _ref3.http : void 0 : void 0) != null) || (((_ref4 = netConfig.ports) != null ? (_ref5 = _ref4.tcp) != null ? _ref5.https : void 0 : void 0) != null))) {
      log.error("no ports for http(s) configured in `conf/net.conf` --> Cannot start!");
      return null;
    }
    if (netConfig.ports.tcp.http == null) {
      log.warn("no port for http configured in `conf/net.conf`. Won't start a http-server!");
    }
    if (netConfig.ports.tcp.https == null) {
      log.warn("no port for https configured in `conf/net.conf`. Won't start a https-server!");
    }
    if (netConfig.ports.tcp.https != null) {
      if ((((_ref6 = netConfig.ssl) != null ? _ref6["default"] : void 0) == null) || !((netConfig.ssl["default"].key != null) && (netConfig.ssl["default"].crt != null))) {
        log.error("could not find the default ssl-cert in `conf/net.conf` --> Cannot start!");
        return null;
      } else {
        log.debug("reading SSL-key from `" + netConfig.ssl["default"].key + "`");
        netConfig.ssl["default"].key = require("fs").readFileSync(netConfig.ssl["default"].key, "utf-8");
        log.debug("reading SSL-cert from `" + netConfig.ssl["default"].crt + "`");
        netConfig.ssl["default"].crt = require("fs").readFileSync(netConfig.ssl["default"].crt, "utf-8");
        if (netConfig.ssl["default"].ca != null) {
          log.debug("reading ca SSL-cert from `" + netConfig.ssl["default"].ca + "`");
          netConfig.ssl["default"].ca = require("fs").readFileSync(netConfig.ssl["default"].ca, "utf-8");
        }
      }
    }
    return {
      configFiles: configFiles,
      netConfig: netConfig,
      dbConfig: dbConfig
    };
  };

}).call(this);

//# sourceMappingURL=../../lib/__simpleREST/prepareConfig.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */