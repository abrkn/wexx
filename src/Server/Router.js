import compose from 'composition';
import createDebugger from 'debug';

const debug = createDebugger('wex:server');

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

      return function dispatch(next) {
        const { method } = this.message;
        const route = router.methods[method];

        debug('routing %s', method);

        if (!route) {
          debug('no handler found for %s', method);
          return next;
        }

        debug('handler found for %s', method);

        return route.call(this);
      };
    }
}

export default Router;
