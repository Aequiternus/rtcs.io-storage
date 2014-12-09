
module.exports = Storage;

var events = require('events');

function generateId(prefix, length, check) {
    var s = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var id;
    do {
        id = prefix;
        for (var i = 0; i < length; i++) {
            id += s[Math.floor(Math.random() * s.length)];
        }
    } while (check && check[id]);
    return id;
}

function Storage(options) {
    this.options = options;
    this.sockets = {};
    this.users = {};
    this.sessions = {};
    this.roomTimeouts = {};
    this.userRooms = {};
    this.roomUsers = {};
    this.logs = {};
    this.tokens = {};
    this.guestNum = 0;
}

Storage.prototype.__proto__ = events.EventEmitter.prototype;

Storage.prototype.close = function() {};

Storage.prototype.getSession = function(sessionId, callback) {
    process.nextTick(callback.bind(null, null, this.sessions[sessionId]));
};

Storage.prototype.getUser = function(userId, callback) {
    process.nextTick(callback.bind(null, null, this.users[userId]));
};

Storage.prototype.getGuest = function(name, callback) {
    var uid = generateId('guest:', this.options.guestIdLength, this.users);
    this.users[uid] = {
        id: uid,
        public: {
            guest: true,
            name: this.options.guestName + ((name && name.trim()) || ++this.guestNum)
        },
        rooms: this.options.guestRooms
    };
    process.nextTick(callback.bind(null, null, uid));
};

Storage.prototype.getRoom = function(roomId, callback) {
    process.nextTick(callback.bind(null, null, null));
};

Storage.prototype.addSocket = function(socketId, userId, callback) {
    if (!this.sockets[userId]) {
        this.sockets[userId] = {};
    }
    this.sockets[userId][socketId] = true;
    if (callback) process.nextTick(callback.bind(null, null));
};

Storage.prototype.removeSocket = function(socketId, userId, callback) {
    if (this.sockets[userId]) {
        delete this.sockets[userId][socketId];
    }
    var has = false;
    if (this.sockets[userId]) {
        for (var socketId in this.sockets[userId]) {
            has = true;
            break;
        }
    }
    if (!has) {
        delete this.users[userId];
    }
    if (callback) process.nextTick(callback.bind(null, null, has));
};

Storage.prototype.getSockets = function(userId, callback) {
    process.nextTick(callback.bind(null, null, Object.keys(this.sockets[userId])));
};

Storage.prototype.addUserToRoom = function(userId, roomId, callback) {
    var already;
    if (this.roomTimeouts[roomId]) {
        clearTimeout(this.roomTimeouts[roomId]);
        delete this.roomTimeouts[roomId];
    }
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

Storage.prototype.removeUserFromRoom = function(userId, roomId, callback) {
    var already = false;
    var has = false;

    if (this.userRooms[userId]) {
        if (this.userRooms[userId][roomId]) {
            delete this.userRooms[userId][roomId];
        } else {
            already = true;
        }
        for (var roomId in this.userRooms[userId]) {
            has = true;
            break;
        }
        if (!has) {
            delete this.userRooms[userId];
        }
    } else {
        already = true;
    }

    has = false;
    if (this.roomUsers[roomId]) {
        delete this.roomUsers[roomId][userId];
        for (var userId in this.roomUsers[roomId]) {
            has = true;
            break;
        }
        if (!has) {
            delete this.roomUsers[roomId];
        }
    }

    if (!has) {
        if (this.roomTimeouts[roomId]) {
            clearTimeout(this.roomTimeouts[roomId]);
        }
        var self = this;
        this.roomTimeouts[roomId] = setTimeout(function() {
            delete self.roomTimeouts[roomId];
            delete self.logs[roomId];
        }, this.options.historyExpire);
        this.roomTimeouts[roomId].unref();
    }

    if (callback) process.nextTick(callback.bind(null, null, already, has));
};

Storage.prototype.getUserRooms = function(userId, callback) {
    process.nextTick(callback.bind(null, null, this.userRooms[userId] && Object.keys(this.userRooms[userId])));
};

Storage.prototype.getRoomUsers = function(roomId, callback) {
    var users = {};
    if (this.roomUsers[roomId]) {
        for (var userId in this.roomUsers[roomId]) {
            users[userId] = (this.users[userId] && this.users[userId].public) || {};
        }
    }
    process.nextTick(callback.bind(null, null, users));
};

Storage.prototype.addLog = function(roomId, msg, callback) {
    if (!this.logs[roomId]) {
        this.logs[roomId] = [];
    }
    var msglog = this.logs[roomId];
    msglog.push(msg);
    if (msglog.length > this.options.historyLength) {
        msglog.shift();
    }
    var expire = msg.time - this.options.historyExpire;
    while (msglog[0] && msglog[0].time < expire) {
        msglog.shift();
    }
    if (callback) process.nextTick(callback.bind(null, null));
};

Storage.prototype.getLog = function(roomId, time, callback) {
    var msglog = [];
    if (this.logs[roomId]) {
        if (time) {
            for (var i = 0, l = this.logs[roomId].length; i < l; i++) {
                if (this.logs[roomId][i].time > time) {
                    msglog.push(this.logs[roomId][i]);
                }
            }
        } else {
            msglog = this.logs[roomId];
        }
    }
    process.nextTick(callback.bind(null, null, msglog));
};

Storage.prototype.canJoin = function(socket, msg, callback) {
    process.nextTick(callback.bind(null, null));
};

Storage.prototype.canChat = function(socket, msg, callback) {
    if (msg.message) {
        var message = msg.message.trim();
        if (message) {
            process.nextTick(callback.bind(null, null));
        }
    }
};

Storage.prototype.canPeer = function(socket, msg, callback) {
    process.nextTick(callback.bind(null, null));
};

Storage.prototype.createToken = function(data, callback) {
    var token = generateId('', this.options.tokenLength, this.tokens);
    var self = this;
    var timeout = setTimeout(function() {
        delete self.tokens[token];
    }, this.options.tokenExpire);
    timeout.unref();
    this.tokens[token] = [timeout, data];
    process.nextTick(callback.bind(null, null, token));
};

Storage.prototype.releaseToken = function(token, callback) {
    var data = this.tokens[token];
    if (data) {
        clearTimeout(data[0]);
        data = data[1];
        delete this.tokens[token];
    }
    process.nextTick(callback.bind(null, null, data));
};
