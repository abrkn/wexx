const { EventEmitter } = require('events');
const createDebugger = require('debug');
const compose = require('composition');
const async = require('async');
const assert = require('assert');
const Client = require('./Client');
const Context = require('./Context');
const { inspect } = require('util');

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
      .then(null, error => {
        debug(`error from middleware:\n${error.stack}`);
        assert(context.respond !== false);
        assert(context.result === undefined);
        assert(context.error === undefined);
        context.error = 'Internal error';
        this.respondWithError.call(context);
      })
      .catch(error => {
        debug(`error in error handler:\n${error.stack}`);
      });
  }

  respondWithError() {
    let { error } = this;
    assert(error, 'error missing');

    if (typeof error === 'string') {
      error = { message: error };
    }

    this.client.send({
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
      this.application.respondWithError.call(this);
      return;
    }

    this.client.send({
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

  onClientClose(client) {
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

    return client;
  }
}

module.exports = Application;
