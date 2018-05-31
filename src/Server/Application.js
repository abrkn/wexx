const { EventEmitter } = require('events');
const createDebugger = require('debug');
const compose = require('composition');
const async = require('async');
const assert = require('assert');
const Client = require('./Client');
const Context = require('./Context');
const { inspect } = require('util');
const JsonRpcError = require('../JsonRpcError');
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

  handler(context) {
    const composed = compose([this.respond, ...this.middleware]);

    composed
      .call(context)
      .then(null, async error => {
        assert(context.respond !== false);
        assert(context.result === undefined);
        assert(context.error === undefined);

        if (!(error instanceof JsonRpcError)) {
          console.error('Unhandled error when handling request');
          console.error('Message:');
          console.error(context.message);
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

        context.error = pick(error, 'message', 'code', 'data');

        await this.respondWithError.call(context);
      })
      .catch(error => {
        debug(`error in error handler:\n${error.stack}`);
      });
  }

  async respondWithError() {
    let { error } = this;
    assert(error, 'error missing');

    if (typeof error === 'string') {
      error = { message: error };
    }

    await this.client.send({
      id: this.message.id,
      error,
    });
  }

  *respond(next) {
    // Run last
    yield next;

    assert(this.respond !== false);

    let { error } = this;
    const { result } = this;

    if (!error && this.result === undefined) {
      this.error = { message: 'Unhandled request' };
    }

    if (this.error) {
      yield this.application.respondWithError.call(this);
      return;
    }

    yield this.client.send({
      id: this.message.id,
      result,
    });
  }

  onClientMessage(client, message) {
    const context = new Context({
      client,
      message,
      application: this,
    });

    this.handler(context);
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

    const client = new Client(socket);
    client.id = ++this.clientCounter;
    this.clients.push(client);
    client.on('message', this.onClientMessage.bind(this, client));
    client.on('close', this.onClientClose.bind(this, client));

    this.emit('accept', client);

    return client;
  }
}

module.exports = Application;
