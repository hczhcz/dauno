'use strict';

var dauno = require('./dauno.util');

var dynamicStorage = {};

var genStorageAccess = function (user) {
    return {
        user: user,
        staticGet: function (key) {
            // TODO: not implemented
            throw Error();
        },
        staticSet: function (key, value) {
            // TODO: not implemented
            throw Error();
        },
        dynamicGet: function (key) {
            if (!dynamicStorage[user]) {
                return;
            }

            return dynamicStorage[user][key];
        },
        dynamicSet: function (key, value) {
            if (!dynamicStorage[user]) {
                dynamicStorage[user] = {};
            }

            dynamicStorage[user][key] = value;
        },
    };
};

module.exports.auth = function (user, password) {
    // TODO
    // notice: user should not be __proto__ etc
    if (user == 'test' && password == dauno.hash('pass')) {
        return genStorageAccess(user);
    }
};
