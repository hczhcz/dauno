'use strict';

var crypto = require('crypto');

module.exports.date = function () {
    return Date.now();
};

var printLog = function (info) {
    var date = new Date();

    console.log(
        '['
            + date.getFullYear() + '.'
            + (date.getMonth() + 1) + '.'
            + date.getDate() + ' '
            + date.getHours() + ':'
            + date.getMinutes() + ':'
            + date.getSeconds() + '.'
            + date.getMilliseconds()
        + '] '
        + info
    );
};

module.exports.taskLog = function (task, info) {
    if (info) {
        printLog(task + ': ' + info);
    } else {
        printLog(task);
    }
};

module.exports.sockLog = function (ip, task, info) {
    printLog('[' + ip + '] ' + task + ': ' + info);
};

module.exports.httpLog = function (conn, status, path) {
    printLog(
        '[' + conn.remoteAddress + ':' + conn.remotePort + '] [' + status + '] '
        + path
    );
};

module.exports.errLog = function (info) {
    printLog('ERROR: ' + info);
};

module.exports.hash = function (data) {
    return crypto.createHmac('sha256', 'dauno_hash').update(data).digest('hex');
};

module.exports.rand = function () {
    return crypto.randomBytes(64).digest('hex');
};
