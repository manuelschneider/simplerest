/**
 * Code initially released under MIT by worldline for swagger-jack, see
 *   https://github.com/worldline/swagger-jack/blob/master/src/validator.coffee
 *
 * Copied and modified by Manuel Schneider <scriptlets@efreetsystems.de> for simpleREST.
*/


(function() {
  var convertModel, convertType, createSchema, utils, _;

  _ = require('underscore');

  utils = require('./swagger-jack-utils');

  createSchema = require('json-gate').createSchema;

  convertType = function(swaggerType, parameter, allowMultiple, models) {
    var lowerType, type;
    if (swaggerType == null) {
      throw new Error("No type found for parameter " + parameter);
    }
    if (_.isArray(swaggerType)) {
      return _.map(swaggerType, function(type, i) {
        var id;
        if (_.isObject(type)) {
          id = utils.generate();
          type.id = id;
          delete type.type;
          swaggerType[i] = id;
          models[id] = type;
          type = id;
        }
        return convertType(type, parameter, allowMultiple, models);
      });
    }
    lowerType = swaggerType.toLowerCase();
    type = null;
    if (allowMultiple) {
      type = 'array';
    } else {
      switch (lowerType) {
        case 'int':
        case 'long':
        case 'integer':
          type = 'integer';
          break;
        case 'float':
        case 'double':
        case 'number':
          type = 'number';
          break;
        case 'string':
        case 'boolean':
        case 'array':
        case 'any':
        case 'null':
        case 'object':
          type = lowerType;
          break;
        case 'byte':
        case 'file':
          type = 'file';
          break;
        default:
          if (swaggerType in models) {
            type = 'object';
          } else {
            throw new Error("Unsupported type" + (parameter != null ? " for parameter " + parameter : '') + ": " + swaggerType);
          }
      }
    }
    return type;
  };

  module.exports.convertModel = convertModel = function(models, model, _stack) {
    var ltype, name, prop, result, _ref, _ref1, _ref2;
    result = {
      properties: {},
      additionalProperties: _.isObject(model.additionalProperties) ? model.additionalProperties : false
    };
    if (_stack == null) {
      _stack = [];
    }
    if (model.id != null) {
      if (-1 !== _stack.indexOf(model.id)) {
        _stack.push(model.id);
        throw new Error("Circular reference detected: " + (_stack.join(' > ')));
      }
      _stack.push(model.id);
    }
    _.extend(result.properties, model.properties);
    _ref = result.properties;
    for (name in _ref) {
      prop = _ref[name];
      _.extend(prop, model.properties[name]);
      if (((_ref1 = prop.allowableValues) != null ? _ref1.valueType : void 0) != null) {
        switch (prop.allowableValues.valueType.toLowerCase()) {
          case 'range':
            if ((prop.allowableValues.min != null) && (prop.allowableValues.max != null)) {
              prop.minimum = prop.allowableValues.min;
              prop.maximum = prop.allowableValues.max;
              if (prop.minimum > prop.maximum) {
                throw new Error("min value should not be greater tha max value in " + name);
              }
            } else {
              throw new Error("missing allowableValues.min and/or allowableValues.max parameters for allowableValues.range of " + name);
            }
            delete prop.allowableValues;
            break;
          case 'list':
            if ((prop.allowableValues.values != null) && _.isArray(prop.allowableValues.values)) {
              prop["enum"] = prop.allowableValues.values;
            } else {
              throw new Error("allowableValues.values is missing or is not an array for allowableValues.list of " + name);
            }
            delete prop.allowableValues;
        }
      }
      ltype = _.isString(prop.type) ? prop.type.toLowerCase() : '';
      if (prop.type in models) {
        _.extend(prop, convertModel(models, models[prop.type], _stack));
        prop.type = 'object';
      } else if ((ltype === 'list' || ltype === 'set' || ltype === 'array') && (((_ref2 = prop.items) != null ? _ref2.$ref : void 0) != null)) {
        _.extend(prop.items, convertModel(models, models[prop.items.$ref], _stack));
        delete prop.items.$ref;
        prop.items.type = 'object';
        prop.type = 'array';
      } else if (ltype === 'object') {
        _.extend(prop, convertModel(models, prop, _stack));
      } else {
        prop.type = convertType(prop.type, null, false, models);
      }
    }
    return result;
  };

}).call(this);

//# sourceMappingURL=../../lib/__simpleREST/swagger-jack-swagger2jsonschema.js.map

/*! simplerest - v0.0.0 - 2015-09-07
* https://github.com/manuelschneider/simplerest
* Copyright (c) 2015 Manuel Schneider; All rights reserved. */