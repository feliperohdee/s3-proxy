const _ = require('lodash');
const md5 = require('md5');
const got = require('got');
const mime = require('mime');

module.exports = class S3Proxy {
	constructor(s3, bucket, parsers = {}) {
		if(!s3) {
			throw new Error('missing s3 instance.');
		}

		if(!bucket) {
			throw new Error('missing bucket instance.');
		}

		this.s3 = s3;
		this.got = got;
		this.bucket = bucket;
		this.parsers = parsers;
	}

	get(args = {}) {
		const {
			base64 = true,
			folder = null,
			id = null,
			parser = null,
			src
		} = args;

		if(!src) {
			return Promise.reject(new Error('src missing.'));
		}

		const parserFn = this.parsers[parser] || _.identity;
		const hash = id || md5(base64 + parser + src);
		const splitted = src.split('.');
		const extension = splitted.length ? _.last(splitted).substring(0, 3) : null;
		const contentType = extension ? mime.lookup(extension) : 'application/octet-stream';

		let key = extension ? `${hash}.${extension}` : hash;

		if (folder) {
			key = `${folder}/${key}`;
		}

		return this.s3.getObject({
				Bucket: this.bucket,
				Key: key
			})
			.promise()
			.then(({
				Body
			}) => Body)
			.catch(err => {
				return this.got(src, {
						encoding: null
					})
					.then(({
						body
					}) => body)
					.then(body => {
						body = parserFn(body.toString());

						if (_.isString(body)) {
							return new Buffer(body);
						}

						return body;
					})
					.then(body => {
						return this.s3.putObject({
								Bucket: this.bucket,
								Key: key,
								Body: body,
								ContentType: contentType
							})
							.promise()
							.then(() => body)
							.catch(() => body);
					});
			})
			.then(response => this.parseResponse(response, base64));
	}

	parseResponse(data, base64 = true) {
		return base64 ? data.toString('base64') : data.toString();
	}
}
