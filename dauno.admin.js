'use strict';

var dauno = require('./dauno.util');
var daunoUsers = require('./dauno.users');

var job;
var user = 'test';
var password = 'pass';

var argv = process.argv;
var argm = '';

for (var i in argv) {
    if (argv[i][0] == '-') {
        argm = argv[i];

        if (argm == '-h') {
            console.log('-j reg [-u user] [-k password]');

            return;
        }
    } else {
        if (argm == '-j') {
            job = argv[i];
        } else if (argm == '-u') {
            user = argv[i];
        } else if (argm == '-k') {
            password = argv[i];
        }

        argm = '';
    }
}

daunoUsers.init(function () {
    dauno.taskLog('Init');

    if (job == 'reg') {
        daunoUsers.reg(user, dauno.hash(password), function () {
            dauno.taskLog('Reg done');
        });
    }
});
