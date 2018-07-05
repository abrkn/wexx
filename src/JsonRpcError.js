class JsonRpcError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.constructor = JsonRpcError;
    this.__proto__ = JsonRpcError.prototype;

    const { code = -32000, data, request } = options;

    this.code = code;
    this.data = data;
    this.request = request;
  }

  toJSON() {
    const result = {
      message: this.message,
      code: this.code,
    };

    if (this.data) {
      result.data = this.data;
    }

    if (this.request) {
      result.request = this.request;
    }

    return result;
  }
}

module.exports = JsonRpcError;
