const { EventEmitter } = require('events');
const createDebugger = require('debug');

const debug = createDebugger('wex:server');

class Context extends EventEmitter {
  constructor({ application, client, message }) {
    super();
    this.time = new Date();
    this.message = message;
    this.application = application;
    this.message = message;
    this.client = client;
  }
}

module.exports = Context;
