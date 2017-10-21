const tape = require('tape');
const tapePromise = require('tape-promise');
const { Client, Application, Router } = require('../src');
const { Server: WebSocketServer } = require('ws');

const test = tapePromise(tape);

test('calculator service', async t => {
  const port = 41782;

  // Calculator server
  const app = new Application();
  const router = new Router();

  router.add('sum', function sum() {
    this.result = this.message.params.reduce((p, c) => p + c, 0);
  });
  app.use(router.routes());
  const server = WebSocketServer({ port });
  server.on('connection', app.accept.bind(app));

  // Calculator client
  const client = await Client.connect(`ws://localhost:${port}/api`);
  const actual = await client.request('sum', [1, 2, 3]);
  t.equal(actual, 6);

  client.close();
  server.close();

  t.end();
});
