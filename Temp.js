
module.exports = Temp;

var util = require("util");
var events = require('events');
var base64id = require('base64id');

function hasProperties(obj) {
    events.EventEmitter.call(this);

    for (var prop in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, prop)) {
            return true;
        }
    }
    return false;
}

function Temp(options) {
    this.options = {
        "tokenExpire": 30000
    };

    if (options) {
        for (var name in options) {
            if (options.hasOwnProperty(name)) {
                this.options[name] = options[name];
            }
        }
    }

    this.sockets = {};
    this.userRooms = {};
    this.roomUsers = {};
    this.tokens = {};
}

util.inherits(Temp, events.EventEmitter);

Temp.prototype.close = function() {};

Temp.prototype.addSocket = function(socketId, userId, callback) {
    if (!this.sockets[userId]) {
        this.sockets[userId] = {};
    }
    this.sockets[userId][socketId] = true;
    if (callback) process.nextTick(callback.bind(null, null));
};

Temp.prototype.removeSocket = function(socketId, userId, callback) {
    if (this.sockets[userId]) {
        delete this.sockets[userId][socketId];
        if (!hasProperties(this.sockets[userId])) {
            delete this.sockets[userId];
        }
    }
    if (callback) process.nextTick(callback.bind(null, null, !!this.sockets[userId]));
};

Temp.prototype.getSockets = function(userId, callback) {
    process.nextTick(callback.bind(null, null, Object.keys(this.sockets[userId])));
};

Temp.prototype.addUserToRoom = function(userId, roomId, callback) {
    var already;
    if (!this.userRooms[userId]) {
        this.userRooms[userId] = {};
    }
    if (this.userRooms[userId][roomId]) {
        already = true;
    } else {
        this.userRooms[userId][roomId] = true;
    }
    if (!this.roomUsers[roomId]) {
        this.roomUsers[roomId] = {};
    }
    this.roomUsers[roomId][userId] = true;
    if (callback) process.nextTick(callback.bind(null, null, already));
};

Temp.prototype.removeUserFromRoom = function(userId, roomId, callback) {
    var already = false;
    var has = false;

    if (this.userRooms[userId]) {
        delete this.userRooms[userId][roomId];
        if (!hasProperties(this.userRooms[userId])) {
            delete this.userRooms[userId];
        }
    }

    if (this.roomUsers[roomId]) {
        if (this.roomUsers[roomId][userId]) {
            delete this.roomUsers[roomId][userId];
        } else {
            already = true;
        }
        has = hasProperties(this.roomUsers[roomId]);
        if (!has) {
            delete this.roomUsers[roomId];
        }
    } else {
        already = true;
    }

    if (callback) process.nextTick(callback.bind(null, null, already, has));
};

Temp.prototype.getUserRooms = function(userId, callback) {
    process.nextTick(callback.bind(null, null, this.userRooms[userId] && Object.keys(this.userRooms[userId])));
};

Temp.prototype.getRoomUsers = function(roomId, callback) {
    process.nextTick(callback.bind(null, null, this.roomUsers[roomId] && Object.keys(this.roomUsers[roomId])));
};

Temp.prototype.createToken = function(data, callback) {
    var token;
    do {
        token = base64id.generateId();
    } while (this.tokens[token]);

    var self = this;
    var timeout = setTimeout(function() {
        delete self.tokens[token];
    }, this.options.tokenExpire);
    timeout.unref();
    this.tokens[token] = [timeout, data];
    process.nextTick(callback.bind(null, null, token));
};

Temp.prototype.releaseToken = function(token, callback) {
    var data = this.tokens[token];
    if (data) {
        clearTimeout(data[0]);
        data = data[1];
        delete this.tokens[token];
    }
    process.nextTick(callback.bind(null, null, data));
};
