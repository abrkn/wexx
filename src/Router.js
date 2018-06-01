const compose = require('composition');
const createDebugger = require('debug');

const debug = createDebugger('wexx:Router');

class Router {
  constructor() {
    this.methods = {};
  }

  add(method, ...fn) {
    this.methods[method] = compose(fn);
    return this;
  }

  routes() {
    const router = this;

    return function* dispatch(next) {
      const { method } = this.message;
      const route = router.methods[method];

      debug('routing %s', method);

      if (!route) {
        debug('no handler found for %s', method);
        return next;
      }

      debug('handler found for %s', method);

      return yield route.call(this);
    };
  }
}

module.exports = Router;
