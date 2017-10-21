const Promise = require('bluebird');
const assert = require('assert');
const { EventEmitter } = require('events');
const createDebugger = require('debug');

const isBrowser = typeof window !== 'undefined';
const WebSocket = isBrowser ? window.WebSocket : require('ws');

const debug = createDebugger('wexx:client');

class Client extends EventEmitter {
  constructor(socket) {
    assert(socket);
    super();
    this.socket = socket;
    this.socket.onmessage = this.onSocketMessage.bind(this);
    this.socket.onclose = this.onSocketClose.bind(this);
    // this.socket.onerror = this.onSocketError.bind(this);
    this.requestCounter = 0;
    this.requests = {};
  }

  onSocketClose() {
    debug('closed');

    this.emit('close');
    this.socket = null;

    const error = new Error('Connection closed during request');
    Object.keys(this.requests).forEach(id => this.requests[id].reject(error));
    this.requests = {};
  }

  onSocketMessage({ data: raw }) {
    debug(`<-- ${raw}`);

    const message = JSON.parse(raw);

    const { id, result, error } = message;

    if (!id) {
      this.emit('notification', message);
      // this.emit('errorNotification', message);
      return;
    }

    assert(
      result !== undefined || error !== undefined,
      'result and error missing'
    );
    assert(
      result === undefined || error === undefined,
      'both result and error defined'
    );

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
  }

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

Client.connect = async (endpoint, options = {}) => {
  return await new Promise((resolve, reject) => {
    debug(`connecting to ${endpoint}...`);

    const ws = new WebSocket(endpoint, options.ws);

    const onOpen = () => {
      debug('connected!');
      removeListeners();
      const client = new Client(ws);
      resolve(client);
    };

    const onClose = () => {
      debug('closed before connected');
      reject();
      removeListeners();
    };

    const onError = error => {
      debug(`connect failed: ${error.message}`);
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
};

module.exports = Client;
