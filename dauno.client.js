'use strict';

var https = require('https');
var io = require('socket.io-client');

var dauno = require('./dauno');

var makeClient = function (host, name, password) {
    var socket = io(host);

    socket.on('connect', function () {
        dauno.taskLog('Connect');

        socket.emit('login', {
            name: name,
            password: dauno.hash(password),
        });
    });

    socket.on('daunoReq', function (data) {
        dauno.taskLog('Request', JSON.stringify(data));

        // TODO
        socket.emit('res', {
            test: 'test2',
        });
    });

    socket.on('daunoData', function (data) {
        dauno.taskLog('Data', JSON.stringify(data));

        // TODO
    });

    socket.on('daunoEnd', function (data) {
        dauno.taskLog('End', JSON.stringify(data));

        // TODO
    });
};

makeClient('https://127.0.0.1:8001', 'test', 'pass');
