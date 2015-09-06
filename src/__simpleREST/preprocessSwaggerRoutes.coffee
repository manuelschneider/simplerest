###*
 * this methods expands the 'inheritance', if some item is set for a route and not for specific calls
 * it is copied to the call
 * @param  {SwaggerRoutes} routes
 * @return {SwaggerRoutes}
###
module.exports = ( routes, pathPrefix ) ->
    for route, routeConfig of routes
        for key, content of routeConfig
            unless key in [ 'GET', 'POST', 'PUT', 'DELETE' ]
                for method in [ 'GET', 'POST', 'PUT', 'DELETE' ]
                    if routeConfig[method]?
                        unless routeConfig[method][key]?
                            routeConfig[method][key] = content
                        else if key is "params"
                            for param, paramConfig of content
                                unless routeConfig[method][key][param]?
                                    routeConfig[method][key][param] = paramConfig
    routes