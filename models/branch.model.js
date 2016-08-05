'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var Branch = function(data) {
  this.config = {
    schema: db.Schema.Branch,
    table: db.Table.Branches,
    keys: db.Keys.Branches
  };
  this.data = this.sanitize(data);
};

// Branch model inherits from Model
Branch.prototype = Object.create(Model.prototype);
Branch.prototype.constructor = Branch;

// Validate the properties specified in 'properties' on the branch object,
// returning an array of any invalid ones
Branch.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.branchid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure name exists and is of correct length
  if(properties.indexOf('name') > -1) {
    if(!this.data.name || this.data.name.length < 1 || this.data.name.length > 30) {
      invalids.push('name');
    }
  }

  // ensure creator is valid username
  if(properties.indexOf('creator') > -1) {
    if(!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure valid parentid
  if(properties.indexOf('parentid') > -1) {
    if(!validate.branchid(this.data.parentid)) {
      invalids.push('parentid');
    }
  }

  // ensure description is of valid length
  if(properties.indexOf('description') > -1) {
    if(!this.data.description || this.data.description.length > 250 || this.data.description.length < 1) {
      invalids.push('description');
    }
  }

  // ensure rules text is of valid length
  if(properties.indexOf('rules') > -1) {
    if(!this.data.rules || this.data.rules.length > 250 || this.data.rules.length < 1) {
      invalids.push('rules');
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
}

module.exports = Branch;
