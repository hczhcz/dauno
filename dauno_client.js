'use strict';

var https = require('https');
var crypto = require('crypto');
var io = require('socket.io-client');

var sha256 = function (data) {
    return crypto.createHash('sha256').update(data).digest('hex')
};

var host = 'https://127.0.0.1:8001';
var login = {
    username: 'test',
    password: sha256('test'),
};

var socket = io(host);

socket.on('connect', function () {
    console.log(new Date() + ' connect');
    socket.emit('login', login);
});

socket.on('req', function (data) {
    console.log(data);

    socket.emit('res', {
        test: 'test2',
    });
});
