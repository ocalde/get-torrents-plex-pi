const Router = require('@koa/router');
const WebTorrent = require('webtorrent');
const bunyan = require('bunyan');
const path = require('path');
const asyncBusboy = require('async-busboy');
const { isEmpty, isArguments } = require('lodash');
const { URL } = require('url');
const got = require('got');
const { file } = require('tmp-promise');
const zlib = require('zlib');
const unzipper = require('unzipper');

const fs = require('fs').promises;
const fsOld = require('fs');
const { SERVER_PREFIX } = process.env;
const log = bunyan.createLogger({
	name: "myapp",
	streams: [{
		level: 'info',
		formatter: "pretty",
		path: `${process.env.LOGS_PATH}/logs.txt`
	}], src: true
});

const client = new WebTorrent();

const router = new Router({ prefix: SERVER_PREFIX, sensitive: false });

client.on('error', (err) => {
	log.error(err);
});

router.get('/progress', async (ctx, next) => {

	const torrentsProgress = client.torrents.map(torrent => ({
		name: torrent.name,
		progress: torrent.progress,
		isDone: torrent.done
	}));

	ctx.body = torrentsProgress;
	ctx.set('content-type', 'application/json');
	ctx.status = 200;
	next();
});

router.post('/download', async (ctx, next) => {
	const { files, fields } = await asyncBusboy(ctx.req);
	const { torrentURL, srtURL, srtLanguage, torrentName } = fields;

	const torrentFile = files.find(file => file.fieldname === 'torrentFile');
	const srtFile = files.find(file => file.fieldname === 'srtFile');

	try {
		!isEmpty(torrentURL) ? new URL(torrentURL) : null;
	} catch (err) {
		ctx.throw(400, 'Invalid URL for torrent');
	}

	try {
		!isEmpty(srtURL) ? new URL(srtURL) : null;
	} catch (err) {
		ctx.throw(400, 'Invalid URL for srt');
	}

	//TODO read a torrent file as well
	let torrentId = !isEmpty(torrentURL) ? torrentURL : torrentFile.path;
	let srt = !isEmpty(srtURL) ? new URL(srtURL) : srtFile.path;

	const pathToStore = `${process.env.PLEX_BASE_PATH}`;

	const torrentOptions = {
		path: pathToStore
	}

	client.add(torrentId, torrentOptions, async (torrent) => {
		log.info(`Torrent [${torrentName || torrent.name}] has started downloading`);

		torrent.on('done', async () => {
			const oldPath = `${torrent.path}${path.sep}${torrent.name}`;
			const newPath = `${torrent.path}${path.sep}${torrentName}`;

			await fs.rename(oldPath, newPath);

			cleanupUnusedFiles(newPath);

			addSrt(srt, newPath, torrentName, srtLanguage);

			client.remove(torrent.infoHash);
		});
	});

	ctx.body = 'Torrent scheduled for downloading';
	ctx.status = 202;
	next();
});

const addSrt = async (srt, downloadPath, downloadName, language) => {
	let srtPath = srt;
	let contentType;
	if (srt instanceof URL) {
		const response = await got(srt);

		const { path, fd, cleanup } = await file();
		await fs.appendFile(path, response.rawBody);
		srtPath = path;
		contentType = response.headers['content-type'];
	}

	if (contentType.match(/\/zip/)) {
		const tempSrtPath = `${downloadPath}${path.sep}tmp`;
		fsOld.createReadStream(srtPath)
			.pipe(unzipper.Extract({ path: tempSrtPath, })
				.on('close', async () => {
					const subtitles = await fs.readdir(tempSrtPath);
					fs.rename(`${tempSrtPath}${path.sep}${subtitles[0]}`, `${downloadPath}${path.sep}${downloadName}.${language}.srt`);
					fs.rmdir(tempSrtPath);
				}));

		// zlib.unzip(fs.readFile(srtPath), (err, buffer) => {

		// 	fs.appendFile(`${downloadPath}${path.sep}elsrt.srt`, buffer);
		// });
	}

};

const cleanupUnusedFiles = async (downloadPath) => {
	const files = await fs.readdir(downloadPath);
	files.forEach(file => {
		if (file.match(/png|jpg|gif|srt/)) {
			fs.unlink(`${downloadPath}${path.sep}${file}`);
		}
	});
};

module.exports = router;
