'use strict';

var dauno = require('./dauno');

var dynamicStorage = {};

var genStorageAccess = function (name) {
    return {
        staticGet: function (key) {
            // TODO
            throw 1;
        },
        staticSet: function (key, value) {
            // TODO
            throw 1;
        },
        dynamicGet: function (key) {
            if (!dynamicStorage[name]) {
                return;
            }

            return dynamicStorage[name][key];
        },
        dynamicSet: function (key, value) {
            if (!dynamicStorage[name]) {
                dynamicStorage[name] = {};
            }

            dynamicStorage[name][key] = value;
        },
    };
};

module.exports.auth = function (name, password) {
    // TODO
    // notice: name should not be __proto__ etc
    if (name == 'test' && password == dauno.hash('pass')) {
        return genStorageAccess(name);
    }
};
