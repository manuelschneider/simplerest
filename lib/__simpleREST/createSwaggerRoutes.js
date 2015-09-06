(function() {
  var _callFinished, _createCallConfig, _payload, _polishParams, _prepareParams, _runValidators, _sendResponse,
    __slice = [].slice;

  _sendResponse = function(hamKit, cache, singletonConfig, params, res, req, result) {
    var logger;
    logger = singletonConfig.log;
    if (result instanceof Error) {
      logger.error("processing result from", hamKit['call'], "with", params, "returned", result);
      res.send({
        'description': 'internal error',
        'code': 500
      }, 500);
      return;
    }
    logger.debug("sending result", result, "as 200 with cache", cache);
    res.cache(cache);
    return res.send(200, result);
  };

  _callFinished = function() {
    var cache, hamKit, logger, params, req, res, result, send, singletonConfig;
    hamKit = arguments[0], cache = arguments[1], singletonConfig = arguments[2], params = arguments[3], res = arguments[4], req = arguments[5], result = 7 <= arguments.length ? __slice.call(arguments, 6) : [];
    logger = singletonConfig.log;
    if (result.length === 0) {
      result = null;
    }
    if (result.length === 1) {
      result = result[0];
    }
    if (result instanceof Error) {
      logger.error("calling", hamKit['call'], "with", params, "returned", result);
      res.send({
        'description': 'internal error',
        'code': 500
      }, 500);
      return;
    }
    send = _sendResponse.bind(this, hamKit, cache, singletonConfig, params, res, req);
    if (hamKit.resultProcessor != null) {
      return hamKit.resultProcessor(send, result, singletonConfig, req);
    } else {
      return send(result);
    }
  };

  _payload = function(params, hamKit, swaggerInstance, cache, singletonConfig, req, res) {
    var hamMethod, logger, propId, realCall, _i, _ref;
    logger = singletonConfig.log;
    logger.debug("calling", hamKit['call'], "with", params);
    hamMethod = hamKit.ham;
    realCall = hamKit['call'][hamKit['call'].length - 1];
    for (propId = _i = 0, _ref = hamKit['call'].length - 1; 0 <= _ref ? _i < _ref : _i > _ref; propId = 0 <= _ref ? ++_i : --_i) {
      hamMethod = hamMethod[hamKit['call'][propId]];
    }
    return hamMethod[realCall].apply(hamMethod, params);
  };

  _polishParams = function(params, hamKit, swaggerInstance, cache, singletonConfig, req, res, index, value) {
    var i, param, polishedParams, _i, _len;
    if (index != null) {
      params[index].val = value;
      params[index].dataFilter = null;
    }
    polishedParams = [];
    for (i = _i = 0, _len = params.length; _i < _len; i = ++_i) {
      param = params[i];
      if (param.dataFilter != null) {
        param.dataFilter(_polishParams.bind(null, params, hamKit, swaggerInstance, cache, singletonConfig, req, res, i), param.val, singletonConfig, swaggerInstance, req, i);
        return;
      }
      polishedParams[i] = param.val;
    }
    return _payload(polishedParams, hamKit, swaggerInstance, cache, singletonConfig, req, res);
  };

  _prepareParams = function(collectParams, hamKit, swaggerInstance, cache, singletonConfig, req, res) {
    var callbackPosition, collectedParams, err, i, logger, name, param, params, specs, val, _i, _len, _ref;
    logger = singletonConfig.log;
    collectedParams = {};
    for (name in collectParams) {
      specs = collectParams[name];
      switch (specs.paramType) {
        case "query":
          collectedParams[name] = req.query[name];
          break;
        case "path":
          collectedParams[name] = req.params[name];
          break;
        case "body":
          collectedParams[name] = req.body;
          break;
        case "form":
          collectedParams[name] = req.params[name];
          break;
        case "header":
          collectedParams[name] = req.header(name);
      }
      if ((specs.required != null) && (collectedParams[name] == null)) {
        logger.warn("param " + name + " is required, but not given!");
        throw swaggerInstance.errors.invalid(name);
      }
      if (specs.typeModel != null) {
        try {
          specs.typeModel.validate(collectedParams[name]);
        } catch (_error) {
          err = _error;
          logger.debug("validation error at param " + name + ": ", err);
          logger.warn("param " + name + " doesn't match its model " + specs.type);
          throw swaggerInstance.errors.invalid(name);
        }
      } else if (specs.type === 'boolean') {
        if (collectedParams[name] === 'false') {
          collectedParams[name] = false;
        } else {
          collectedParams[name] = true;
        }
      }
    }
    params = [];
    callbackPosition = -1;
    _ref = hamKit.params;
    for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
      param = _ref[i];
      if (param === 'callback') {
        params.push('callback');
        callbackPosition = i;
        continue;
      }
      val = collectedParams[param];
      if ((collectParams[param].dataFilter != null) && (val != null)) {
        params.push({
          val: val,
          dataFilter: collectParams[param].dataFilter
        });
      } else {
        params.push({
          val: val,
          dataFilter: null
        });
      }
    }
    if (callbackPosition === -1) {
      throw new Error("plz include 'callback' in the `callParams`");
    }
    params[callbackPosition] = {
      val: _callFinished.bind(this, hamKit, cache, singletonConfig, params, res, req),
      dataFilter: null
    };
    return _polishParams(params, hamKit, swaggerInstance, cache, singletonConfig, req, res);
  };

  _runValidators = function(execPayload, validators, swagger, singletonConfig, index, req, res, next, prevRes) {
    if ((prevRes != null) && (typeof prevRes !== 'boolean' || !prevRes)) {
      res.send(403, {
        message: "forbidden",
        code: 403
      });
      return;
    }
    if (validators.length - index <= 0) {
      execPayload(req, res);
      return;
    }
    return validators[index].validator(_runValidators.bind(this, execPayload, validators, swagger, singletonConfig, index + 1, req, res, null), swagger, singletonConfig, req, req.url.split('?')[0].replace(".json", "").replace(/{.*\}/, "*"), req.method);
  };

  _createCallConfig = function(method, route, routeConfig, ham, swaggerInstance, singletonConfig, pathPrefix) {
    var cache, conf, execPayload, hamKit, item, logger, model, name, params, specs, _i, _len, _ref, _ref1, _ref2, _ref3, _ref4, _ref5;
    logger = singletonConfig.log;
    conf = {
      spec: {
        path: route,
        method: method,
        nickname: routeConfig['call'][routeConfig['call'].length - 1],
        pathPrefix: pathPrefix
      }
    };
    _ref = ['summary', 'notes', 'type', 'description', 'nickname'];
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      item = _ref[_i];
      if (routeConfig[item] != null) {
        conf.spec[item] = routeConfig[item];
      }
    }
    if ((routeConfig.params != null) && Object.keys(routeConfig.params).length > 0) {
      conf.spec.parameters = [];
      conf.spec.errorResponses = [];
      _ref1 = routeConfig.params;
      for (name in _ref1) {
        specs = _ref1[name];
        if (specs.required == null) {
          specs.required = true;
        }
        if (specs.paramType == null) {
          specs.paramType = "query";
        }
        params = [name, specs.description, specs.type];
        if ((_ref2 = specs.paramType) === "query" || _ref2 === "header") {
          params.push(specs.required);
        }
        if ((_ref3 = specs.paramType) === "query" || _ref3 === "path" || _ref3 === "form") {
          params.push(specs["enum"]);
        }
        if ((_ref4 = specs.paramType) === "query" || _ref4 === "path" || _ref4 === "body" || _ref4 === "form") {
          params.push(specs["default"]);
        }
        conf.spec.parameters.push((_ref5 = swaggerInstance.params)[specs.paramType].apply(_ref5, params));
        conf.spec.errorResponses.push(swaggerInstance.errors.invalid(name));
        if (swaggerInstance.getModels[specs.type] != null) {
          model = swaggerInstance.getModels[specs.type];
          specs.typeModel = require('json-gate').createSchema(require("./swagger-jack-swagger2jsonschema").convertModel(model, model.properties ? model : swagger.models[specs.type]));
        }
      }
    } else {
      routeConfig.params = {};
    }
    if (routeConfig['params'] == null) {
      routeConfig['params'] = {};
    }
    if (routeConfig['callParams'] == null) {
      routeConfig['callParams'] = [];
    }
    hamKit = {
      params: routeConfig['callParams'],
      ham: ham,
      call: routeConfig['call'],
      resultProcessor: routeConfig['resultProcessor']
    };
    cache = "no-cache";
    if (typeof routeConfig['cache'] === 'number' && routeConfig['cache'] > 0) {
      cache = "max-age=" + routeConfig['cache'];
    }
    execPayload = _prepareParams.bind(null, routeConfig['params'], hamKit, swaggerInstance, cache, singletonConfig);
    conf.action = _runValidators.bind(swaggerInstance, execPayload, require(__dirname + "/swagger/validators"), swaggerInstance, singletonConfig, 0);
    logger.debug(conf);
    return conf;
  };

  module.exports = function(swaggerInstance, routes, ham, singletonConfig, pathPrefix) {
    var content, method, route, _i, _len, _ref;
    for (route in routes) {
      content = routes[route];
      _ref = ['GET', 'POST', 'PUT', 'DELETE'];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        method = _ref[_i];
        if (content[method] != null) {
          swaggerInstance['add' + method](_createCallConfig(method, route, content[method], ham, swaggerInstance, singletonConfig, pathPrefix));
        }
      }
    }
    return swaggerInstance;
  };

}).call(this);

//# sourceMappingURL=../../lib/__simpleREST/createSwaggerRoutes.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */