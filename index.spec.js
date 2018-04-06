const _ = require('lodash');
const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');

const Proxy = require('./');

chai.use(sinonChai);

const expect = chai.expect;

describe('index.js', () => {
	let proxy;
	let s3;
	let got;
	let parsers;

	beforeEach(() => {
		parsers = {
			parser1: sinon.stub().callsFake(body => new Buffer(`${body}-1`)),
			parser2: sinon.stub().callsFake(body => `${body}-2`),
			parser3: sinon.stub().callsFake(body => ({
				html: `${body}-3`
			}))
		};

		s3 = {
			getObject: sinon.stub().returns({
				promise: () => Promise.resolve({
					Body: new Buffer('body')
				})
			}),
			putObject: sinon.stub().returns({
				promise: () => Promise.resolve({
					ETag: 'ETag'
				})
			})
		};

		got = sinon.stub().resolves({
			body: new Buffer('body'),
			headers: {}
		});

		proxy = new Proxy(s3, 'bucket', parsers);
		proxy.got = got;

		sinon.spy(proxy, 'parseResponse');
	});

	describe('constructor', () => {
		it('should throw if no s3 provided', () => {
			expect(() => new Proxy()).to.throw('missing s3 instance.');
		});

		it('should throw if no bucket provided', () => {
			expect(() => new Proxy(s3)).to.throw('missing bucket instance.');
		});

		it('should set s3', () => {
			expect(proxy.s3).to.equal(s3);
		});

		it('should set bucket', () => {
			expect(proxy.bucket).to.equal('bucket');
		});

		it('should set parsers', () => {
			expect(proxy.parsers).to.equal(parsers);
		});

		it('should have default parsers', () => {
			proxy = new Proxy(s3, 'bucket');

			expect(proxy.parsers).to.deep.equal({});
		});
	});

	describe('get', () => {
		it('should reject if no src provided', done => {
			proxy.get()
				.catch(err => {
					expect(err.message).to.equal('src missing.');

					done();
				});
		});

		it('should call s3.getObject', () => {
			proxy.get({
				src: 'src.png'
			});

			expect(s3.getObject).to.have.been.calledWithExactly({
				Bucket: 'bucket',
				Key: 'cfc7143ba1fc3a8f72ab9ded9f35562b.png'
			});
		});

		it('should call s3.getObject with custom folder', () => {
			proxy.get({
				src: 'src.png',
				folder: 'folder'
			});

			expect(s3.getObject).to.have.been.calledWithExactly({
				Bucket: 'bucket',
				Key: 'folder/cfc7143ba1fc3a8f72ab9ded9f35562b.png'
			});
		});

		it('should call s3.getObject with custom id', () => {
			proxy.get({
				src: 'src.png',
				id: 'id'
			});

			expect(s3.getObject).to.have.been.calledWithExactly({
				Bucket: 'bucket',
				Key: 'id.png'
			});
		});

		it('should call s3.getObject with custom id and folder', () => {
			proxy.get({
				src: 'src.png',
				folder: 'folder',
				id: 'id'
			});

			expect(s3.getObject).to.have.been.calledWithExactly({
				Bucket: 'bucket',
				Key: 'folder/id.png'
			});
		});

		it('should call parseResponse', done => {
			proxy.get({
					src: 'src.png',
					folder: 'folder',
					id: 'id'
				})
				.then(() => {
					expect(proxy.parseResponse).to.have.been.calledWithExactly(new Buffer('body'), true, false);

					done();
				});
		});

		it('should call parseResponse with base64 = false', done => {
			proxy.get({
					src: 'src.png',
					folder: 'folder',
					id: 'id',
					base64: false
				})
				.then(() => {
					expect(proxy.parseResponse).to.have.been.calledWithExactly(new Buffer('body'), false, false);

					done();
				});
		});

		describe('json', () => {
			beforeEach(() => {
				s3.getObject = sinon.stub().returns({
					promise: () => Promise.resolve({
						Body: new Buffer('{"html":"body-3"}')
					})
				})
			});

			it('should call s3.getObject as json', () => {
				proxy.get({
					json: true,
					src: 'src.png',
					folder: 'folder',
					id: 'id'
				});

				expect(s3.getObject).to.have.been.calledWithExactly({
					Bucket: 'bucket',
					Key: 'folder/id.json'
				});
			});

			it('should call parseResponse with base64 = true, json = true', done => {
				proxy.get({
						json: true,
						src: 'src.png',
						folder: 'folder',
						id: 'id'
					})
					.then(response => {
						expect(proxy.parseResponse).to.have.been.calledWithExactly(new Buffer('{"html":"body-3"}'), true, true);

						done();
					});
			});
		});

		describe('with cached response', () => {
			it('should not call s3.putObject', done => {
				proxy.get({
						src: 'src.png',
						folder: 'folder',
						id: 'id'
					})
					.then(response => {
						expect(s3.putObject).not.to.have.been.called;
						expect(response).to.equal(new Buffer('body').toString('base64'));

						done();
					});
			});

			describe('getObject error', () => {
				beforeEach(() => {
					s3.getObject = sinon.stub().returns({
						promise: () => Promise.reject(new Error())
					});
				});

				it('should returns body', done => {
					proxy.get({
							src: 'src.png',
							folder: 'folder',
							id: 'id'
						})
						.then(response => {
							expect(response).to.equal(new Buffer('body').toString('base64'));

							done();
						});
				});
			});
		});

		describe('without cached response', () => {
			beforeEach(() => {
				const err = new Error('NoSuchKey');
				err.name = 'NoSuchKey';

				s3.getObject = sinon.stub().returns({
					promise: () => Promise.reject(err)
				})
			});

			it('should call got', done => {
				proxy.get({
						src: 'src.png',
						folder: 'folder',
						id: 'id'
					})
					.then(() => {
						expect(got).to.have.been.calledWithExactly('src.png', {
							encoding: null
						});

						done();
					});
			});

			it('should call parser', done => {
				proxy.get({
						src: 'src.png',
						folder: 'folder',
						id: 'id',
						parser: 'parser1'
					})
					.then(response => {
						expect(parsers.parser1).to.have.been.calledWithExactly('body');
						expect(response).to.equal(new Buffer('body-1').toString('base64'));

						done();
					});
			});

			it('should transform parser\'s string response into buffer', done => {
				proxy.get({
						src: 'src.png',
						folder: 'folder',
						id: 'id',
						parser: 'parser2'
					})
					.then(response => {
						const [args] = s3.putObject.getCall(0).args;

						expect(_.isBuffer(args.Body)).to.be.true;

						done();
					});
			});

			it('should not call parser if inexistent', done => {
				proxy.get({
						src: 'src.png',
						folder: 'folder',
						id: 'id',
						parser: 'inexistentParser'
					})
					.then(response => {
						expect(parsers.parser1).not.to.have.been.called;
						expect(response).to.equal(new Buffer('body').toString('base64'));

						done();
					});
			});

			it('should call s3.putObject', done => {
				proxy.get({
						src: 'src.png',
						folder: 'folder',
						id: 'id'
					})
					.then(response => {
						expect(s3.putObject).to.have.been.calledWithExactly({
							Bucket: 'bucket',
							Key: 'folder/id.png',
							Body: new Buffer('body'),
							ContentType: 'image/png'
						});

						expect(response).to.equal(new Buffer('body').toString('base64'));

						done();
					});
			});

			describe('json', () => {
				it('should transform parser\'s object response into string', done => {
					proxy.get({
							json: true,
							src: 'src.png',
							folder: 'folder',
							id: 'id',
							parser: 'parser3'
						})
						.then(response => {
							const [args] = s3.putObject.getCall(0).args;

							expect(args.Body.toString()).to.equal('{"html":"body-3"}');

							done();
						});
				});

				it('should call s3.putObject', done => {
					proxy.get({
							json: true,
							src: 'src.png',
							folder: 'folder',
							id: 'id',
							parser: 'parser3'
						})
						.then(() => {
							expect(s3.putObject).to.have.been.calledWithExactly({
								Bucket: 'bucket',
								Key: 'folder/id.json',
								Body: new Buffer('{"html":"body-3"}'),
								ContentType: 'application/json'
							});

							done();
						});
				});

				describe('json source', () => {
					beforeEach(() => {
						proxy.got = sinon.stub().resolves({
							body: new Buffer('{"a":1}'),
							headers: {
								'content-type': 'application/json'
							}
						});
					});

					it('should transform parser\'s object response into string', done => {
						proxy.get({
								json: true,
								src: 'src.json',
								folder: 'folder',
								id: 'id'
							})
							.then(response => {
								const [args] = s3.putObject.getCall(0).args;
	
								expect(args.Body.toString()).to.equal('{"a":1}');
	
								done();
							});
					});
				});
			});

			describe('putObject error', () => {
				beforeEach(() => {
					s3.putObject = sinon.stub().returns({
						promise: () => Promise.reject(new Error())
					});
				});

				it('should returns body', done => {
					proxy.get({
							src: 'src.png',
							folder: 'folder',
							id: 'id'
						})
						.then(response => {
							expect(response).to.equal(new Buffer('body').toString('base64'));

							done();
						});
				});
			});

			describe('got error', () => {
				beforeEach(() => {
					proxy.got = sinon.stub().rejects();
				});

				it('should throw', done => {
					proxy.get({
							src: 'src.png',
							folder: 'folder',
							id: 'id'
						})
						.catch(() => done());
				});
			});
		});
	});

	describe('parseResponse', () => {
		it('should parse as base64 by default', () => {
			expect(proxy.parseResponse(new Buffer('body'))).to.equal('Ym9keQ==');
		});

		it('should parse as normal string', () => {
			expect(proxy.parseResponse(new Buffer('body'), false)).to.equal('body');
		});

		it('should parse as json', () => {
			expect(proxy.parseResponse(new Buffer('{"html": "body-3"}'), true, true)).to.deep.equal({
				html: 'body-3'
			});
		});

		it('should parse json with error as string', () => {
			expect(proxy.parseResponse(new Buffer('{"html":body-3"}'), true, true)).to.equal('{"html":body-3"}');
		});
	});
});
