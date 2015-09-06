###*
 * Code initially released under MIT by worldline for swagger-jack, see
 *   https://github.com/worldline/swagger-jack/blob/master/src/validator.coffee
 *
 * Copied and modified by Manuel Schneider <scriptlets@efreetsystems.de> for simpleREST.
###

_ = require('underscore')
utils = require('./swagger-jack-utils')
createSchema = require('json-gate').createSchema

# Convert a swagger type to a json-gate type.
#
# @param swaggerType [String] type found in swagger descriptor
# @param parameter [String] parameter name, for understandabe errors
# @param allowMultiple [Boolean] true if this parameter may have multiple values
# @param models [Object] associative array containing all possible models, model id used as key.
# @return the corresponding json-gate type.
# @throws an exception if the swagger type has no json-gate equivalent
convertType = (swaggerType, parameter, allowMultiple, models) ->
  unless swaggerType?
    throw new Error("No type found for parameter #{parameter}")
  # manage uninon types: may be a primitive, name of a model, or an anonymous model
  if _.isArray(swaggerType)
    return _.map(swaggerType, (type, i) ->
      if _.isObject(type)
        # anonymous model: register it inside models with a generated name
        id = utils.generate()
        type.id = id
        delete type.type
        swaggerType[i] = id
        models[id] = type
        type = id
      return convertType(type, parameter, allowMultiple, models)
    )

  lowerType = swaggerType.toLowerCase()
  type = null
  if allowMultiple
    type = 'array'
  else
    switch lowerType
      when 'int', 'long', 'integer' then type = 'integer'
      when 'float', 'double', 'number' then type = 'number'
      when 'string', 'boolean', 'array', 'any', 'null', 'object' then type = lowerType
      when 'byte', 'file' then type = 'file'
      else
        if swaggerType of models
          type = 'object'
        else
          throw new Error("Unsupported type#{if parameter? then " for parameter #{parameter}" else ''}: #{swaggerType}")
  return type

# Convert a swagger model to a json-gate model.
# The swagger model references are resolved, and `allowableValues` are converted to `enum` or `min` + `max`.
#
# @param models [Object] associative array containing all possible models, model id used as key.
# @param model [Object] the converted model
# @param _stack: [Array] internal usage: _stack to avoid circualr dependencies
# @return the corresponding json-gate schema
# @throws an error if a circular reference is detected
module.exports.convertModel = convertModel = (models, model, _stack) ->
  result = {
    properties: {}
    additionalProperties: if _.isObject(model.additionalProperties) then model.additionalProperties else false
  }
  _stack ?= []
  # track circular references
  if model.id?
    if -1 isnt _stack.indexOf(model.id)
      _stack.push(model.id)
      throw new Error("Circular reference detected: #{_stack.join(' > ')}")
    _stack.push(model.id)

  # copy properties of the swagger model into the json-gate model
  _.extend(result.properties, model.properties)
  # perform property level conversion
  for name, prop of result.properties
    _.extend(prop, model.properties[name])
    # convert allowableValues
    if prop.allowableValues?.valueType?
      switch prop.allowableValues.valueType.toLowerCase()
        when 'range'
          if prop.allowableValues.min? and prop.allowableValues.max?
            prop.minimum = prop.allowableValues.min
            prop.maximum = prop.allowableValues.max
            if prop.minimum > prop.maximum then throw new Error "min value should not be greater tha max value in #{name}"
          else
            throw new Error "missing allowableValues.min and/or allowableValues.max parameters for allowableValues.range of #{name}"
          delete prop.allowableValues
        when 'list'
          if prop.allowableValues.values? and _.isArray(prop.allowableValues.values)
            prop.enum = prop.allowableValues.values
          else
            throw new Error "allowableValues.values is missing or is not an array for allowableValues.list of #{name}"
          delete prop.allowableValues

    # resolve references
    ltype = if _.isString(prop.type) then prop.type.toLowerCase() else ''
    if prop.type of models
      # type is a model id
      _.extend(prop, convertModel(models, models[prop.type], _stack))
      prop.type = 'object'
    else if ltype in ['list', 'set', 'array'] and prop.items?.$ref?
      # for lists, sets and arrays, items.$ref hold the referenced model id
      _.extend(prop.items, convertModel(models, models[prop.items.$ref], _stack))
      delete prop.items.$ref
      prop.items.type = 'object'
      prop.type = 'array'
    else if ltype is 'object'
      # recursive properties
      _.extend(prop, convertModel(models, prop, _stack))
    else
      # convert primitive type
      prop.type = convertType(prop.type, null, false, models)

  return result
