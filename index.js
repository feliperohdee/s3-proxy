const _ = require('lodash');
const md5 = require('md5');
const AWS = require('aws-sdk');
const got = require('got');
const mime = require('mime');
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
		base64 = true,
		folder = null,
		id = null,
		parser = null,
		src
	} = event;
	
	const parserFn = parsers[parser] || _.identity;
	const hash = id || md5(base64 + folder + parser + src);
	const splitted = src.split('.');
	const extension = splitted.length ? _.last(splitted).substring(0, 3) : null;
	const contentType = extension ? mime.lookup(extension) : 'application/octet-stream';
	
	let key = extension ? `${hash}.${extension}` : hash;

	if(folder) {
		key = `${folder}/${key}`;
	}

	const returnsError = err => callback(err);
	const returns = data => callback(null, base64 ? data.toString('base64') : data.toString());

	s3.getObject({
			Bucket: bucket,
			Key: `proxy/${key}`
		})
		.promise()
		.then(({
			Body
		}) => Body)
		.catch(err => {
			if (err.name === 'NoSuchKey') {
				return got(src, {
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
								Key: `proxy/${key}`,
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
			src: 'https://d30y9cdsu7xlg0.cloudfront.net/noun-svg/1610.svg?Expires=1504795969&Signature=MA~gzzJ9-vxx37leSAq9kcij~nRaUmMapioDFLqt7wc7DudoHg-iw65PN0RISk~Wj2gIi8Elgs2cqd3n8wqCDuSk8HaOWks9q~itPvB-9dTSbQSIl0j8L2lHi-1KTdNxlNuWN8qIwc0uMhd9T3O143c8jUY~P~OvMjiJnyC4rV0_&Key-Pair-Id=APKAI5ZVHAXN65CHVU2Q',
			parser: 'svgWithFill',
			folder: 'icons/noun',
			id: 'bbq',
			base64: false
		}, null, console.log);
}
