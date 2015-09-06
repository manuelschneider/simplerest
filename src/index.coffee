appConfig = JSON.parse(require("fs").readFileSync(__dirname + "/__simpleREST/appConfig.json"))
log = null
singleton = null
servers = {}

module.exports = {
    run: ( sysDirs, info, syslog, netConfig, dbConfig ) ->
        log = syslog
        log.info("starting service...")

        log.debug("reading config..")
        processedConfig = require("./__simpleREST/prepareConfig")(sysDirs.conf, netConfig, dbConfig, log)
        return unless processedConfig?
        { netConfig, dbConfig, configFiles } = processedConfig


        log.debug("instanciating singleton")
        singletonConfig = {
            sysDirs,
            version: info.version,
            log,
            netConfig,
            dbConfig,
            files: configFiles
        }
        singleton = new (require("./" + appConfig.singleton))(singletonConfig)

        pathPrefix = ""
        if configFiles.master.proxyUrl?
            pathPrefix = require('url').parse(configFiles.master.proxyUrl).pathname
            if pathPrefix.substring(pathPrefix.length - 1) is '/'
                pathPrefix = pathPrefix.substring(0, pathPrefix.length - 1)
            log.info("modifying, swagger, routes and redirects for proxy-config:" +
                " #{configFiles.master.proxyUrl}, pathPrefix: #{pathPrefix}")

        log.debug("configuring restify")
        restify = require('restify')
        if netConfig.ports.tcp.http?
            log.debug("configuring restify for http")
            server = restify.createServer({
                name: appConfig.appName,
                version: info.version,
                log
            })
            if configFiles.master.sslOnly
                unless netConfig.ports.tcp.https?
                    log.error("sslOnly is 'true' but no https port defined --> cannot start.")
                    throw new Error("sslOnly is 'true' but no https port defined --> cannot start.")
                server.get(/.*/, ( req, res, next ) ->
                    res.header("Location", "https://#{netConfig.hostname}:#{netConfig.ports.tcp.https}/")
                    res.send(301)
                )
            else
                if configFiles.master.proxyUrl?
                    server.use((req, res, next) ->
                        if (new RegExp("#{pathPrefix.replace(/\//,"\/",'g')}\/swagger-ui\/?.*"))
                            .test(req.path())
                                newPath = req.path().substring(pathPrefix.length)
                                req.path = (( path ) ->
                                    path
                                ).bind(null, newPath)
                        unless /swagger-docs/.test(req.path())
                            req.url = req.url.substring(pathPrefix.length)
                        next(req, res, next)
                    )
                    server.get(new RegExp("^#{pathPrefix.replace(/\//,"\/",'g')}\/(swagger-ui\/?)?$"),
                        ( req, res, next ) ->
                            res.header("Location", "#{pathPrefix}/swagger-ui/index.html")
                            res.send(301)
                    )
                    server.get(new RegExp("#{pathPrefix.replace(/\//,"\/",'g')}\/swagger-ui\/?.*"),
                        restify.serveStatic({
                            directory: __dirname + '/__simpleREST/swagger/'
                        })
                    )
                else
                    server.get(/^\/(swagger-ui\/?)?$/, ( req, res, next ) ->
                        res.header("Location", "/swagger-ui/index.html")
                        res.send(301)
                    )
                    server.get(/\/swagger-ui\/?.*/, restify.serveStatic({
                        directory: __dirname + '/__simpleREST/swagger/'
                    }))
                server.use(restify.bodyParser())
                server.use(restify.queryParser())

        if netConfig.ports.tcp.https?
            log.debug("configuring restify for https")
            config = {
                name: appConfig.appName,
                version: info.version,
                log,
                certificate: netConfig.ssl.default.crt,
                key: netConfig.ssl.default.key,
            }
            if netConfig.ssl.default.ca?
                config.ca = netConfig.ssl.default.ca
            sslServer = restify.createServer(config)
            if configFiles.master.proxyUrl?
                sslServer.use((req, res, next) ->
                    if (new RegExp("#{pathPrefix.replace(/\//,"\/",'g')}\/swagger-ui\/?.*"))
                        .test(req.path())
                            newPath = req.path().substring(pathPrefix.length)
                            req.path = (( path ) ->
                                path
                            ).bind(null, newPath)
                    unless /swagger-docs/.test(req.path())
                        req.url = req.url.substring(pathPrefix.length)
                    next(req, res, next)
                )
                sslServer.get(new RegExp("^#{pathPrefix.replace(/\//,"\/",'g')}\/(swagger-ui\/?)?$"),
                    ( req, res, next ) ->
                        res.header("Location", "#{pathPrefix}/swagger-ui/index.html")
                        res.send(301)
                )
                sslServer.get(new RegExp("#{pathPrefix.replace(/\//,"\/",'g')}\/swagger-ui\/?.*"),
                    restify.serveStatic({
                        directory: __dirname + '/__simpleREST/swagger/'
                    })
                )
            else
                sslServer.get(/^\/(swagger-ui\/?)?$/, ( req, res, next ) ->
                    res.header("Location", "/swagger-ui/index.html")
                    res.send(301)
                )
                sslServer.get(/\/swagger-ui\/?.*/, restify.serveStatic({
                    directory: __dirname + '/__simpleREST/swagger/'
                }))
            sslServer.use(restify.bodyParser())
            sslServer.use(restify.queryParser())


        log.debug("configuring swagger")
        if server? and not configFiles.master.sslOnly
            require("./__simpleREST/bootstrapSwagger")(server, singleton, singletonConfig, configFiles, info,
                netConfig.hostname, netConfig.ports.tcp.http, false, pathPrefix)
        require("./__simpleREST/bootstrapSwagger")(sslServer, singleton, singletonConfig, configFiles, info,
            netConfig.hostname, netConfig.ports.tcp.https, true, pathPrefix) if sslServer?

        log.debug("firing everything up")
        if server?
            server.listen(netConfig.ports.tcp.http, netConfig.hostname)
            servers['http'] = server
            log.info("service listening on port #{netConfig.ports.tcp.http} for http")
        if sslServer?
            sslServer.listen(netConfig.ports.tcp.https, netConfig.hostname)
            servers['https'] = sslServer
            log.info("service listening on port #{netConfig.ports.tcp.https} for https")


    stop: ->
        for name, server of servers
            server.close()
        singleton.destroy() if singleton.destroy?
}
