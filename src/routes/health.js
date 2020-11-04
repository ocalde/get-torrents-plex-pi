const Router = require('@koa/router');

const { SERVER_PREFIX } = process.env;

const router = new Router({ prefix: SERVER_PREFIX, sensitive: false });

router.get('/ping', async (ctx, res) => {
    ctx.body = 'pong';
    ctx.res.setHeader('X-something', 'pong');
});

module.exports = router;
