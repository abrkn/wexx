import WebSocket from 'ws';
import findFreePort from 'find-free-port';
import JsonRpcSocket from './Socket';

describe('Socket', () => {
  it('should be able to connect and close', async () => {
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

    outgoing.close();
    incoming.close();

    await Promise.all([
      new Promise(resolve => incoming.on('close', resolve)),
      new Promise(resolve => outgoing.on('close', resolve)),
    ]);
  });

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

    incoming.on('request', ({ id, method, params }) => {
      if (method === 'add') {
        incoming
          .send({ id, result: params.reduce((p, c) => p + c, 0) })
          .catch(console.log.bind(console));
        return;
      }

      throw new Error(`Unhandled request`);
    });

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
