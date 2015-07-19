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

    socket.on('req', function (data) {
        dauno.taskLog('Request', JSON.stringify(data));

        // TODO
        socket.emit('res', {
            test: 'test2',
        });
    });
};

makeClient('https://127.0.0.1:8001', 'test', 'pass');
