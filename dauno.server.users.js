'use strict';

var dauno = require('./dauno');

var dynamicStorage = {};

var genStorageAccess = function (name) {
    return {
        staticGet: function (key) {
            // TODO: not implemented
            throw Error();
        },
        staticSet: function (key, value) {
            // TODO: not implemented
            throw Error();
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
