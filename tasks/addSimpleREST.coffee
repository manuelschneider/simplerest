module.exports = (grunt) ->

    grunt.registerTask("addSimpleREST", "create a deployer-js compatible service in dist", () ->
        ## read the options
        options = @options({
            singleton: null
            dest: "dist/"
            routes: "routes"
            models: "models/"
            validators: "validators"
            conf: "conf/"
            dbMigrations: "db/"
        })
        unless options.singleton?
            throw new Error("invalid options: singleton! (#{JSON.stringify(options)})")

        ## clean up
        for item in [ "#{options.dest}/conf", "#{options.dest}/doc",
            "#{options.dest}/lib/__simpleREST", "#{options.dest}/dbMigrations"
        ]
            if require("fs").existsSync(item)
                require("wrench").rmdirSyncRecursive(item)
        for item in [ "#{options.dest}/package.json", "#{options.dest}/lib/index.js",
            "#{options.dest}/lib/index.js.map"
        ]
            if require("fs").existsSync(item)
                require("fs").unlinkSync(item)

        unless require('fs').existsSync("#{options.dest}/")
            require("fs").mkdirSync("#{options.dest}/")

        ## aaaand go.
        require("wrench").copyDirSyncRecursive(__dirname + "/../lib", "#{options.dest}/lib", {forceDelete: true})
        require("wrench").copyDirSyncRecursive(options.conf, "#{options.dest}/conf", {forceDelete: true})
        grunt.file.copy("package.json", "#{options.dest}/package.json")


        ## copy the license (if any) or default to 'all rights reserved'
        payloadContents = require("fs").readdirSync("./")
        for file in payloadContents
            if file.substring(0,7) is "LICENSE"
                license = file
                break
        unless license?
            grunt.file.copy(__dirname + "/assets/LICENSE-PROP", "#{options.dest}/LICENSE-PROP")
        else
            grunt.file.copy(license, "#{options.dest}/#{license}")

        for item in ['routes', 'validators']
            code = require("coffee-script").compile(require("fs").readFileSync(options[item] + ".coffee",
                "utf-8"))
            grunt.file.write(options.dest + "lib/__simpleREST/swagger/#{item}.js", code)

        grunt.file.recurse(options.models, ( abspath, rootdir, subdir, fn ) ->
            subdir ?= "."
            model = require("cson").parseFileSync(abspath)
            grunt.file.write(options.dest +
                "lib/__simpleREST/swagger/models/#{subdir}/#{fn.substring(0,fn.length - 4)}json",
                JSON.stringify(model))
        )

        if require("fs").existsSync(options.dbMigrations)
            grunt.file.recurse(options.dbMigrations, ( abspath, rootdir, subdir, fn ) ->
                subdir ?= "."
                if fn.length > 7 and fn.substring(fn.length - 7) is '.coffee'
                    code = require("coffee-script").compile(require("fs").readFileSync(abspath, "utf-8"))
                    grunt.file.write(options.dest + "dbMigrations/#{fn.substring(0,fn.length - 7)}.js", code)
                else
                    grunt.file.copy(abspath, "#{options.dest}/#{fn}")
            )

        require("wrench").copyDirSyncRecursive(__dirname + "/../lib/swagger-ui",
            options.dest + "lib/__simpleREST/swagger/swagger-ui", {forceDelete: true})

        ## generate the require config for the simpleREST index.js
        appConfig = { appName: options.singleton, singleton: options.singleton }
        grunt.file.write(options.dest + "lib/__simpleREST/appConfig.json", JSON.stringify(appConfig))

        ## generate the required config for swagger-ui
        uiConfig = {
            server: "../swagger-docs"
            headerAuthParams: []
        }
        for item in require(process.cwd() + "/" + options.dest + "lib/__simpleREST/swagger/validators")
            for header in item.headerParams
                unless header.toLowerCase() in uiConfig.headerAuthParams
                    uiConfig.headerAuthParams.push(header.toLowerCase())

        routesHeaders = []
        routes = require(process.cwd() + "/" + options.dest + "lib/__simpleREST/preprocessSwaggerRoutes")(
            require(process.cwd() + "/" + options.dest + "lib/__simpleREST/swagger/routes"))
        for route, content of routes
            for key, config of content
                if key in [ 'GET', 'POST', 'PUT', 'DELETE' ]
                    if config.params?
                        for param, paramConfig of config.params
                            if paramConfig.paramType is 'header' and not (param in routesHeaders)
                                routesHeaders.push(param)

        for item in routesHeaders
            itemIsGenerallyRequired = true
            for route, content of routes
                for key, config of content
                    if key in [ 'GET', 'POST', 'PUT', 'DELETE' ]
                        if not config.params?[item]? or config.params[item].paramType isnt 'header'
                            itemIsGenerallyRequired = false
                            break
            if itemIsGenerallyRequired
                uiConfig.headerAuthParams.push(item.toLowerCase())

        grunt.file.write(options.dest + "lib/__simpleREST/swagger/swagger-ui/config.json",
            JSON.stringify(uiConfig))
    )
