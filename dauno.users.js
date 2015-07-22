'use strict';

var mongodb = require('mongodb').MongoClient;

var dauno = require('./dauno.util');

var dbStorage = undefined;
var memStorage = {};

module.exports.init = function (callback) {
    mongodb.connect('mongodb://localhost/dauno', function (err, db) {
        if (err) {
            throw err;
        } else {
            dbStorage = db.collection('users');
            callback();
        }
    });
};

var genStorageAccess = function (user) {
    return {
        user: user,
        staticGet: function (key, callback) {
            dbStorage.find({
                user: user
            }, function (err, docs) {
                if (err) {
                    throw err;
                } else if (docs.length == 1) {
                    callback(docs[0][key]);
                } else {
                    throw Error();
                }
            });
        },
        staticSet: function (key, value, callback) {
            var op = {$set: {}};
            op.$set[key] = value;

            dbStorage.updateOne({
                user: user
            }, op, {upsert: true}, function (err, doc) {
                if (err) {
                    throw err;
                } else {
                    callback(doc);
                }
            });
        },
        dynamicGet: function (key) {
            if (!memStorage[user]) {
                return;
            }

            return memStorage[user][key];
        },
        dynamicSet: function (key, value) {
            if (!memStorage[user]) {
                memStorage[user] = {};
            }

            memStorage[user][key] = value;
        },
    };
};

module.exports.auth = function (user, password, callback) {
    var session = genStorageAccess(user);

    session.staticGet('password', function (data) {
        if (password === data) {
            callback(session);
        } else {
            throw Error();
        }
    });
};

module.exports.reg = function (user, password, callback) {
    var session = genStorageAccess(user);

    session.staticSet('password', dauno.hash(password), callback);
};
