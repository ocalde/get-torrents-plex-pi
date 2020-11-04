const Koa = require('koa');
const bodyparser = require('koa-bodyparser');
const routes = require('./routes');

const server = new Koa({});

server.use(bodyparser());
server.use(routes());

module.exports = server;
