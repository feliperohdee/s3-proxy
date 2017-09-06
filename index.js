const _ = require('lodash');
const md5 = require('md5');
const AWS = require('aws-sdk');
const got = require('got');
const mime = require('mime');
const {
	parse
} = require('url');

AWS.config.setPromisesDependency(Promise);
AWS.config.update({
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.SECRET_ACCESS_KEY,
	region: 'us-east-1'
});

const s3 = new AWS.S3();
const bucket = process.env.BUCKET || 'static.smallorange.co';

exports.handler = (event, context, callback) => {
	const {
		url
	} = event;

	const {
		path
	} = parse(url);

	const hash = md5(path);
	const splitted = url.split('.');
	const extension = splitted.length ? _.last(splitted) : null;
	const contentType = extension ? mime.lookup(extension) : 'application/octet-stream';
	const key = extension ? `${hash}.${extension}` : hash;

	const returnsError = err => callback(err);
	const returns = data => callback(null, data.toString('base64'));

	s3.getObject({
			Bucket: bucket,
			Key: `cache/s3Proxy/${key}`
		})
		.promise()
		.then(({
			Body
		}) => Body)
		.catch(err => {
			if (err.name === 'NoSuchKey') {
				return got(url, {
						encoding: null
					})
					.then(({
						body
					}) => body)
					.then(body => {
						return s3.putObject({
								Bucket: bucket,
								Key: `cache/s3Proxy/${key}`,
								Body: body,
								ContentType: contentType
							})
							.promise()
							.then(() => body);
					});
			}

			throw err;
		})
		.then(returns)
		.catch(returnsError);
};

if (process.env.NODE_ENV !== 'production') {
		require('./parseSvg')('http://snapsvg.io/assets/images/logo.svg')
			.then(console.log);

		// exports.handler({
		// 	url: 'https://www.google.com.br/logos/doodles/2017/cora-coralinas-128th-birthday-5770712995332096.2-scta.png'
		// }, null, console.log);
}
