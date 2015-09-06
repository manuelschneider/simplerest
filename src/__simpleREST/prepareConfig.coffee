module.exports = ( confDir, netConfig, dbConfig, log ) ->
    configFiles = {}
    for file in require("fs").readdirSync(confDir)
        if require("path").extname(file) is ".cson"
            log.debug("parsing file #{file}")
            configFiles[require("path").basename(file, '.cson')] =
                require("cson").parseFileSync(confDir + file)
        else
            log.debug("ignoring file #{file} as it is no cson")
    unless configFiles.master?.corsAllowedOrigin?
        log.warn("no corsAllowedOrigin setting found in `master.cson`, defaulting to '*'")
        configFiles.master ?= {}
        configFiles.master.corsAllowedOrigin = '*'

    unless configFiles.master.sslOnly?
        log.warn("no sslOnly setting found in `master.cson`, defaulting to 'true'")
        configFiles.master.sslOnly = true

    log.debug("preparing netConfig")
    unless netConfig.hostname?
        log.warn("no hostname configured in `conf/net.conf` --> defaulting to 'localhost'")
        netConfig.hostname = 'localhost'
    unless netConfig.ports?.tcp?.http? or netConfig.ports?.tcp?.https?
        log.error("no ports for http(s) configured in `conf/net.conf` --> Cannot start!")
        return null
    unless netConfig.ports.tcp.http?
        log.warn("no port for http configured in `conf/net.conf`. Won't start a http-server!")
    unless netConfig.ports.tcp.https?
        log.warn("no port for https configured in `conf/net.conf`. Won't start a https-server!")
    if netConfig.ports.tcp.https?
        if not netConfig.ssl?.default? or not ( netConfig.ssl.default.key? and netConfig.ssl.default.crt? )
            log.error("could not find the default ssl-cert in `conf/net.conf` --> Cannot start!")
            return null
        else
            log.debug("reading SSL-key from `#{netConfig.ssl.default.key}`")
            netConfig.ssl.default.key = require("fs").readFileSync(netConfig.ssl.default.key, "utf-8")
            log.debug("reading SSL-cert from `#{netConfig.ssl.default.crt}`")
            netConfig.ssl.default.crt = require("fs").readFileSync(netConfig.ssl.default.crt, "utf-8")
            if netConfig.ssl.default.ca?
                log.debug("reading ca SSL-cert from `#{netConfig.ssl.default.ca}`")
                netConfig.ssl.default.ca = require("fs").readFileSync(netConfig.ssl.default.ca, "utf-8")

    { configFiles, netConfig, dbConfig }