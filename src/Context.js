class Context {
  constructor({ application, client, message }) {
    this.time = new Date();
    this.message = message;
    this.application = application;
    this.message = message;
    this.params = message.params;
    this.method = message.method;
    this.client = client;
  }
}

module.exports = Context;
