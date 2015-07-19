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

    socket.on('daunoReq', function (data) {
        dauno.taskLog('Request', data.id);

        data.host = target;
        data.port = targetPort;

        req[data.id] = http.request(
            data,
            function (res) {
                res.on('data', function (chunk) {
                    console.log('data:' + chunk);
                    // TODO
                    // socket.emit('res', {
                    //     test: 'test2',
                    // });
                });
                res.on('end', function () {
                    // TODO
                });
            }
        );

        // req[data.id].on('error', function (e) {
        //     // TODO
        // });
    });

    socket.on('daunoData', function (data) {
        dauno.taskLog('Data', data.id);

        req[data.id].write(data.chunk);
    });

    socket.on('daunoEnd', function (data) {
        dauno.taskLog('End', data.id);

        req[data.id].end();
    });
};

makeClient(
    'https://127.0.0.1:8001', 'test', 'pass',
    '127.0.0.1', '80'
);
