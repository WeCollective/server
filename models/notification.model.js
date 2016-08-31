'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

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

/*
// Get root branches using the GSI 'parentid', which will be set to 'root'.
// TODO: this has an upper limit on the number of results; if so, a LastEvaluatedKey
// will be supplied to indicate where to continue the search from
// (see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property)
Branch.prototype.findSubbranches = function(parentid, timeafter) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.globalIndexes[0],
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      KeyConditionExpression: "parentid = :parentid AND #date >= :timeafter",
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        "#date": "date"
      },
      ExpressionAttributeValues: {
        ":parentid": String(parentid),
        ":timeafter": Number(timeafter)
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
}*/

module.exports = Notification;
