import WebSocket from 'ws';
import findFreePort from 'find-free-port';
import JsonRpcSocket from './Socket';
import Application from './Application';
import Router from './Router';

describe('Application', () => {
  it('should be able to work as a calculator', async () => {
    const [port] = await findFreePort(3000);

    const listenAndWait = () =>
      new Promise((resolve, reject) => {
        const wss = new WebSocket.Server({ port });

        wss.on('connection', ws => resolve(new JsonRpcSocket(ws)));
        wss.on('error', reject);
      });

    const connectAndWait = () =>
      new Promise((resolve, reject) => {
        const ws = new WebSocket(`http://localhost:${port}`);

        ws.on('open', () => resolve(new JsonRpcSocket(ws)));
        ws.on('error', reject);
      });

    const [incoming, outgoing] = await Promise.all([
      listenAndWait(),
      connectAndWait(),
    ]);

    const app = new Application();
    const router = new Router();

    router.add('add', async (req, res) => {
      res.result(req.params.reduce((p, c) => p + c, 0));
    });

    app.use(router.routes());

    app.accept(incoming.socket, { user: null });

    const result = await outgoing.request('add', [1, 2, 3]);
    expect(result).toBe(6);

    outgoing.close();
    incoming.close();

    await Promise.all([
      new Promise(resolve => incoming.on('close', resolve)),
      new Promise(resolve => outgoing.on('close', resolve)),
    ]);
  });
});
