'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');

var Branch = function(data) {
  this.config = {
    schema: db.Schema.Branch,
    table: db.Table.Branches,
    keys: db.Keys.Branches
  };
  this.data = this.sanitize(data);
};

// User model inherits from Model
Branch.prototype = Object.create(Model.prototype);
Branch.prototype.constructor = Branch;

// Validate user object, returning an array of any invalid properties
Branch.prototype.validate = function() {
  var invalids = [];

  // ensure id exists and is of correct length
  if(!this.data.id || this.data.id.length < 1 || this.data.id.length > 20) {
    invalids.push('id');
  }

  // ensure id contains no whitespace
  if(/\s/g.test(this.data.id)) {
    invalids.push('id');
  }

  // ensure name exists and is of correct length
  if(!this.data.name || this.data.name.length < 1 || this.data.name.length > 20) {
    invalids.push('name');
  }

  // ensure mods is an array with at least one entry
  if(!this.data.mods || this.data.mods.constructor !== Array || this.data.mods.length < 1) {
    invalids.push('mods');
  }

  // TODO ensure each mod is a valid username
  // TODO ensure creator is valid username
  if(!this.data.creator) {
    invalids.push('creator');
  }

  // ensure creation date is valid
  if(!this.data.date || !Number(this.data.date) > 0) {
    invalids.push('date');
  }

  // if parent id is not specified, make this a root branch
  if(!this.data.parentid) {
    this.data.parentid = 'root';
  } else {
    // ...ensure it is of the correct length
    if(this.data.parentid.length < 1 || this.data.parentid.length > 20) {
      invalids.push('parentid');
    }
    // ...and contains no whitespace
    if(/\s/g.test(this.data.parentid)) {
      invalids.push('parentid');
    }
  }

  return invalids;
};

// Get a user by their username from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Branch.prototype.findById = function(id) {
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

// Get root branches using the GSI 'parentid', which will be set to 'root'.
// TODO: this has an upper limit on the number of results; if so, a LastEvaluatedKey
// will be supplied to indicate where to continue the search from
// (see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property)
Branch.prototype.findSubbranches = function(parentid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.secondary.global,
      Select: 'ALL_ATTRIBUTES',
      KeyConditionExpression: "parentid = :parentid",
      ExpressionAttributeValues: {
          ":parentid": parentid
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
}

module.exports = Branch;
