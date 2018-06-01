class JsonRpcError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.constructor = JsonRpcError;
    this.__proto__ = JsonRpcError.prototype;

    const { code = -32000, data } = options;

    this.code = code;
    this.data = data;
  }

  toJSON() {
    const result = {
      message: this.message,
      code: this.code,
    };

    if (this.data) {
      result.data = this.data;
    }

    return result;
  }
}

module.exports = JsonRpcError;
