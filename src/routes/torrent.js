const Router = require('@koa/router');
const WebTorrent = require('webtorrent');
const bunyan = require('bunyan');

const fs = require('fs').promises;
const { SERVER_PREFIX } = process.env;
const log = bunyan.createLogger({name: "myapp",
	streams: [{
		        level: 'info',
		formatter: "pretty",
		    
		path: '/home/oscar/Documents/Projects/cosa2.txt'  // log ERROR and above to a file
		    }], src: true
});

const client = new WebTorrent();

const router = new Router({ prefix: SERVER_PREFIX, sensitive: false });

client.on('error', (err) => {
	console.log(err);
	console.log('Siuuuu');
});

router.get('/download', async (ctx, res) => {
	const torrentId = 'https://webtorrent.io/torrents/big-buck-bunny.torrent';
	const pathToStore = '/home/oscar/Documents/Plex/t1';

	const torrentOptions = {
		path: pathToStore
	}

	client.add(torrentId, torrentOptions, async (torrent) => {
		console.log('siuu Download has finished');
		delete torrent.client;
		log.info(torrent);	
		log.info('hola');
		//await fs.writeFile('/home/oscar/Documents/Projects/cosa.txt', JSON.stringify(torrent));
		setTimeout(() => {client.remove(torrent.torrentId); }, 10000);
	});

});

module.exports = router;
