module.exports = ( server, singleton, singletonConfig, configFiles, info, hostname, port, ssl, pathPrefix ) ->
    log = singletonConfig.log
    swagger = new require("swagger-node-restify").factory()
    swagger.setAppHandler(server)

    # we're not using addValidator as it is bullshit to do this synchronously...
    # see createSwaggerRoutes.coffee for the code that runs the validators.
    validators = require(__dirname + "/swagger/validators")

    log.debug("importing swagger-models")
    models = { }
    for file in require("fs").readdirSync(__dirname + "/swagger/models/")
        if require("path").extname(file) is ".json"
            models[require("path").basename(file, '.json')] =
                JSON.parse(require("fs").readFileSync(__dirname + "/swagger/models/" + file))
    swagger.addModels(models)
    
    log.debug("importing swagger-routing")
    routes = require("./preprocessSwaggerRoutes")(require(__dirname + "/swagger/routes"), pathPrefix)
    log.debug("routes: ", routes)
    require("./createSwaggerRoutes")(swagger, routes, singleton, singletonConfig, pathPrefix)

    log.debug("set some more swagger-config")
    allowedHeaders = [ "Content-Type" ]
    for validator in validators
        for header in validator.headerParams
            allowedHeaders.push(header.toLowerCase()) unless header.toLowerCase() in allowedHeaders
    for route, content of routes
        for key, config of content
            if key in [ 'GET', 'POST', 'PUT', 'DELETE' ]
                if config.params?
                    for param, paramConfig of config.params
                        if paramConfig.paramType is 'header' and not (param.toLowerCase() in allowedHeaders)
                            allowedHeaders.push(param.toLowerCase())
    log.debug("headers: #{allowedHeaders.join(", ")}")
    setHeaders = ((corsAllowedOrigin, allowedHeaders, res) ->
        res.header("Content-Type", "application/json; charset=utf-8")
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE")
        res.header('Access-Control-Allow-Origin', corsAllowedOrigin)
        res.header('Access-Control-Allow-Headers', allowedHeaders.join(", "))
        undefined
    ).bind(null, configFiles.master.corsAllowedOrigin, allowedHeaders)
    swagger.overridable.setHeaders = setHeaders
    for header in allowedHeaders
        require("restify").CORS.ALLOW_HEADERS.push(header)

    swagger.setApiInfo({
        title: if configFiles.master.proxyUrl? then "#{info.name} at #{configFiles.master.proxyUrl}" else
            "#{info.name} on #{hostname}"
        description: info.description
        termsOfServiceUrl: null
        contact: configFiles.master.adminMail
        licenseUrl: info.licenses?[0]?.url
        web: info.homepage
        bugs: info.bugs?.url
    })

    swagger.configureSwaggerPaths("", "#{pathPrefix}/swagger-docs", "")

    if configFiles.master.proxyUrl
        if configFiles.master.proxyUrl.substring(configFiles.master.proxyUrl.length - 1) is "/"
            swagger.configure(configFiles.master.proxyUrl.substring(0,configFiles.master.proxyUrl.length),
                info.version)
        else
            swagger.configure(configFiles.master.proxyUrl, info.version)
    else if ssl
        swagger.configure("https://#{hostname}:#{port}", info.version)
    else
        swagger.configure("http://#{hostname}:#{port}", info.version)
