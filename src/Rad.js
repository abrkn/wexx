import assert from 'assert';
import Application from './Application';
import Router from './Router';

function createApplication({ wss }) {
  const application = new Application();

  const router = new Router();
  application.use(router.routes());

  application.addRoute = router.add.bind(router);
  application.wss = wss;

  wss.on('connection', application.accept.bind(application));

  return application;
}

export default createApplication;
