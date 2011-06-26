// vim: ai set sw=2 ts=2

/**
 * Cloudcontrol API client
 *
 * URLS:
 * /user/ GET
 * /user/[user_name]/ GET, PUT, DELETE
 * /user/[user_name]/key/[key_id]/ POST, GET, DELETE
 *
 * /app/[app_name]/ GET, POST, PUT, DELETE
 * /app/[app_name]/user/ GET, POST, DELETE
 * /app/[app_name]/deployment/[deployment_name]/ GET, POST, PUT, DELETE
 * /app/[app_name]/deployment/[deployment_name]/[log_type]/ GET
 * /app/[app_name]/deployment/[dep_name]/worker/ GET, POST, DELETE
 * /app/[app_name]/deployment/[dep_name]/boxes/
 *
 * /billing/
 * /cron/
 *
 * @see http://bazaar.launchpad.net/~cloudcontrol/cctrl/trunk/files/head:/cctrl/
 * @see https://api.cloudcontrol.com/doc/
 */
var https = require("https")
  , exec = require("child_process").exec
  , POST = 'POST'
  , GET = 'GET'
  , PUT = 'PUT'
  , DELETE = 'DELETE'
  , CRUD = [POST, PUT, GET, DELETE]
  , STRUCTURE = {
    app: {
      _methods: [GET],
      _name: {
        _methods: CRUD,
        user: [GET, POST, DELETE],
        deployment: {
          _name: {
            _methods: CRUD,
            access: [GET],
            error: [GET],
            worker: [GET, POST, DELETE],
            boxes: [GET],
            addon: [GET]
          }
        }
      }
    },
    user: {
      _methods: [GET],
      _name: {
        _methods: [GET, PUT, DELETE],
        key: {
          _name: {
            _methods: [GET, POST, DELETE]
          }
        }
      }
    }
  }


function Cloudcontrol() {}
Cloudcontrol.create = function(options) {
  var self = new this()
  self.options = options
  self.host = 'api.cloudcontrol.com'
  self.protocol = 'https'
  self.token = ''

  // recursively add structure
  self.construct('/', self, STRUCTURE)

  return self
}
/**
 * Dynamically create the cloudcontrol API object model
 *
 * @param string path URL path for the API
 * @param object obj Add methods to this object
 * @param object structure Which methods have to be added
 *
 * @return object
 */
Cloudcontrol.prototype.construct = function construct(path, obj, structure) {
  var self = this

  // iterate over structure
  Object.keys(structure).forEach(function(item) {
    if (item === '_name') {
      // API endpoint takes a parameter eg (GET /app/APPNAME/)
      obj = become_a_function(obj, function(name) {
        return self.construct(path + name + '/', {}, structure[item])
      })
    } else if (item === '_methods') {
      // add methods (REST API so these are HTTP verbs) to API endpoint
      structure[item].forEach(function(method) {
        var _method = function(cb) {
              self.request({method: method, path: path}, function(err, result) {
                if (typeof cb === 'function') cb(err, result)
                else console.log(result)
              })
            }
          , method_name = 'get'

        switch(method) {
          case POST:
            method_name = 'create'
            break
          case DELETE:
            method_name = 'delete'
            break
          case PUT:
            method_name = 'update'
            break
        }
        obj[method_name] = function(cb) {
          if (self.isAuthorized()) _method(cb)
          else self.auth(function() {
            _method(cb)
          })
        }
      })
    } else {
      // this is just another element in the chain
      if (Array.isArray(structure[item])) structure[item] = {_methods: structure[item]}
      obj[item] = self.construct(path + item + '/', {}, structure[item])
    }
  })
  return obj
}
Cloudcontrol.prototype.curl = function curl(options, cb) {
  var self = this
    , cmd = 'curl -X ' + options.method
  Object.keys(options.headers).forEach(function(header) {
    cmd += ' -H \'' + header + ': ' + options.headers[header] + '\''
  })
  cmd += ' ' + self.protocol + '://' + self.host + options.path

  exec(cmd, function(err, result) {
    cb(err, result)
  })
}
Cloudcontrol.prototype.request = function request(options, cb) {
  var self = this
    , opts = {
        host: self.host,
        method: 'GET',
        path: '/',
      }
  if (self.isAuthorized()) {
    opts.headers = { Authorization: 'cc_auth_token="' + self.token + '"' }
  } else {
    opts.headers = {
      Authorization: 'Basic ' +
        new Buffer(self.options.user + ':' + self.options.pass).toString('base64')
    }
  }
  Object.keys(options).forEach(function(key) {
    opts[key] = options[key]
  })

  self.curl(opts, function(err, result) {
    if (err) return cb(err)
    try {
      result = JSON.parse(result)
    } catch(e) {
      err = new Error(result)
    }

    cb(err, result)
  })
}
Cloudcontrol.prototype.isAuthorized = function isAuthorized() {
  return this.token !== ''
}
Cloudcontrol.prototype.auth = function auth(cb) {
  var self = this

  self.request({path: '/token/', method: 'POST'}, function(err, token) {
    if (err) throw err
    self.token = token.token
    cb(err, token)
  })
}

exports.createClient = function createClient(options) {
  options = options || {}
  options.user = options.user || get_from_environment('email')
  options.pass = options.pass || get_from_environment('password')
  return Cloudcontrol.create(options)
}

/*
 * Make an object a function but preserve all existing keys
 */
function become_a_function(obj, fun) {
  var tmp = {}
  Object.keys(obj).forEach(function(key) {
    tmp[key] = obj[key]
  })
  obj = fun
  Object.keys(tmp).forEach(function(key) {
    obj[key] = tmp[key]
  })
  return obj
}
function get_from_environment(element) {
 return process.env['CCTRL_' + element.toUpperCase()]
}
