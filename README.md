simpleREST
==============

*Create a fully-fletched REST-Service by simply providing a coffeescriptclass-like javascript function, routes and a formal description of your models in swagger.*

The resulting REST-Service will

  * use restify as stable and robust server-component
  * have a swagger-description, which gives you machine-readable specs, an apibrowser and clients
  * be compliant to the 'Service'-appclass from deployer.js, so you can easily generate and publish packages for multiple package managers from it
  * provide a [bunyan](https://github.com/trentm/node-bunyan)-instance for logging
  * validate your input (to some limited extend automatically)
  * make correct use of Cache-Headers
  * allow you to configure [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing)
  * be proxy-friendly without the need for rewriting urls manually

What's missing?

  * a collection of SDKs generated from the swagger-specs (should be integrated)
  * a WADL-file generated from the swagger-specs (should probably be implemented in an extra project and integrated)
  * 'API-migrations' for mapping deprecated API-calls to new API-calls to maintain backwards-compatibility when you bump your major-version
  * Internationalization, which I don't think a REST-Service needs. I believe a service should speak devish ('developer english'), frontends exist for chatting with non-devs.

> The main design goal is to keep the service-stuff out of the way, making it transparent. This allows you to concentrate on your logic and (later) reuse unit-tests for end-to-end testing.


## Usage

Install simpleREST to your project

    $ npm install git+https://github.com/manuelschneider/simplerest --save

### ham

create some class `lib/myService.coffee` that will be used as singleton to run the service:

    class Object

        constructor: (config) ->
            config.log.info("yeah!")

        get: ( callback, id = null ) ->
            callback({ foo: "bar" })

        destroy: ->

    module.exports = Object

> The asynchronous interface of your singleton is required in order to make the complete REST-layer transparent for client-implementations. This means we can run unit-tests as end-to-end tests using some kind of dependency-injection.

The config given to the constructor is an object containing the params from the 'run' method of [deployerjs](https://github.com/manuelschneider/deployerjs) plus the objects from all cson files in the config dir:

    {
        sysDirs: { conf: .., tmp: .., data: .. }
        version: '0.0.0'
        log: a bunyan logger
        netConfig: the content from net.conf
        dbConfig: the content from db.conf (if present)
        files: {
            whateverfileyouhadinconf: its content is here
        }
    }

Then create your conf dir (as specified by [deployerjs]()) with net.conf plus a master.cson:

    corsAllowedOrigin: '*'
    adminMail: 'admin@efreetsystems.de'
    sslOnly: true ## optional, defaults to false; if true http only redirects to the https server

    ## To be friendly to proxies, set this to something like 'https://someProxy.org/api/'. The swagger
    ## docs, redirects and routes are then adapted to differ from the real net.conf
    ## You could use this for example with lighttpds mod_proxy to run the service on localhost,
    ## but proxy it in some path under a public domain in order to blend into your site.
    proxyUrl: null ## optional


And last: The destroy method (if present) is called when the service exits.

### models

create a directory containing your models:

    models
    |  Myobject.cson
    |  MyotherObject.cson

Each of the files is a swagger-model, see [swagger](https://github.com/wordnik/swagger-core/wiki/Datatypes).

### routing: wiring up 'ham'

Next, create a `route.coffee` that looks like this:

    module.exports = {
        "/object/{id}":
            description: ".."
            notes: ".."
            summary: ".."
            params:
                id:
                    paramType: "path" ## query|path|body|form|header; optional, defaults to 'query'
                    description: ".."
                    required: true ## optional; only for query & header
                    default: ".." ## optional; not for header
                    type: 'string' ## string|int|long|double|boolean|date|array
                    enum: null ## optional; eg: ["a", "b"]; only for query, path and form
                    dataFilter: (cb, data, singletonConfig, swagger, req) ->
                        cb(data)
            GET:
                call: [ 'getObject' ]
                callParams: [ "id", "callback" ]
                cache: 3600 ## set to 0 disable HTTP-caching; optional
                description: ".." ## optional
                notes: ".." ## optional
                summary: ".." ## optional
                nickname: "get" ## optional, default is the last item of 'call' [the method in generated sdks]
                type: "Myobject"
                resultProcessor: ( cb, resultArgs, conf, req ) ->
                    cb(resultArgs[0])
            PUT:
                ....
    }

Basically you describe your paths, and the methods on them.

  * The array for 'call' describes the property of the singleton that should be invoked, it must have an asynchronous interface.
  * 'callParams' are the params that should be passed into the method, whereas 'callback' describes a callback which arguments array is given to the 'resultProcessor'. If the arguments array contains zero elements (no arguments) it's converted to 'null', if there's only one argument there's no array.
  * the 'conf'-param for dataFilter|resultProcessor is the same object as the one given to the singleton on initialisation
  * The HTTP-Method sections inherit unset properties from the route, the 'params' object is merged. The param name 'callback' is not allowed.

### validation

Built-in validation uses json-gate along with your swagger-models for checking the models of parameters.

It's also possible to create one or more 'global validator(s)', eg for enforcing acls based on some token. For that, simply create a validators.coffee:

    module.exports = [
        {
            headerParams: [ "api_key" ]
            validator: ( cb, swagger, conf, req, path, httpMethod ) ->
                apiKey = req.header("api_key")
                if apiKey is 'p0wn'
                    return cb(true)
                cb(false)
        }
    ]

Again, the 'conf'-param is the same object as the one given to the singleton on initialisation.

### versioning

For major version bumps you may provide 'migrations', consisting of an old route- and validation file and some module extending the current (actual) class, or the next newer reference.

migrations is a directory containing modules like myService-v1, myService-v2, etc. If the API is called with a deprecated major-version without migration, a 'deprecated' error is returned with HTTP 410 (GONE).


> TBD

A migration is typically extending the next newer (reference) version, calling its methods to perform the requested task. If this is impossible for *some* functionality you should raise a deprecated error manually in the migration.


### wrapping it all up with grunt

Lastly, configure your grunt-task:

    simpleREST: {
        singleton: 'myService'
        dest: 'dist/'
        routes: 'route'
        models: 'models/'
        validators: 'validators'
        conf: 'conf/'
        dbMigrations: 'db/'
    }

Build a `deployer.js` compatible service:

    $ grunt build

or make it run on changes using `grunt-contrib-watch`

    $ grunt watch

See [deployer.js](https://github.com/manuelschneider/deployerjs) for how to use it to run your service and build it for different package managers.
