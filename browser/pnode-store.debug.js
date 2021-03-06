(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],3:[function(require,module,exports){
var process=require("__browserify_process");// Generated by CoffeeScript 1.6.3
var EventEmitter, Store, deref, dotOp, parse, parsePath, pathify, stores,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

EventEmitter = require('events').EventEmitter;

stores = {};

exports.name = 'store';

exports.fn = function(opts) {
  if (stores[this.id]) {
    return stores[this.id];
  }
  return stores[this.id] = new Store(this, opts);
};

Store = (function(_super) {
  __extends(Store, _super);

  function Store(peer, opts) {
    var exposed, preload, preloads, _base, _base1, _base2,
      _this = this;
    this.peer = peer;
    if (typeof opts === 'string') {
      opts = {
        name: opts
      };
    }
    this.opts = opts;
    if ((_base = this.opts).read == null) {
      _base.read = true;
    }
    if ((_base1 = this.opts).write == null) {
      _base1.write = true;
    }
    if ((_base2 = this.opts).debug == null) {
      _base2.debug = false;
    }
    if (this.opts.debug) {
      this.on('change', function(path, val) {
        return console.log("pnode-store: change: '%s':", path, val);
      });
    }
    this.channel = "_store-" + opts.name;
    this.obj = {};
    if (this.opts.write) {
      exposed = {};
      exposed[opts.name] = this.peer.exposeDynamic(function() {
        return _this.obj;
      });
      this.peer.expose({
        _store: exposed
      });
    }
    if (this.opts.read) {
      preloads = [];
      preload = function(remote) {
        var obj, _ref;
        obj = (_ref = remote._store) != null ? _ref[opts.name] : void 0;
        if (typeof obj !== 'object') {
          return;
        }
        if (preloads.indexOf(obj) >= 0) {
          return;
        }
        _this.set([], obj, true);
        preloads.push(obj);
      };
      if (this.peer.name === 'Client') {
        this.peer.server(preload);
      } else if (this.peer.name === 'Server' || this.peer.name === 'LocalPeer') {
        this.peer.all(function(remotes) {
          return remotes.forEach(preload);
        });
      }
      this.peer.on('remote', preload);
      this.peer.subscribe(this.channel, function(path, doDelete, value) {
        return _this.set(path, (doDelete ? void 0 : value), true);
      });
    }
    return;
  }

  Store.prototype.object = function() {
    return this.obj;
  };

  Store.prototype.set = function(path, value, silent) {
    var k, v;
    if (!(path instanceof Array)) {
      throw new Error("set(path) must be an array");
    }
    if (path.length === 0) {
      if (typeof value === 'object') {
        for (k in value) {
          v = value[k];
          this.set([k], v);
        }
        return;
      } else {
        throw new Error("set(path, " + value + ") array must be at least one property long");
      }
    }
    return this.setAcc(this.obj, [], path, value, silent);
  };

  Store.prototype.setAcc = function(obj, used, path, value, silent) {
    var doDelete, prop;
    prop = path.shift();
    if (!prop) {
      throw new Error("property missing ([" + (used.join(',')) + "])");
    }
    used.push(prop);
    if (path.length > 0 && typeof obj[prop] === 'object') {
      return this.setAcc(obj[prop], used, path, value, silent);
    }
    doDelete = value === void 0;
    if (doDelete) {
      delete obj[prop];
    } else {
      obj[prop] = value;
    }
    if (!silent && this.opts.write) {
      this.peer.publish(this.channel, used, doDelete, value);
    }
    return this.emit('change', used, value);
  };

  Store.prototype.del = function(path) {
    return this.set(path);
  };

  Store.prototype.get = function(path) {
    var o;
    o = this.obj;
    while (path.length) {
      o = o[path.shift()];
    }
    return o;
  };

  return Store;

})(EventEmitter);

dotOp = function(path) {};

deref = function(o, pathArr, create) {
  var prop;
  while (pathArr.length) {
    prop = pathArr.shift();
    if (!o[prop]) {
      if (!create) {
        return;
      }
      o[prop] = {};
    }
    o = o[prop];
  }
  return o;
};

pathify = function(prop) {
  if (/^\d+$/.test(prop)) {
    return "[" + prop + "]";
  } else if (/^\d/.test(prop) || /[^\w]/.test(prop)) {
    return "['" + prop + "']";
  } else {
    return prop;
  }
};

parse = function(str) {
  var e, eq, json, pathStr, val;
  eq = str.indexOf("=");
  if (eq === -1) {
    return;
  }
  json = str.substr(eq + 1);
  pathStr = str.substr(0, eq);
  val;
  if (json) {
    try {
      val = JSON.parse(json);
    } catch (_error) {
      e = _error;
      e.message = "JSON Error: " + e.message;
      throw e;
    }
  }
  return {
    path: parsePath(pathStr),
    val: val
  };
};

parsePath = function(str) {
  var p, path;
  if (str === '') {
    return [];
  }
  if (!/^(\.|\[)/.test(str)) {
    str = '.' + str;
  }
  path = [];
  while (/^(\[(\d+)\]|\[\'([^']+)\'\]|\.([a-zA-Z]\w+))/.test(str)) {
    p = RegExp.$2 || RegExp.$3 || RegExp.$4;
    str = str.replace(RegExp.$1, "");
    path.push(p);
  }
  return path;
};

if (process.browser) {
  window.pnodeStore = module.exports;
}

},{"__browserify_process":2,"events":1}]},{},[3])