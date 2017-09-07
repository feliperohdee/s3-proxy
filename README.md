[![CircleCI](https://circleci.com/gh/feliperohdee/smallorange-s3-proxy.svg?style=svg)](https://circleci.com/gh/feliperohdee/smallorange-s3-proxy)

# Small S3 Proxy

Small proxy to get stuffs and copy to s3 and retrieve for there

## Sample
		const parsers = {
			'parser-1': body => `parsed-body`
		};

		const Proxy = require('smallorange-s3-proxy');
		const proxy = proxy = new Proxy(s3Instance, 'bucketName', parsers);

		proxy.get({
			src: 'https://s.cdpn.io/3/kiwi.svg',
			base64: true,
			folder: 'proxyFolder',
			//parser: 'parser-1',
			//id: 'optionalId'
		})
		.then(handleResponse)
		.catch(handleError);
