const { EventEmitter } = require('events');
const createDebugger = require('debug');
const assert = require('assert');
const { inspect } = require('util');

const debug = createDebugger('wex:server');

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
    // TODO: Flags?
    const message = JSON.parse(raw); // TODO: Error check
    debug(`<-- ${inspect(message)}`);

    // TODO: Validate message fields

    assert(message.params, 'params missing');
    assert(message.method, 'method missing');

    this.emit('message', message);
  }

  onSocketClose() {
    debug('close');
    this.emit('close');
  }

  onSocketError(error) {
    debug('wut error', error);
  }
}
module.exports = Client;
