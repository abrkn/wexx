try {
  require('babel-core/register');
  require('babel-polyfill');
} catch (error) {}

module.exports = require('./src/Socket');
