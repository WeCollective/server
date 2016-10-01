'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');
var io = require('../config/io.js')();

var Notification = function(data) {
  this.config = {
    schema: db.Schema.Notification,
    table: db.Table.Notifications,
    keys: db.Keys.Notifications
  };
  this.data = this.sanitize(data);
};

// Notification model inherits from Model
Notification.prototype = Object.create(Model.prototype);
Notification.prototype.constructor = Notification;

// Validate the properties specified in 'properties' on the Notification object,
// returning an array of any invalid ones
Notification.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.notificationid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure user is valid username
  if(properties.indexOf('user') > -1) {
    if(!validate.username(this.data.user)) {
      invalids.push('user');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure unread is valid boolean
  if(properties.indexOf('unread') > -1) {
    if(!validate.boolean(this.data.unread)) {
      invalids.push('unread');
    }
  }

  // ensure type is valid notification type
  if(properties.indexOf('type') > -1) {
    if(!validate.notificationType(this.data.type)) {
      invalids.push('type');
    }
  }

  // TODO check data is a valid JSON for the given type

  return invalids;
};

// Get a Notification by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Notification.prototype.findById = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.get({
      TableName: self.config.table,
      Key: {
        'id': id
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Item) {
        return reject();
      }
      self.data = data.Item;
      return resolve();
    });
  });
};


Notification.prototype.findByUsername = function(username, unreadCount, last) {
  var self = this;
  var limit = 20;
  if(last) {
    var tmp = {
      id: last.id,
      date: last.date,
      user: last.user
    };
    last = tmp;
  }
  return new Promise(function(resolve, reject) {
    var options = {
      TableName: self.config.table,
      IndexName: self.config.keys.globalIndexes[0],
      Select: unreadCount ? 'COUNT' : 'ALL_PROJECTED_ATTRIBUTES',
      KeyConditionExpression: '#user = :username',
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        "#user": "user"
      },
      ExpressionAttributeValues: {
        ":username": String(username)
      },
      ExclusiveStartKey: last || null,  // fetch results which come _after_ this
      ScanIndexForward: false   // return results highest first
    };
    if(unreadCount) {
      options.FilterExpression = 'unread = :unread';
      options.ExpressionAttributeValues[':unread'] = true;
    }
    aws.dbClient.query(options, function(err, data) {
      if(err) return reject(err);
      if(unreadCount) {
        if(!data || !data.Count) {
          return resolve(0);
        }
      } else {
        if(!data || !data.Items) {
          return reject();
        }
      }
      var result = data.Items ? data.Items.slice(0, limit) : data.Count;
      return resolve(result);
    });
  });
}

// Override Model.save() in order to emit notification event to client
// Save a new database entry according to the model data
Notification.prototype.save = function(sessionID) {
  var self = this;
  return new Promise(function(resolve, reject) {
    // fetch the session for the user given by the sessionID
    if(sessionID) {
      aws.dbClient.get({
        TableName: db.Table.Sessions,
        Key: {
          'id': 'sess:' + sessionID
        }
      }, function(err, data) {
        if(err) return reject(err);
        if(!data || !data.Item) {
          return reject();
        }
        // TODO return # of notifications
        io.notifications.to(data.Item.socketID).emit('notification', null);
      });
    }

    aws.dbClient.put({
      TableName: self.config.table,
      Item: self.data
    }, function(err, data) {
      if(err) return reject(err);
      self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
      return resolve();
    });
  });
};

module.exports = Notification;
