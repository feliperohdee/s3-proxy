const _ = require('lodash');
const md5 = require('md5');
const AWS = require('aws-sdk');
const got = require('got');
const mime = require('mime');
const {
	parse
} = require('url');

const parsers = require('./parsers');

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
		url,
		parser = null,
		base64 = true
	} = event;

	const {
		path
	} = parse(url);
	
	const parserFn = parsers[parser] || _.identity;
	const hash = md5(path + parser + base64);
	const splitted = url.split('.');
	const extension = splitted.length ? _.last(splitted) : null;
	const contentType = extension ? mime.lookup(extension) : 'application/octet-stream';
	const key = extension ? `${hash}.${extension}` : hash;

	const returnsError = err => callback(err);
	const returns = data => callback(null, base64 ? data.toString('base64') : data.toString());

	s3.getObject({
			Bucket: bucket,
			Key: `cache/proxy/${key}`
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
						body = parserFn(body.toString());

						if(_.isString(body)){
							return new Buffer(body);
						}

						return body;
					})
					.then(body => {	
						return s3.putObject({
								Bucket: bucket,
								Key: `cache/proxy/${key}`,
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
		exports.handler({
			url: 'http://static.smallorange.co/svg/noun_1113211_cc.svg',
			parser: 'svg',
			base64: false
		}, null, console.log);
}
