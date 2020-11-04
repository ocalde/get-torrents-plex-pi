const combineRouters = require('koa-combine-routers');

const torrentRoutes = require('./torrent');
const healthRoutes = require('./health');

module.exports = combineRouters(torrentRoutes, healthRoutes);