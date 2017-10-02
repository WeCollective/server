'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const io = require('../config/io')();
const Model = require('./model');
const validate = require('./validate');

const Notification = function (data) {
  this.config = {
    keys: db.Keys.Notifications,
    schema: db.Schema.Notification,
    table: db.Table.Notifications,
  };
  this.data = this.sanitize(data);
};

// Notification model inherits from Model
Notification.prototype = Object.create(Model.prototype);
Notification.prototype.constructor = Notification;

// Get a Notification by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Notification.prototype.findById = function (id) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.get({
      Key: { id },
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Item) {
        return reject();
      }

      self.data = data.Item;
      return resolve(self.data);
    });
  });
};

Notification.prototype.findByUsername = function (username, unreadCount, last, getAllUnread) {
  const self = this;
  const limit = getAllUnread !== undefined ? 0 : 20;
  
  if (last) {
    const tmp = {
      id: last.id,
      date: last.date,
      user: last.user,
    };

    last = tmp;
  }

  return new Promise((resolve, reject) => {
    const options = {
      // fetch results which come _after_ this
      ExclusiveStartKey: last || null,
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        '#user': 'user',
      },
      ExpressionAttributeValues: {
        ':username': String(username),
      },
      IndexName: self.config.keys.globalIndexes[0],
      KeyConditionExpression: '#user = :username',
      // return results highest first
      ScanIndexForward: false,
      Select: unreadCount ? 'COUNT' : 'ALL_PROJECTED_ATTRIBUTES',
      TableName: self.config.table,
    };

    if (unreadCount || getAllUnread === true) {
      options.FilterExpression = 'unread = :unread';
      options.ExpressionAttributeValues[':unread'] = true;
    }

    aws.dbClient.query(options, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (unreadCount) {
        if (!data || !data.Count) {
          return resolve(0);
        }
      }
      else {
        if (!data || !data.Items) {
          return reject();
        }
      }

      let result;
      if (data.Items) {
        result = limit ? data.Items.slice(0, limit) : data.Items;
      }
      else {
        result = data.Count;
      }

      return resolve(result);
    });
  });
};

// Override Model.save() in order to emit notification event to client
// Save a new database entry according to the model data
Notification.prototype.save = function (sessionId) {
  const self = this;

  return new Promise((resolve, reject) => {
    // Fetch the session for the user given by the sessionId.
    // todo Legacy now since we don't use sessions anymore. Not sure how the original
    // implementation was meant to work.
    /*
    if (sessionId) {
      aws.dbClient.get({
        Key: {
          id: `sess:${sessionId}`,
        },
        TableName: db.Table.Sessions,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Item) {
          return reject();
        }

        // TODO return # of notifications
        io.notifications.to(data.Item.socketID).emit('notification', null);
      });
    }
    */

    aws.dbClient.put({
      Item: self.data,
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      // Clear dirtys array.
      self.dirtys.splice(0, self.dirtys.length);
      return resolve();
    });
  });
};

// Validate the properties specified in 'properties' on the Notification object,
// returning an array of any invalid ones
Notification.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'data',
      'date',
      'id',
      'type',
      'unread',
      'user',
    ];
  }

  const invalids = [];

  // TODO check data is a valid JSON for the given type
  if (properties.includes('data')) {
    // 
  }

  if (properties.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  if (properties.includes('id')) {
    if (!validate.notificationid(this.data.id)) {
      invalids.push('id');
    }
  }

  if (properties.includes('type')) {
    if (!validate.notificationType(this.data.type)) {
      invalids.push('type');
    }
  }

  if (properties.includes('unread')) {
    if (!validate.boolean(this.data.unread)) {
      invalids.push('unread');
    }
  }

  if (properties.includes('user')) {
    if (!validate.username(this.data.user)) {
      invalids.push('user');
    }
  }

  return invalids;
};

module.exports = Notification;
