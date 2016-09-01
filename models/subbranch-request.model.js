'use strict';

var Model = require('./model.js');
var Mod = require('./mod.model.js');
var Notification = require('./notification.model.js');

var NotificationTypes = require('../config/notification-types.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var _ = require('lodash');

var SubBranchRequest = function(data) {
  this.config = {
    schema: db.Schema.SubBranchRequest,
    table: db.Table.SubBranchRequests,
    keys: db.Keys.SubBranchRequests
  };
  this.data = this.sanitize(data);
};

// SubBranchRequest model inherits from Model
SubBranchRequest.prototype = Object.create(Model.prototype);
SubBranchRequest.prototype.constructor = SubBranchRequest;

// Validate the properties specified in 'properties' on the branch object,
// returning an array of any invalid ones
SubBranchRequest.prototype.validate = function(properties) {
  var invalids = [];

  // ensure parentid exists and is of correct length
  if(properties.indexOf('parentid') > -1) {
    if(!validate.branchid(this.data.parentid)) {
      invalids.push('parentid');
    }
    // ensure parentid is not root
    if(this.data.parentid == 'root') {
      invalids.push('parentid');
    }
  }

  // ensure childid exists and is of correct length
  if(properties.indexOf('childid') > -1) {
    if(!validate.branchid(this.data.childid)) {
      invalids.push('childid');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  if(properties.indexOf('creator') > -1) {
    if(!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  return invalids;
};


// Get a subbranch request by the parent and childs ids, passing data to resolve
// Rejects promise with true if database error, with false if no data found.
SubBranchRequest.prototype.find = function(parentid, childid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "parentid = :parentid and childid = :childid",
      ExpressionAttributeValues: {
        ":parentid": parentid,
        ":childid": childid
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
};

// Get the subbranch requests of a specific branch, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
SubBranchRequest.prototype.findByBranch = function(branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.globalIndexes[0],
      KeyConditionExpression: "parentid = :id",
      ExpressionAttributeValues: {
        ":id": branchid
      },
      ScanIndexForward: false   // return results newest first
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
};

// Override Model.save() in order to create a notification for the branch
// mods whenever a new SubBranchRequest is created
SubBranchRequest.prototype.save = function() {
  var self = this;
  return new Promise(function(resolve, reject) {
    // fetch the mods of the parent (recipient) branch
    var parentMods, childMods;
    new Mod().findByBranch(self.data.parentid).then(function(mods) {
      parentMods = mods;
      return new Mod().findByBranch(self.data.childid);
    }).then(function(mods) {
      childMods = mods;
      // remove any duplicates e.g. for user who is a mod of both branches
      var allMods = _.uniqBy(parentMods.concat(childMods), 'username');

      // send notification of the new child branch request to these mods
      var promises = [];
      var time = new Date().getTime();
      for(var i = 0; i < allMods.length; i++) {
        var notification = new Notification({
          id: allMods[i].username + '-' + time,
          user: allMods[i].username,
          date: time,
          unread: true,
          type: NotificationTypes.NEW_CHILD_BRANCH_REQUEST,
          data: {
            childid: self.data.childid,
            parentid: self.data.parentid,
            username: self.data.creator
          }
        });

        var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
        var invalids = notification.validate(propertiesToCheck);
        if(invalids.length > 0) {
          console.error('Error creating notification.');
          return error.InternalServerError(res);
        }

        promises.push(notification.save());
      }

      return Promise.all(promises);
    }).then(function () {
      // save the subbranchRequest
      aws.dbClient.put({
        TableName: self.config.table,
        Item: self.data
      }, function(err, data) {
        if(err) return reject(err);
        self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
        return resolve();
      });
    });
  });
};

module.exports = SubBranchRequest;
