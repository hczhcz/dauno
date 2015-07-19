'use strict';

var port = 8001;

var fs = require('fs');
var https = require('https');
var io = require('socket.io');

var handlers = {
    app: function (req, res) {
        console.log(req);

        var data = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            trailers: req.trailers,
            now: new Date(),
        };

        res.writeHead(200);
        res.end(JSON.stringify(data));
    },
    err404: function (req, res) {
        res.writeHead(404);
        res.end();
    },
    err500: function (req, res) {
        res.writeHead(500);
        res.end();
    },
};

var handlerMain = function (req, res) {
    try {
        var parsedUrl = req.url.match(/^\/(\w+)(.*)/);

        if (parsedUrl && parsedUrl.length == 3) {
            var cmd = parsedUrl[1];

            if (handlers.hasOwnProperty(cmd)) {
                req.url = parsedUrl[2];
                return handlers[cmd](req, res);
            }
        }

        return handlers['err404'](req, res);
    } catch (e) {
        return handlers['err500'](req, res);
    }
};

var server = https.createServer(
    {
        key: fs.readFileSync('./key'),
        cert: fs.readFileSync('./crt'),
    },
    handlerMain
).listen(port);

// TODO

var socketServer = io(server);

socketServer.on('connection', function (socket) {
    socket.emit('req', {
        test: 'test1',
    });

    socket.on('login', function (data) {
        console.log(data);
    });

    socket.on('res', function (data) {
        console.log(data);
    });
});
