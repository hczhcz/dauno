'use strict';

var fs = require('fs');
var https = require('https');
var io = require('socket.io');

var dauno = require('./dauno');
var daunoUsers = require('./dauno.server.users');

var makeServer = function (port) {
    // http handlers
    var handlers = {
        login: function (req, res) {
            // TODO: make session
        },
        app: function (req, res) {
            dauno.httpLog(
                req.connection, 'REQ', '/app' + req.url
            );

            // TODO: get user from session info
            var user = daunoUsers.auth('test', dauno.hash('pass'));
            if (user) {
                var socket = user.dynamicGet('socket');
                // TODO: if (!socket) ???

                // requests pool (size = 256)
                // notice: may override old request
                var id = user.dynamicGet('req');
                if (typeof(id) == 'number') {
                    id = (id + 1) % 256;
                } else {
                    id = 0;
                }
                user.dynamicSet('req', id);

                socket.emit('daunoReq', {
                    id: id,
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    trailers: req.trailers,
                    now: dauno.date(),
                });

                req.on('data', function (chunk) {
                    // TODO: order?
                    socket.emit('daunoData', {
                        id: id,
                        chunk: chunk,
                    });
                });

                req.on('end', function () {
                    socket.emit('daunoEnd', {
                        id: id,
                    });
                });
            } else {
                throw Error(); // user not found
            }
        },
        err404: function (req, res) {
            dauno.httpLog(
                req.connection, 404, req.url
            );

            res.writeHead(404);
            res.end();
        },
        err500: function (req, res) {
            dauno.httpLog(
                req.connection, 500, req.url
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
            // try {
                var parsedUrl = req.url.match(/^\/(\w+)(.*)/);

                if (parsedUrl && parsedUrl.length == 3) {
                    var cmd = parsedUrl[1];

                    if (handlers.hasOwnProperty(cmd)) {
                        req.url = parsedUrl[2];
                        return handlers[cmd](req, res);
                    }
                }

                return handlers.err404(req, res);
            // } catch (e) {
            //     dauno.errLog(String(e));

            //     return handlers.err500(req, res);
            // }
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
                socket.conn, 'Login', data.name
            );

            var user = daunoUsers.auth(data.name, data.password);
            user.dynamicSet('socket', socket);

            // proxy response handler
            socket.on('res', function (data) {
                dauno.sockLog(
                    socket.conn, 'Response', data.id
                );

                //
            });
        });
    });
};

makeServer(8001);
