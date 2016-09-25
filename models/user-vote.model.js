'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var UserVote = function(data) {
  this.config = {
    schema: db.Schema.UserVote,
    table: db.Table.UserVotes,
    keys: db.Keys.UserVotes
  };
  this.data = this.sanitize(data);
};

// UserVote model inherits from Model
UserVote.prototype = Object.create(Model.prototype);
UserVote.prototype.constructor = UserVote;

// Validate the properties specified in 'properties' on the UserVote object,
// returning an array of any invalid ones
UserVote.prototype.validate = function(properties) {
  var invalids = [];

  if(properties.indexOf('username') > -1) {
    if(!validate.username(this.data.username)) {
      invalids.push('username');
    }
  }

  if(properties.indexOf('direction') > -1) {
    if(this.data.direction !== 'up' && this.data.direction !== 'down') {
      invalids.push('direction');
    }
  }

  return invalids;
};


UserVote.prototype.findByUsernameAndItemId = function(username, itemid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "username = :username AND itemid = :itemid",
      ExpressionAttributeValues: {
        ":username": username,
        ":itemid": itemid
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items || data.Items.length == 0) {
        return reject();
      }
      self.data = data.Items[0];
      resolve();
    });
  });
};

module.exports = UserVote;
