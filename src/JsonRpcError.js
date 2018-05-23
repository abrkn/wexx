class JsonRpcError extends Error {
  constructor(message, options = {}) {
    super(message);

    const { code = -32000, data } = options;

    this.code = code;
    this.data = data;
  }
}

module.exports = JsonRpcError;
