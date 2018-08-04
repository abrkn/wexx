import Socket from './Socket';
const { EventEmitter } = require('events');
const createDebugger = require('debug');

export const STATES = {
  WAITING: 'WAITING',
  CONNECTING: 'CONNECTING',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
};

const debug = createDebugger('wexx:RetryClient');

class RetryClient extends EventEmitter {
  constructor(endpoint, options = {}) {
    super();
    this.options = options;
    this.state = STATES.CLOSED;
    this.endpoint = endpoint;
    this.onClientClose = this.onClientClose.bind(this);
    this.connect();
  }

  get connected() {
    return this.state === STATES.OPEN;
  }

  connect() {
    if (this.state !== STATES.CLOSED) {
      throw new Error(`Cannot open unless closed. State is ${this.state}`);
    }

    debug(`connecting to ${this.endpoint}...`);

    this.state = STATES.CONNECTING;

    debug('with options', this.options);

    Socket.connect(
      this.endpoint,
      this.options
    )
      .then(client => {
        debug('open!');

        this.state = STATES.OPEN;

        client.on('close', this.onClientClose);
        client.on('error', this.onClientError);

        const proxyEvents = ['notify'];

        proxyEvents.forEach(event =>
          client.on(event, this.emit.bind(this, event))
        );

        this.client = client;
        this.emit('open');
      })
      .catch(error => {
        debug(`failed to connect: ${error.message}`);
        this.emit('connectError', error);
        this.state = 'CLOSED';
        this.retry();
      });
  }

  retry() {
    if (this.state !== STATES.CLOSED) {
      throw new Error(`Cannot retry unless closed. State is ${this.state}`);
    }

    this.state = STATES.WAITING;

    const interval = this.options.interval || 5e3;

    debug(`retrying connection in ${interval / 1e3}s...`);

    this.timer = setTimeout(() => {
      this.state = STATES.CLOSED;
      this.connect();
    }, interval);
  }

  onClientClose(error) {
    if (error) {
      debug(`connection closed with error: ${error.message}`);
      this.emit('close', error);
    } else {
      debug('connection closed');
    }
    this.state = STATES.CLOSED;
    this.retry();
  }

  onClientError(error) {
    debug(`connection error: ${error.message}`);
    this.emit('error', error);
    this.state = STATES.CLOSED;
    this.retry();
  }

  async request(...rest) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    return await this.client.request.call(this.client, ...rest);
  }

  async notify(...rest) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    return await this.client.notify.call(this.client, ...rest);
  }
}

export default RetryClient;
