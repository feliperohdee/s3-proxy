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
		this.parseResponse = this.parseResponse.bind(this);
	}

	get(args = {}) {
		const {
			folder = null,
			id = null,
			parser = null,
			src
		} = args;

		if(!src) {
			return Promise.reject(new Error('src missing.'));
		}

		let parserFn = this.parsers[parser] || _.identity;
		let key = id || md5(parser + src);

		if (folder) {
			key = `${folder}/${key}`;
		}

		return this.s3.getObject({
				Bucket: this.bucket,
				Key: key
			})
			.promise()
			.then(({
				Body,
				ContentType
			}) => ({
				body: Body,
				contentType: ContentType
			}))
			.catch(err => {
				return this.got(src, {
						encoding: null
					})
					.then(({
						body,
						headers
					}) => {
						let contentType = headers['content-type'];
						let isJson = contentType === 'application/json';

						body = parserFn(body.toString(), contentType);;

						if (_.isObject(body) && !_.isBuffer(body) && !isJson) {
							body = JSON.stringify(body);
							contentType = 'application/json';
						}

						if (_.isString(body)) {
							body = new Buffer(body);
						}

						return {
							body,
							contentType
						};
					})
					.then(({
						body,
						contentType
					}) => {
						return this.s3.putObject({
								Bucket: this.bucket,
								Key: key,
								Body: body,
								ContentType: contentType
							})
							.promise()
							.then(() => ({
								body,
								contentType
							}))
							.catch(() => ({
								body,
								contentType
							}));
					});
			})
			.then(this.parseResponse);
	}

	parseResponse(response) {
		let {
			body,
			contentType
		} = response;

		if(contentType === 'application/json') {
			try {
				body = JSON.parse(body.toString());
			} catch(err) {
				body = body.toString();
				contentType = 'text/plain';
			}
		} else {
			body = body.toString();
		}

		return {
			body,
			contentType
		};
	}
}
