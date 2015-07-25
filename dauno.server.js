'use strict';

var fs = require('fs');
var domain = require('domain');
var http = require('http');
var https = require('https');
var querystring = require('querystring');
var Cookies = require('cookies');
var io = require('socket.io');

var dauno = require('./dauno.util');
var daunoUsers = require('./dauno.users');

var makeServer = function (httpsPort, httpPort) {
    // http handlers
    var handlers = {
        '/login': function (req, res) {
            dauno.httpLog(
                req.connection, 200, req.method, req.url
            );

            res.writeHead(200);
            res.end(fs.readFileSync('./login.html'));
        },
        '/auth': function (req, res) {
            if (req.method == 'POST') {
                var data = '';

                req.on('data', function (chunk) {
                    if (data.length + chunk.length < 4096) {
                        data += chunk;
                    }
                });

                req.on('end', function () {
                    var args = querystring.parse(data);

                    var cookies = new Cookies(req, res);

                    var options = {
                        secure: true,
                        overwrite: true,
                        maxAge: 1000 * 3600 * 24,
                    };

                    // TODO: session id?
                    if (args['user']) {
                        // login
                        cookies.set(
                            'dauno_login', 'Y',
                            options
                        );
                        cookies.set(
                            'dauno_user', args['user'],
                            options
                        );
                        cookies.set(
                            'dauno_password', dauno.hash(args['password']), // TODO: move to frontend
                            options
                        );
                    } else {
                        // logout
                        cookies.set('dauno_login');
                        cookies.set('dauno_user');
                        cookies.set('dauno_password');
                    }

                    dauno.httpLog(
                        req.connection, 302, req.method, req.url
                    );

                    res.writeHead(302, {Location: '/'});
                    res.end();
                });
            } else {
                throw Error('POST only');
            }
        },
        '/app': function (req, res) {
            dauno.reqLog(
                req.connection, 'New', req.method + ' ' + req.url
            );

            var cookies = new Cookies(req, res);

            if (cookies.get('dauno_login') == 'Y') {
                daunoUsers.auth(
                    cookies.get('dauno_user'),
                    cookies.get('dauno_password'),
                    function (session) {
                        dauno.reqLog(
                            req.connection, 'User', session.user
                        );

                        // notice: may fail if no socket exists before
                        var socket = session.dynamicGet('socket');

                        // requests pool (size = 256)
                        // notice: may override old request
                        var id = session.dynamicGet('lastId');
                        if (typeof(id) == 'number') {
                            id = (id + 1) % 256;
                        } else {
                            id = 0;
                        }
                        session.dynamicSet('lastId', id);
                        session.dynamicSet('req' + id, req); // for log only
                        session.dynamicSet('res' + id, res);

                        dauno.reqLog(
                            req.connection, 'Request ' + id, req.url
                        );

                        socket.emit('reqBegin', {
                            id: id,
                            method: req.method,
                            path: req.url,
                            headers: req.headers,
                            trailers: req.trailers,
                            // now: dauno.date(),
                        });

                        req.on('data', function (chunk) {
                            dauno.reqLog(
                                req.connection, 'Request data', id
                            );

                            socket.emit('reqData', {
                                id: id,
                                chunk: chunk,
                            });
                        });

                        req.on('end', function () {
                            dauno.reqLog(
                                req.connection, 'Request end', id
                            );

                            socket.emit('reqEnd', {
                                id: id,
                            });
                        });
                    },
                    function () {
                        // login failed

                        dauno.httpLog(
                            req.connection, 302, req.method, req.url
                        );

                        res.writeHead(302, {Location: '/dauno/login'});
                        res.end();
                    }
                );
            } else {
                // need login

                dauno.httpLog(
                    req.connection, 302, req.method, req.url
                );

                res.writeHead(302, {Location: '/dauno/login'});
                res.end();
            }
        },
        '/404': function (req, res) {
            dauno.httpLog(
                req.connection, 404, req.method, req.url
            );

            res.writeHead(404);
            res.end('Not found');
        },
        '/500': function (req, res) {
            dauno.httpLog(
                req.connection, 500, req.method, req.url
            );

            res.writeHead(500);
            res.end('Error');
        },
    };

    var httpServer = http.createServer(
        function (req, res) {
            // force https

            var d = domain.create();

            d.on('error', function (e) {
                dauno.errLog(String(e));

                try {
                    handlers['/500'](req, res);
                } catch (e) {
                    // ignore
                }
            });

            d.add(req);
            d.add(res);

            d.run(function () {
                dauno.httpLog(
                    req.connection, 302, req.method, req.url
                );

                var host = req.headers.host;
                var pos = host.indexOf(':');
                var path = 'https://' + host.substr(0, pos) + ':' + httpsPort + req.url;

                res.writeHead(302, {Location: path});
                res.end();
            });
        }
    ).listen(httpPort);

    var httpsServer = https.createServer(
        {
            key: fs.readFileSync('./key'),
            cert: fs.readFileSync('./crt'),
        },
        // to call a http handler
        function (req, res) {
            var d = domain.create();

            d.on('error', function (e) {
                dauno.errLog(String(e));

                try {
                    handlers['/500'](req, res);
                } catch (e) {
                    // ignore
                }
            });

            d.add(req);
            d.add(res);

            d.run(function () {
                var parsedUrl = req.url.match(/^\/dauno(\/\w+)(.*)/);

                if (parsedUrl && parsedUrl.length == 3) {
                    // built-in

                    var cmd = parsedUrl[1];

                    if (handlers.hasOwnProperty(cmd)) {
                        handlers[cmd](req, res);
                    } else {
                        handlers['/404'](req, res);
                    }
                } else {
                    // proxy

                    handlers['/app'](req, res);
                }
            });
        }
    ).listen(httpsPort);

    var socketServer = io(httpsServer);

    socketServer.on('connection', function (socket) {
        var d = domain.create();

        d.on('error', function (e) {
            dauno.errLog(String(e));
        });

        d.add(socket);

        d.run(function () {
            // login handler
            socket.on('login', function (data) {
                dauno.sockLog(
                    socket.conn, 'Login', data.user
                );

                daunoUsers.auth(
                    data.user,
                    data.password,
                    function (session) {
                        session.dynamicSet('socket', socket);

                        // response handlers

                        socket.on('resBegin', function (data) {
                                dauno.sockLog(
                                    socket.conn, 'Response begin', data.id
                                );

                                var req = session.dynamicGet('req' + data.id);

                                dauno.httpLog(
                                    req.connection, data.statusCode, req.method, req.url
                                );

                                var res = session.dynamicGet('res' + data.id);

                                res.writeHead(
                                    data.statusCode,
                                    data.statusMessage,
                                    data.headers
                                );
                                res.addTrailers(data.trailers);
                        });

                        socket.on('resData', function (data) {
                                dauno.sockLog(
                                    socket.conn, 'Response data', data.id
                                );

                                var res = session.dynamicGet('res' + data.id);

                                res.write(data.chunk);
                        });

                        socket.on('resEnd', function (data) {
                                dauno.sockLog(
                                    socket.conn, 'Response end', data.id
                                );

                                var res = session.dynamicGet('res' + data.id);

                                res.end();
                        });
                    },
                    function () {
                        // bad login
                        dauno.errLog('Login fail');
                    }
                );
            });
        });
    });
};

daunoUsers.init(function () {
    dauno.taskLog('Init');

    makeServer(8001, 8002, true);
});
