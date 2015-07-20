'use strict';

var http = require('http');
var https = require('https');
var io = require('socket.io-client');

var dauno = require('./dauno');

var makeClient = function (host, name, password, target, targetPort) {
    var socket = io(host);
    var req = {};

    socket.on('connect', function () {
        dauno.taskLog('Connect');

        socket.emit('login', {
            name: name,
            password: dauno.hash(password),
        });
    });

    socket.on('reqBegin', function (data) {
        dauno.taskLog('Request', data.path);
        dauno.taskLog('Request id', data.id);

        data.host = target;
        data.port = targetPort;

        req[data.id] = http.request(
            data,
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
                        chunk: data.chunk,
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

        // req[data.id].on('error', function (e) {
        //     // TODO
        // });
    });

    socket.on('reqData', function (data) {
        dauno.taskLog('Data', data.id);

        req[data.id].write(data.chunk);
    });

    socket.on('reqEnd', function (data) {
        dauno.taskLog('End', data.id);

        req[data.id].end();
    });
};

makeClient(
    'https://127.0.0.1:8001', 'test', 'pass',
    '127.0.0.1', '80'
);
