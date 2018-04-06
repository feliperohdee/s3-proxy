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
            parserBuffer: sinon.stub().callsFake(body => new Buffer(`${body}-1`)),
            parserString: sinon.stub().callsFake(body => `${body}-2`),
            parserJson: sinon.stub().callsFake(body => ({
                html: `${body}-3`
            }))
        };

        s3 = {
            getObject: sinon.stub().returns({
                promise: () => Promise.resolve({
                    Body: new Buffer('body'),
                    ContentType: 'text/plain'
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
            headers: {
                'content-type': 'text/plain'
            }
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

        it('should have default parseResponse', () => {
            expect(proxy.parseResponse).to.be.a('function');
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
                Key: '392b22e4addf45adb1114986cff79446'
            });
        });

        it('should call s3.getObject with custom folder', () => {
            proxy.get({
                src: 'src.png',
                folder: 'folder'
            });

            expect(s3.getObject).to.have.been.calledWithExactly({
                Bucket: 'bucket',
                Key: 'folder/392b22e4addf45adb1114986cff79446'
            });
        });

        it('should call s3.getObject with custom id', () => {
            proxy.get({
                src: 'src.png',
                id: 'id'
            });

            expect(s3.getObject).to.have.been.calledWithExactly({
                Bucket: 'bucket',
                Key: 'id'
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
                Key: 'folder/id'
            });
        });

        it('should call parseResponse', done => {
            proxy.get({
                    src: 'src.png',
                    folder: 'folder',
                    id: 'id'
                })
                .then(() => {
                    expect(proxy.parseResponse).to.have.been.calledWithExactly({
                        body: new Buffer('body'),
                        contentType: 'text/plain'
                    });

                    done();
                });
        });

        describe('json', () => {
            beforeEach(() => {
                s3.getObject = sinon.stub().returns({
                    promise: () => Promise.resolve({
                        Body: new Buffer('{"html":"body-3"}'),
                        ContentType: 'application/json'
                    })
                })
            });

            it('should call s3.getObject as json', () => {
                proxy.get({
                    src: 'src.png',
                    folder: 'folder',
                    id: 'id'
                });

                expect(s3.getObject).to.have.been.calledWithExactly({
                    Bucket: 'bucket',
                    Key: 'folder/id'
                });
            });

            it('should call parseResponse', done => {
                proxy.get({
                        src: 'src.png',
                        folder: 'folder',
                        id: 'id'
                    })
                    .then(response => {
                        expect(proxy.parseResponse).to.have.been.calledWithExactly({
                            body: new Buffer('{"html":"body-3"}'),
                            contentType: 'application/json'
                        });

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
                        expect(response).to.deep.equal({
                            body: 'body',
                            contentType: 'text/plain'
                        });

                        done();
                    });
            });

            describe('getObject error', () => {
                beforeEach(() => {
                    s3.getObject = sinon.stub().returns({
                        promise: () => Promise.reject(new Error())
                    });
                });

                it('should returns', done => {
                    proxy.get({
                            src: 'src.png',
                            folder: 'folder',
                            id: 'id'
                        })
                        .then(response => {
                            expect(response).to.deep.equal({
                                body: 'body',
                                contentType: 'text/plain'
                            });

                            done();
                        })
                        .catch(console.log);
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

            it('should call parserBuffer', done => {
                proxy.get({
                        src: 'src.png',
                        folder: 'folder',
                        id: 'id',
                        parser: 'parserBuffer'
                    })
                    .then(response => {
                        expect(parsers.parserBuffer).to.have.been.calledWithExactly('body', 'text/plain');
                        expect(response).to.deep.equal({
                            body: 'body-1',
                            contentType: 'text/plain'
                        });

                        done();
                    });
            });

            it('should transform string response into buffer', done => {
                proxy.get({
                        src: 'src.png',
                        folder: 'folder',
                        id: 'id',
                        parser: 'parserString'
                    })
                    .then(response => {
                        const [args] = s3.putObject.getCall(0).args;

                        expect(_.isBuffer(args.Body)).to.be.true;
                        expect(response).to.deep.equal({
                            body: 'body-2',
                            contentType: 'text/plain'
                        });

                        done();
                    });
            });

            it('should transform object response into buffer', done => {
                proxy.get({
                        src: 'src.png',
                        folder: 'folder',
                        id: 'id',
                        parser: 'parserJson'
                    })
                    .then(response => {
                        const [args] = s3.putObject.getCall(0).args;

                        expect(_.isBuffer(args.Body)).to.be.true;
                        expect(response).to.deep.equal({
                            body: {
                                html: 'body-3'
                            },
                            contentType: 'application/json'
                        });

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
                        expect(parsers.parserBuffer).not.to.have.been.called;
                        expect(response).to.deep.equal({
                            body: 'body',
                            contentType: 'text/plain'
                        });

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
                            Key: 'folder/id',
                            Body: new Buffer('body'),
                            ContentType: 'text/plain'
                        });

                        expect(response).to.deep.equal({
                            body: 'body',
                            contentType: 'text/plain'
                        });

                        done();
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
                            expect(response).to.deep.equal({
                                body: 'body',
                                contentType: 'text/plain'
                            });

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
        it('should parse string', () => {
            expect(proxy.parseResponse({
                body: new Buffer('body'),
                contentType: 'text/plain'
            })).to.deep.equal({
                body: 'body',
                contentType: 'text/plain'
            });
        });

        it('should parse as json', () => {			
			expect(proxy.parseResponse({
                body: new Buffer('{"html": "body-3"}'),
                contentType: 'application/json'
            })).to.deep.equal({
                body: {
					html: 'body-3'
				},
                contentType: 'application/json'
            });
        });

        it('should parse json with error as string', () => {
            expect(proxy.parseResponse({
                body: new Buffer('{"html": "body-3}'),
                contentType: 'application/json'
            })).to.deep.equal({
                body: '{"html": "body-3}',
                contentType: 'text/plain'
            });
        });
    });
});