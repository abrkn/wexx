import { EventEmitter } from 'events';
import createDebugger from 'debug';
import assert from 'assert';
import { inspect } from 'util';

const debug = createDebugger('wex:server');

export default class Client extends EventEmitter {
  constructor(socket) {
    super();

    this.socket = socket;
    this.socket.on('close', this.onSocketClose);
    this.socket.on('message', this.onSocketMessage);
    this.socket.on('error', this.onSocketError);
  }

  send(message) {
    debug(`--> ${inspect(message)}`);
    this.socket.send(JSON.stringify(message));
  }

  onSocketMessage = (raw) => {
    // TODO: Flags?
    const message = JSON.parse(raw); // TODO: Error check
    debug(`<-- ${inspect(message)}`);


    // TODO: Validate message fields

    assert(message.params, 'params missing');
    assert(message.method, 'method missing');

    this.emit('message', message);
  };

  onSocketClose = () => {
    debug('close');
    this.emit('close');
  };

  onSocketError = (error) => {
    debug('wut error', error);
  };
}
