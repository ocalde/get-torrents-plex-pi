const Router = require('@koa/router');
const multer = require('@koa/multer');
const WebTorrent = require('webtorrent');
const bunyan = require('bunyan');
const path = require('path');
const { isEmpty } = require('lodash');
const { URL } = require('url');
const got = require('got');
const { file } = require('tmp-promise');
const unzipper = require('unzipper');
const upload = multer();


const fs = require('fs').promises;
const fsOld = require('fs');
const isNewTorrentValid = require('../schemas/newTorrent');
const { isValidURL } = require('../utils');
const { SERVER_PREFIX, PLEX_BASE_PATH, LOGS_PATH } = process.env;
const log = bunyan.createLogger({
	name: "myapp",
	streams: [{
		level: 'info',
		formatter: "pretty",
		path: `${LOGS_PATH}/logs.txt`
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
const torrentFieldsConfig = upload.fields([
	{
		name: 'torrentFile',
		maxCount: 1
	},
	{
		name: 'srtFile',
		maxCount: 1
	}
]);

router.get('/media/:mediaType', async (ctx, next) => {
	const mediaAssets = await fs.readdir(`${PLEX_BASE_PATH}/${ctx.request.params.mediaType}`);
	ctx.body = mediaAssets;
	next();
});

router.post('/srt', torrentFieldsConfig, async (ctx, next) => {

});

router.post('/torrent', torrentFieldsConfig, async (ctx, next) => {

	const { mediaType, torrentURL, srtURL, srtLanguage, torrentName } = ctx.request.body;
	const { torrentFile, srtFile } = ctx.files;

	if (!isNewTorrentValid(ctx.request.body)) {
		ctx.throw(400, 'Invalid torrent data');
	}

	if ((!isEmpty(torrentURL) && !isValidURL(torrentURL)) ||
		(!isEmpty(srtURL) && !isValidURL(srtURL))) {
		ctx.throw(400, 'Invalid torrent data');
	}

	let torrentId = !isEmpty(torrentURL) ? torrentURL : torrentFile.pop().buffer;
	let srt = !isEmpty(srtURL) ? new URL(srtURL) : (srtFile ? srtFile.pop().buffer : null);

	const pathToStore = `${PLEX_BASE_PATH}/${mediaType}`;

	const torrentOptions = {
		path: pathToStore
	}

	client.add(torrentId, torrentOptions, async (torrent) => {
		log.info(`Torrent [${torrentName || torrent.name}] has started downloading`);

		torrent.on('done', async () => {

			const newPath = await renameTorrent(torrent.path, torrent.name, torrentName);
			cleanupUnusedFiles(newPath);
			if(srt) {
				addSrt(srt, newPath, torrentName, srtLanguage);
			}

			try {
				client.remove(torrent.infoHash);
			} catch (err) {
				console.log('Error while trying to remove torrent');
				console.log(err.message);
			}
		});
	});

	ctx.body = 'Torrent scheduled for downloading';
	ctx.status = 202;
	next();
});

const renameTorrent = async (basePath, oldName, newName) => {
	const oldPath = `${basePath}${path.sep}${oldName}`;
	const newPath = `${basePath}${path.sep}${newName}`;

	await fs.rename(oldPath, newPath);
	return newPath;
}

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
					await fs.rename(`${tempSrtPath}${path.sep}${subtitles[0]}`, `${downloadPath}${path.sep}${downloadName}.${language}.srt`);
					fs.rmdir(tempSrtPath);
				}));

		// zlib.unzip(fs.readFile(srtPath), (err, buffer) => {

		// 	fs.appendFile(`${downloadPath}${path.sep}elsrt.srt`, buffer);
		// });
	}

};

const cleanupUnusedFiles = async (downloadPath) => {
	const files = await fs.readdir(downloadPath);
	
	const filesToDelete = files
		.filter(file => file.match(/png|jpg|gif|srt/))
		.map(file => fs.unlink(`${downloadPath}${path.sep}${file}`));
	
	await Promise.all(filesToDelete);
};

module.exports = router;
