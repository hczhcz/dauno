'use strict';

var fs = require('fs');
var https = require('https');
var querystring = require('querystring');
var Cookies = require('cookies');
var io = require('socket.io');

var dauno = require('./dauno.util');
var daunoUsers = require('./dauno.users');

var makeServer = function (port) {
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
                    if (data.length < 4096) {
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
                        cookies.set('login', 'Y', options);
                        cookies.set('user', args['user'], options);
                        cookies.set('password', args['password'], options);
                    } else {
                        // logout
                        cookies.set('login');
                        cookies.set('user');
                        cookies.set('password');
                    }

                    dauno.httpLog(
                        req.connection, 302, req.method, req.url
                    );

                    res.writeHead(302, {Location: '/'});
                    res.end();
                });
            } else {
                throw Error();
            }
        },
        '/app': function (req, res) {
            dauno.reqLog(
                req.connection, 'New', req.method + ' ' + req.url
            );

            var cookies = new Cookies(req, res);

            if (cookies.get('login') == 'Y') {
                daunoUsers.auth(
                    cookies.get('user'),
                    cookies.get('password'),
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

    var httpServer = https.createServer(
        {
            key: fs.readFileSync('./key'),
            cert: fs.readFileSync('./crt'),
        },
        // to call a http handler
        function (req, res) {
            try {
                var parsedUrl = req.url.match(/^\/dauno(\/\w+)(.*)/);

                if (parsedUrl && parsedUrl.length == 3) {
                    // built-in

                    var cmd = parsedUrl[1];

                    if (handlers.hasOwnProperty(cmd)) {
                        return handlers[cmd](req, res);
                    } else {
                        return handlers['/404'](req, res);
                    }
                } else {
                    // proxy

                    return handlers['/app'](req, res);
                }
            } catch (e) {
                dauno.errLog(String(e));

                return handlers['/500'](req, res);
            }
        }
    ).listen(port);

    var socketServer = io(httpServer);

    socketServer.on('connection', function (socket) {
        try {
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
        } catch (e) {
            dauno.errLog(String(e));
        }
    });
};

daunoUsers.init(function () {
    dauno.taskLog('Init');

    makeServer(8001, true);
});
