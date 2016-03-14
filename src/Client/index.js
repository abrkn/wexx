import Promise from 'bluebird';
import assert from 'assert';
import { EventEmitter } from 'events';
import createDebugger from 'debug';

const isBrowser = typeof window !== 'undefined';
const WebSocket = isBrowser ? window.WebSocket : require('ws');

const debug = createDebugger('wex:client');

export default class Client extends EventEmitter {
  requestCounter = 0;
  requests = {};

  constructor(socket) {
    assert(socket);
    super();
    this.socket = socket;
    this.onmessage = this.onSocketMessage;
    this.onclose this.onSocketClose;
  }

  static async connect(endpoint, options = {}) {
    return await new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint, options.ws);

      const onOpen = () => {
        removeListeners();
        const client = new Client(ws);
        resolve(client);
      };

      const onClose = () => {
        reject();
        removeListeners();
      };

      const onError = (error) => {
        reject(error);
        removeListeners();
      };

      const removeListeners = () => {
        ws.onopen = null;
        ws.onerror = null;
        ws.onclose = null;
      };

      ws.onopen = onOpen;
      ws.onerror = onError;
      ws.onclose = onClose;
    });
  }

  onSocketClose = () => {
    this.emit('close');
    this.socket = null;

    const error = new Error('Connection closed during request');
    Object.keys(this.requests).forEach(id => this.requests[id].reject(error));
    this.requests = {};
  };

  onSocketMessage = (raw) => {
    debug(`<-- ${raw}`);

    const message = JSON.parse(raw);

    const { id, result, error } = message;

    if (!id) {
      this.emit('notification', message);
      // this.emit('errorNotification', message);
      return;
    }

    assert(result !== undefined || error !== undefined, 'result and error missing');
    assert(result === undefined || error === undefined, 'both result and error defined');

    const handler = this.requests[id];
    assert(handler, `Unknown request id ${id}`);
    delete this.requests[id];

    const { resolve, reject } = handler;

    if (message.result !== undefined) {
      resolve(result);
      return;
    }

    assert(typeof error.message === 'string');

    const wrappedError = new Error(error.message);
    reject(wrappedError);
  };

  async request(method, first, ...rest) {
    assert(this.socket, 'disposed');

    let params;
    if (first === undefined) {
      params = [];
    } else if (rest.length) {
      params = [first, ...rest];
    } else {
      params = first;
    }

    const id = ++this.requestCounter;
    const raw = JSON.stringify({
      id,
      method,
      params,
    });

    debug(`--> ${raw}`);
    this.socket.send(raw);

    return new Promise((resolve, reject) => {
      this.requests[id] = { resolve, reject };
    });
  }

  close() {
    this.socket.close();
    this.socket = null;
  }
}
