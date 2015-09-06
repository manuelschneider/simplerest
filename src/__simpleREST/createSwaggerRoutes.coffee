_sendResponse = ( hamKit, cache, singletonConfig, params, res, req, result ) ->
    logger = singletonConfig.log
    if result instanceof Error
        logger.error("processing result from", hamKit['call'], "with", params, "returned", result)
        res.send({'description': 'internal error', 'code': 500}, 500)
        return

    logger.debug("sending result", result, "as 200 with cache", cache)
    res.cache(cache)
    res.send(200, result)


_callFinished = ( hamKit, cache, singletonConfig, params, res, req, result... ) ->
    logger = singletonConfig.log
    result = null if result.length is 0
    result = result[0] if result.length is 1
    if result instanceof Error
        logger.error("calling", hamKit['call'], "with", params, "returned", result)
        res.send({'description': 'internal error', 'code': 500}, 500)
        return

    send = _sendResponse.bind(@, hamKit, cache, singletonConfig, params, res, req)
    if hamKit.resultProcessor?
        hamKit.resultProcessor(send, result, singletonConfig, req)
    else
        send(result)


_payload = (params, hamKit, swaggerInstance, cache, singletonConfig, req, res) ->
    logger = singletonConfig.log
    logger.debug("calling", hamKit['call'], "with", params)
    hamMethod = hamKit.ham
    realCall = hamKit['call'][hamKit['call'].length - 1]
    for propId in [0...(hamKit['call'].length - 1)]
        hamMethod = hamMethod[hamKit['call'][propId]]
    hamMethod[realCall](params...)


_polishParams = (params, hamKit, swaggerInstance, cache, singletonConfig, req, res, index, value) ->
    if index?
        params[index].val = value
        params[index].dataFilter = null

    polishedParams = []
    for param, i in params
        if param.dataFilter?
            param.dataFilter(
                _polishParams.bind(null, params, hamKit, swaggerInstance,
                    cache, singletonConfig, req, res, i),
                param.val, singletonConfig, swaggerInstance, req, i)
            return
        polishedParams[i] = param.val
    
    _payload(polishedParams, hamKit, swaggerInstance, cache, singletonConfig, req, res)


_prepareParams = (collectParams, hamKit, swaggerInstance, cache, singletonConfig, req, res) ->
    logger = singletonConfig.log
    collectedParams = {}
    for name, specs of collectParams
        switch specs.paramType
            when "query" then collectedParams[name] = req.query[name]
            when "path" then collectedParams[name] = req.params[name]
            when "body" then collectedParams[name] = req.body
            when "form" then collectedParams[name] = req.params[name]
            when "header" then collectedParams[name] = req.header(name)

        if specs.required? and not collectedParams[name]?
            logger.warn("param #{name} is required, but not given!")
            throw swaggerInstance.errors.invalid(name)
        if specs.typeModel?
            try
                specs.typeModel.validate(collectedParams[name])
            catch err
                logger.debug("validation error at param #{name}: ", err)
                logger.warn("param #{name} doesn't match its model #{specs.type}")
                throw swaggerInstance.errors.invalid(name)
        else if specs.type is 'boolean'
            if collectedParams[name] is 'false'
                collectedParams[name] = false
            else
                collectedParams[name] = true

    params = []
    callbackPosition = -1
    for param, i in hamKit.params
        if param is 'callback'
            params.push('callback')
            callbackPosition = i
            continue
        val = collectedParams[param]
        if collectParams[param].dataFilter? and val?
            params.push({val, dataFilter: collectParams[param].dataFilter})
        else
            params.push({val, dataFilter: null})

    if callbackPosition is -1
        throw new Error("plz include 'callback' in the `callParams`")

    params[callbackPosition] = {
        val: _callFinished.bind(@, hamKit, cache, singletonConfig, params, res, req )
        dataFilter: null
    }
    _polishParams(params, hamKit, swaggerInstance, cache, singletonConfig, req, res)



_runValidators = (execPayload, validators, swagger, singletonConfig, index, req, res, next, prevRes) ->
    if prevRes? and (typeof(prevRes) isnt 'boolean' or not prevRes)
        res.send(403, {
            message: "forbidden"
            code: 403
        })
        return

    if validators.length - index <= 0
        execPayload(req, res)
        return

    validators[index].validator(
        _runValidators.bind(@, execPayload, validators, swagger, singletonConfig, index + 1, req, res, null),
        swagger
        singletonConfig
        req
        req.url.split('?')[0].replace(".json", "").replace(/{.*\}/, "*")
        req.method
    )


_createCallConfig = ( method, route, routeConfig, ham, swaggerInstance, singletonConfig, pathPrefix ) ->
    logger = singletonConfig.log
    conf = {
        spec: {
            path: route,
            method
            nickname: routeConfig['call'][routeConfig['call'].length - 1]
            pathPrefix
        }
    }

    for item in [ 'summary', 'notes', 'type', 'description', 'nickname' ]
        conf.spec[item] = routeConfig[item] if routeConfig[item]?

    if routeConfig.params? and Object.keys(routeConfig.params).length > 0
        conf.spec.parameters = []
        conf.spec.errorResponses = []
        for name, specs of routeConfig.params
            specs.required ?= true
            specs.paramType ?= "query"
            params = [ name, specs.description, specs.type ]
            if specs.paramType in [ "query", "header" ]
                params.push(specs.required)
            if specs.paramType in [ "query", "path", "form" ]
                params.push(specs.enum)
            if specs.paramType in [ "query", "path", "body", "form" ]
                params.push(specs.default)

            conf.spec.parameters.push(swaggerInstance.params[specs.paramType](params...))
            conf.spec.errorResponses.push(swaggerInstance.errors.invalid(name))
            if swaggerInstance.getModels[specs.type]?
                model = swaggerInstance.getModels[specs.type]
                specs.typeModel = require('json-gate').createSchema(
                    require("./swagger-jack-swagger2jsonschema").convertModel(
                        model,
                        if model.properties then model else swagger.models[specs.type]
                    )
                )
    else
        routeConfig.params = {}

    routeConfig['params'] ?= {}
    routeConfig['callParams'] ?= []

    hamKit = {
        params: routeConfig['callParams'],
        ham,
        call: routeConfig['call'],
        resultProcessor: routeConfig['resultProcessor']
    }
    cache = "no-cache"
    if typeof(routeConfig['cache']) is 'number' and routeConfig['cache'] > 0
        cache = "max-age=#{routeConfig['cache']}"

    execPayload = _prepareParams.bind(
        null, routeConfig['params'], hamKit, swaggerInstance, cache, singletonConfig)

    conf.action = _runValidators.bind(swaggerInstance, execPayload, require(__dirname + "/swagger/validators"), swaggerInstance,
        singletonConfig, 0)

    logger.debug(conf)
    conf


module.exports = ( swaggerInstance, routes, ham, singletonConfig, pathPrefix ) ->

    for route, content of routes
        for method in [ 'GET', 'POST', 'PUT', 'DELETE' ]
            if content[method]?
                swaggerInstance['add' + method](_createCallConfig(
                    method, route, content[method], ham, swaggerInstance, singletonConfig, pathPrefix))

    swaggerInstance