import { EventEmitter } from 'events';
import createDebugger from 'debug';

const debug = createDebugger('wex:server');

export default class Context extends EventEmitter {
  constructor({ application, client, message }) {
    super();
    this.time = new Date();
    this.message = message;
    this.application = application;
    this.message = message;
    this.client = client;
  }
}
