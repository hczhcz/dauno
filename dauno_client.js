'use strict';

var host = 'https://127.0.0.1:8001';

var https = require('https');
var io = require('socket.io');

var socket = io(host);

socket.on('req', function (data) {
    console.log(data);

    socket.emit('res', {
        test: 'test2',
    });
});
