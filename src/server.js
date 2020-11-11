const Koa = require('koa');
const bodyparser = require('koa-bodyparser');
const staticServer = require('koa-static');
const routes = require('./routes');

const server = new Koa({});

server.use(staticServer('src/static', {}))
server.use(bodyparser());
server.use(routes());

module.exports = server;
