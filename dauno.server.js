'use strict';

var fs = require('fs');
var https = require('https');
var io = require('socket.io');

var dauno = require('./dauno.util');
var daunoUsers = require('./dauno.server.users');

var makeServer = function (port, forward) {
    // http handlers
    var handlers = {
        login: function (req, res) {
            // TODO: make session
        },
        app: function (req, res) {
            dauno.reqLog(
                req.connection, 'New', req.method + ' /app' + req.url
            );

            // TODO: get user from session info
            var session = daunoUsers.auth('test', dauno.hash('pass'));
            if (session) {
                dauno.reqLog(
                    req.connection, 'User', session.user
                );

                var socket = session.dynamicGet('socket');
                // TODO: if (!socket) ???

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
            } else {
                throw Error(); // user not found
            }
        },
        err404: function (req, res) {
            dauno.httpLog(
                req.connection, 404, req.method, req.url
            );

            res.writeHead(404);
            res.end();
        },
        err500: function (req, res) {
            dauno.httpLog(
                req.connection, 500, req.method, req.url
            );

            res.writeHead(500);
            res.end();
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
                var parsedUrl = req.url.match(/^\/(\w+)(.*)/);

                if (parsedUrl && parsedUrl.length == 3) {
                    var cmd = parsedUrl[1];

                    if (handlers.hasOwnProperty(cmd)) {
                        req.url = parsedUrl[2];
                        return handlers[cmd](req, res);
                    }
                }

                // if not found
                if (forward) {
                    return handlers.app(req, res); // TODO
                } else {
                    return handlers.err404(req, res);
                }
            } catch (e) {
                dauno.errLog(String(e));

                return handlers.err500(req, res);
            }
        }
    ).listen(port);

    var socketServer = io(httpServer);

    socketServer.on('connection', function (socket) {
        socket.emit('req', {
            test: 'test1',
        });

        // login handler
        socket.on('login', function (data) {
            dauno.sockLog(
                socket.conn, 'Login', data.user
            );

            var session = daunoUsers.auth(data.user, data.password);
            session.dynamicSet('socket', socket);

            // response handlers

            socket.on('resBegin', function (data) {
                dauno.sockLog(
                    socket.conn, 'Response begin', data.id
                );

                var req = session.dynamicGet('req' + data.id);

                dauno.httpLog(
                    req.connection, data.statusCode, req.method, '/app' + req.url
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
        });
    });
};

makeServer(8001, true);
