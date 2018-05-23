const { EventEmitter } = require('events');
const createDebugger = require('debug');
const assert = require('assert');
const { inspect } = require('util');
const { has, isPlainObject } = require('lodash');

const debug = createDebugger('wexx:server');

class Client extends EventEmitter {
  constructor(socket) {
    super();

    this.socket = socket;
    this.socket.on('close', this.onSocketClose.bind(this));
    this.socket.on('message', this.onSocketMessage.bind(this));
    this.socket.on('error', this.onSocketError.bind(this));
  }

  notify(method, params) {
    this.send({
      id: null,
      method,
      params,
    });
  }

  send(message) {
    debug(`--> ${inspect(message)}`);
    this.socket.send(JSON.stringify(message));
  }

  onSocketMessage(raw) {
    let message;

    try {
      message = JSON.parse(raw);
    } catch (error) {
      this.send({
        method: 'error',
        id: null,
        params: {
          code: -32700,
          message: 'Parse error',
        },
      });

      return;
    }

    if (!message.method) {
      this.send({
        method: 'error',
        id: null,
        params: {
          code: -32600,
          message: 'method missing',
        },
      });

      return;
    }

    if (has(message, 'params') && typeof message.params !== 'object') {
      this.send({
        method: 'error',
        id: null,
        params: {
          code: -32600,
          message: 'params must be object',
        },
      });

      return;
    }

    debug(`<-- ${inspect(message)}`);

    this.emit('message', message);
  }

  onSocketClose(...args) {
    debug('close', ...args);
    this.emit('close', ...args);
  }

  onSocketError(error) {
    console.error(`SOCKET ERROR: ${error.message}`);
    throw error;
  }
}

module.exports = Client;
