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
        dauno.taskLog('Request', data.path);
        dauno.taskLog('Request id', data.id);

        data.host = target;
        data.port = targetPort;

        req[data.id] = http.request(
            data, // TODO: trailers?
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

makeClient(
    'https://127.0.0.1:8001', 'test', 'pass',
    '127.0.0.1', '80'
);
