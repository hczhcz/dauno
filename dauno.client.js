'use strict';

var http = require('http');
var https = require('https');
var io = require('socket.io-client');

var dauno = require('./dauno.util');

var makeClient = function (host, user, password, target, targetPort) {
    var socket = io(host);
    var req = {};

    socket.on('connect', function () {
        dauno.taskLog('Connect');

        socket.emit('login', {
            user: user,
            password: dauno.hash(password),
        });
    });

    socket.on('reqBegin', function (data) {
        dauno.taskLog('Request ' + data.id, data.path);

        req[data.id] = http.request(
            {
                host: target,
                port: targetPort,
                method: data.method,
                path: data.path,
                headers: data.headers,
            },
            function (res) {
                dauno.taskLog('Response begin', data.id);

                socket.emit('resBegin', {
                    id: data.id,
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage,
                    headers: res.headers,
                    trailers: res.trailers,
                    // now: dauno.date(),
                });

                res.on('data', function (chunk) {
                    dauno.taskLog('Response data', data.id);

                    socket.emit('resData', {
                        id: data.id,
                        chunk: chunk,
                    });
                });

                res.on('end', function () {
                    dauno.taskLog('Response end', data.id);

                    socket.emit('resEnd', {
                        id: data.id,
                    });
                });
            }
        );

        req[data.id].addTrailers(data.trailers);

        req[data.id].on('error', function (e) {
            dauno.errLog(String(e));
        });
    });

    socket.on('reqData', function (data) {
        dauno.taskLog('Request data', data.id);

        req[data.id].write(data.chunk);
    });

    socket.on('reqEnd', function (data) {
        dauno.taskLog('Request end', data.id);

        req[data.id].end();
    });
};

var host = 'localhost';
var hostPort = '443';
var user = 'test';
var password = 'pass';
var target = '127.0.0.1';
var targetPort = '8080';

var argv = process.argv;
var argm = '';

for (var i in argv) {
    if (argv[i][0] == '-') {
        argm = argv[i];

        if (argm == '-h') {
            console.log('[-t dauno server] [-p dauno port]');
            console.log('[-u user] [-p password]');
            console.log('[-T target server] [-P target port]');

            return;
        }
    } else {
        if (argm == '-t') {
            host = argv[i];
        } else if (argm == '-p') {
            hostPort = argv[i];
        } else if (argm == '-u') {
            user = argv[i];
        } else if (argm == '-k') {
            password = argv[i];
        } else if (argm == '-T') {
            target = argv[i];
        } else if (argm == '-P') {
            targetPort = argv[i];
        }

        argm = '';
    }
}

makeClient(
    'https://' + host + ':' + hostPort,
    user, password,
    target, targetPort
);
