
module.exports = Data;

var util = require("util");
var events = require('events');
var base64id = require('base64id');

function Data(options) {
    events.EventEmitter.call(this);

    this.options = {
        "guestName": "Guest ",
        "guestRooms": ["help"],
        "historyLength": 100,
        "historyExpire": 86400000
    };

    if (options) {
        for (var name in options) {
            if (options.hasOwnProperty(name)) {
                this.options[name] = options[name];
            }
        }
    }

    this.users = {};
    this.guestNum = 0;
    this.logs = {};
    this.logTimeouts = {};
}

util.inherits(Data, events.EventEmitter);

Data.prototype.close = function() {};

Data.prototype.getSession = function(sessionId, callback) {
    process.nextTick(callback.bind(null, null, null));
};

Data.prototype.getUser = function(userId, callback) {
    process.nextTick(callback.bind(null, null, this.users[userId]));
};

Data.prototype.getUsers = function(userIds, callback) {
    var users = {};
    userIds.forEach(function(userId) {
        users[userId] = this.users[userId];
    }, this);
    process.nextTick(callback.bind(null, null, users));
};

Data.prototype.getGuest = function(name, callback) {
    var uid;
    do {
        uid = 'guest:' + base64id.generateId();
    } while (this.users[uid]);

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

Data.prototype.removeGuest = function(userId, callback) {
    if (userId.match(/guest:/)) {
        delete this.users[userId];
    }
    process.nextTick(callback.bind(null, null));
};

Data.prototype.getRoom = function(roomId, callback) {
    process.nextTick(callback.bind(null, null, {}));
};

Data.prototype.addLog = function(roomId, msg, callback) {
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

    if (this.logTimeouts[roomId]) {
        clearTimeout(this.logTimeouts[roomId]);
    }
    var self = this;
    this.logTimeouts[roomId] = setTimeout(function() {
        delete self.logTimeouts[roomId];
        delete self.logs[roomId];
    }, this.options.historyExpire);
    this.logTimeouts[roomId].unref();

    if (callback) process.nextTick(callback.bind(null, null));
};

Data.prototype.getLog = function(roomId, time, callback) {
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
