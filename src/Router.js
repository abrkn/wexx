const assert = require('assert');
const createDebugger = require('debug');
const runMiddleware = require('./runMiddleware').default;

const debug = createDebugger('wexx:Router');

class Router {
  constructor() {
    this.methods = {};
  }

  add(method, ...fns) {
    this.methods[method] = fns;
    return this;
  }

  routes() {
    const router = this;

    return function dispatch(req, res, next) {
      assert(req);
      assert(res);

      const { method } = req;
      const route = router.methods[method];

      debug('routing %s', method);

      if (!route) {
        debug('no handler found for %s', method);
        return next();
      }

      runMiddleware(route, req, res, next);
    };
  }
}

module.exports = Router;
