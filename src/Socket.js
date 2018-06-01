import assert from 'assert';
import { EventEmitter } from 'events';
import { inspect } from 'util';
import { has } from 'lodash';
import createDebug from 'debug';
import JsonRpcError from './JsonRpcError';

const debug = createDebug('wexx:Socket');

const MAX_INSPECT_LENGTH = 250;

export function monitorHeartbeat(ws) {
  const noop = () => {};
  let alive = true;

  const interval = setInterval(() => {
    if (!alive) {
      if (ws.terminate) {
        ws.terminate();
      } else {
        ws.close();
      }

      clearInterval(interval);
      return;
    }

    alive = false;

    if (ws.ping) {
      ws.ping(noop);
    } else {
      ws.send(JSON.stringify({ id: null, method: 'ping' }));
    }
  }, 30e3);

  return () => clearInterval(interval);
}

class JsonRpcSocket extends EventEmitter {
  constructor(socket) {
    super();

    this.socket = socket;
    this.socket.addEventListener('message', this.onSocketMessage.bind(this));
    this.socket.addEventListener('error', this.emit.bind(this, 'error'));
    this.socket.addEventListener('close', this.onSocketClose.bind(this));
    this.close = this.socket.close.bind(socket);

    this.requestCounter = 0;
    this.requests = {};

    this.stopMonitor = monitorHeartbeat(socket);
  }

  failAllRequestsWithError(error) {
    Object.keys(this.requests).forEach(id => this.requests[id].reject(error));
    this.requests = {};
  }

  onSocketClose(...args) {
    this.failAllRequestsWithError(
      new Error('Connection closed during request')
    );

    this.stopMonitor();
    this.emit('close', ...args);
  }

  onSocketMessage(event) {
    const raw = event.data;

    let message;

    try {
      message = JSON.parse(raw);
    } catch (error) {
      console.error(`Received invalid json: ${raw}`);

      this.send({
        id: null,
        error: {
          code: -32700,
          message: 'Parse error',
        },
      });

      return;
    }

    if (has(message, 'params') && typeof message.params !== 'object') {
      this.send({
        id: null,
        error: {
          code: -32600,
          message: 'params must be object',
        },
      });

      return;
    }

    debug(`<-- ${inspect(message).substr(0, MAX_INSPECT_LENGTH)}`);

    this.safeHandleMessage(message);
  }

  safeHandleMessage(message) {
    try {
      this.handleMessage(message);
    } catch (error) {
      console.error(`Failed to handle message: ${error.stack}`);

      this.send({
        id: message.id || null,
        error: new JsonRpcError('Failed to parse message').toJSON(),
      }).catch(console.error.bind(console));
    }
  }

  handleMessage(message) {
    this.emit('message', message);

    const { id, result, method, params, error } = message;
    assert(
      id === undefined ||
        id === null ||
        (typeof id === 'string' && id.length > 0),
      `Invalid id, ${id}`
    );

    // Result from a request
    if (id && result !== undefined) {
      assert(error === undefined);
      assert(method === undefined);
      assert(params === undefined);

      const handler = this.requests[id];

      if (!handler) {
        console.error(`Handler not found for request id ${id}`);
        return;
      }

      const { resolve } = handler;
      resolve(result);
      return;
    }

    // Error from a request
    if (id && error !== undefined) {
      assert(result === undefined);
      assert(method === undefined);
      assert(params === undefined);
      assert(error.message, 'Message missing from error');

      const handler = this.requests[id];

      if (!handler) {
        console.error(`Handler not found for request id ${id}`);
        return;
      }

      const { reject } = handler;

      const wrappedError = new JsonRpcError(error.message, {
        code: error.code,
        data: error.data,
      });
      reject(wrappedError);
      return;
    }

    // Notification
    if (!id && method !== undefined) {
      assert(error === undefined);
      assert(result === undefined);

      this.emit('notify', { method, params });
      return;
    }

    // Notification of error
    if (!id && error !== undefined) {
      assert(method === undefined);
      assert(result === undefined);
      assert(error.message, 'Message missing from error');

      const wrappedError = new JsonRpcError(error.message, {
        code: error.code,
        data: error.data,
      });

      this.emit('error', wrappedError);
      return;
    }

    // Request
    if (id && method !== undefined) {
      assert(error === undefined);
      assert(result === undefined);

      this.emit('request', { id, method, params });
      return;
    }

    throw new Error('Unhandled message');
  }

  async send(message) {
    debug(`--> ${inspect(message).substr(0, MAX_INSPECT_LENGTH)}`);

    return new Promise((resolve, reject) =>
      this.socket.send(
        JSON.stringify(
          Object.assign(
            {
              jsonrpc: '2.0',
            },
            message
          )
        ),
        error => (error ? reject(error) : resolve())
      )
    );
  }

  // TODO: Add timeout
  async request(method, params) {
    const id = (++this.requestCounter).toString();

    const message = {
      id,
      method,
    };

    if (params) {
      message.params = params;
    }

    const promise = new Promise((resolve, reject) => {
      this.requests[id] = { resolve, reject };
    });

    this.send(message);

    return promise;
  }

  async notify(method, params) {
    return this.send({ id: null, method, params });
  }
}

JsonRpcSocket.connect = async (endpoint, options = {}) => {
  return await new Promise((resolve, reject) => {
    debug(`Connecting to ${endpoint}...`);

    const ws = new WebSocket(endpoint, options.ws);

    const onOpen = () => {
      debug('Connected!');
      removeListeners();
      const client = new JsonRpcSocket(ws);
      resolve(client);
    };

    const onClose = () => {
      debug('Closed before connected');
      reject();
      removeListeners();
    };

    const onError = error => {
      debug(`Connect failed: ${error.message}`);
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

export default JsonRpcSocket;
