[![CircleCI](https://circleci.com/gh/feliperohdee/smallorange-s3-proxy.svg?style=svg)](https://circleci.com/gh/feliperohdee/smallorange-s3-proxy)

# Small S3 Proxy

Small proxy to get stuffs and copy to s3 and retrieve for there

## Sample
		const AWS = require('aws-sdk');
		const Proxy = require('smallorange-s3-proxy');

		AWS.config.setPromisesDependency(Promise);
		AWS.config.update({
			accessKeyId: process.env.ACCESS_KEY_ID,
			secretAccessKey: process.env.SECRET_ACCESS_KEY,
			region: process.env.AWS_REGION || 'us-east-1'
		});

		const s3 = new AWS.S3();

		const parsers = {
			'parser-1': body => `parsed-body`
		};

		const proxy = proxy = new Proxy(s3, 'bucketName', parsers);

		proxy.get({
			src: 'https://s.cdpn.io/3/kiwi.svg',
			folder: 'proxyFolder',
			//parser: 'parser-1',
			//id: 'optionalId'
		})
		.then(handleResponse)
		.catch(handleError);
