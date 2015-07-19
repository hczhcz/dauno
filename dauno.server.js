'use strict';

var fs = require('fs');
var https = require('https');
var io = require('socket.io');

var dauno = require('./dauno');
var daunoUsers = require('./dauno.server.users');

var makeServer = function (port) {
    // http handlers
    var handlers = {
        app: function (req, res) {
            dauno.httpLog(
                req.connection, 'REQ', '/app' + req.url
            );

            // TODO: get user
            var user = daunoUsers.auth('test', 'pass');
            var socket = user.dynamicGet('socket');

            var data = {
                method: req.method,
                path: req.url,
                headers: req.headers,
                trailers: req.trailers,
                body: buf,
                now: dauno.date(),
            };

            res.writeHead(200);

            var buf = '';

            req.on('data', function (chunk) {
                buf += chunk;

                if (buf.length > 32 * 1024 * 1024) {
                    req.connection.destroy(); // flooding
                }
            });

            req.on('end', function () {
                res.end(JSON.stringify(data));
            });
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
            try {
                var parsedUrl = req.url.match(/^\/(\w+)(.*)/);

                if (parsedUrl && parsedUrl.length == 3) {
                    var cmd = parsedUrl[1];

                    if (handlers.hasOwnProperty(cmd)) {
                        req.url = parsedUrl[2];
                        return handlers[cmd](req, res);
                    }
                }

                return handlers.err404(req, res);
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
            dauno.sockLog(socket.conn.remoteAddress, 'Login', data.name);

            var user = daunoUsers.auth(data.name, data.password);
            user.dynamicSet('socket', socket);

            // proxy response handler
            socket.on('res', function (data) {
                dauno.sockLog(socket.conn.remoteAddress, 'Response', data.id);

                //
            });
        });
    });
};

makeServer(8001);
