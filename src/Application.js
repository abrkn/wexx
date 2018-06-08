import Socket from './Socket';
import runMiddleware from './runMiddleware';
const { EventEmitter } = require('events');
const createDebugger = require('debug');
const assert = require('assert');
const { inspect } = require('util');
const JsonRpcError = require('./JsonRpcError');
const { pick } = require('lodash');

const debug = createDebugger('wexx:server');

class Application extends EventEmitter {
  constructor() {
    super();
    this.middleware = [];
    this.clients = [];
    this.use = this.middleware.push.bind(this.middleware);
    this.clientCounter = 0;
  }

  onClientRequest(client, message) {
    const req = {
      app: this,
      message,
      method: message.method,
      params: message.params,
      client,
    };

    const res = {};

    res.send = message => {
      assert(!res.sent);

      res.stop = true;
      res.sent = true;

      return req.client.send(message);
    };

    res.result = result => res.send({ id: message.id || null, result });

    res.error = error => {
      if (!(error instanceof JsonRpcError)) {
        console.error('Unhandled error when handling request');
        console.error('Message:');
        console.error(req.message);
        console.error('Error:');
        console.error(error.stack);

        if (process.env.NODE_ENV === 'production') {
          error = new JsonRpcError('Internal server error', {
            code: 'InternalServerError',
          });
        } else {
          error = new JsonRpcError(error.message, {
            code: 'InternalServerError',
          });
        }
      }

      return res.send({
        id: message.id || null,
        error: pick(error, 'message', 'code', 'data'),
      });
    };

    res.unhandled = () =>
      res.error(
        new JsonRpcError('Unhanled request', { code: 'UnhandledRequest' })
      );

    runMiddleware([...this.middleware.slice(), res.unhandled], req, res);
  }

  onClientClose(client, ...rest) {
    debug(`removing closed client from clients list`);
    const removed = !!this.clients.splice(this.clients.indexOf(client), 1);
    assert(removed, 'failed to remove closed client');
  }

  notifyAll(method, params = {}) {
    const message = { method, params };
    debug(
      `notifying all: ${inspect(message)} (${this.clients.length} clients)`
    );

    this.clients.forEach(client => {
      client.send(message);
    });
  }

  // TODO: Extract into a listener
  accept(socket) {
    debug('accepting client');

    const client = new Socket(socket);
    client.id = ++this.clientCounter;
    this.clients.push(client);
    client.on('request', this.onClientRequest.bind(this, client));
    client.on('close', this.onClientClose.bind(this, client));

    this.emit('accept', client);

    return client;
  }
}

module.exports = Application;
