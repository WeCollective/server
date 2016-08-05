'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var Post = function(data) {
  this.config = {
    schema: db.Schema.Post,
    table: db.Table.Posts,
    keys: db.Keys.Posts
  };
  this.data = this.sanitize(data);
};

// Post model inherits from Model
Post.prototype = Object.create(Model.prototype);
Post.prototype.constructor = Post;

// Validate the properties specified in 'properties' on the Post object,
// returning an array of any invalid ones
Post.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.postid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure branchid exists and is of correct length
  if(properties.indexOf('branchid') > -1) {
    if(!validate.branchid(this.data.branchid)) {
      invalids.push('branchid');
    }
    // ensure not posting to root wall
    if(this.data.branchid == 'root') {
      invalids.push('branchid');
    }
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure type is valid
  if(properties.indexOf('type') > -1) {
    if(this.data.type != 'text') {
      invalids.push('type');
    }
  }

  // ensure stats are valid numbers
  if(properties.indexOf('individual') > -1) {
    if(isNaN(this.data.individual)) {
      invalids.push('individual');
    }
  }
  if(properties.indexOf('local') > -1) {
    if(isNaN(this.data.local)) {
      invalids.push('local');
    }
  }
  if(properties.indexOf('up') > -1) {
    if(isNaN(this.data.up)) {
      invalids.push('up');
    }
  }
  if(properties.indexOf('down') > -1) {
    if(isNaN(this.data.down)) {
      invalids.push('down');
    }
  }
  if(properties.indexOf('rank') > -1) {
    if(isNaN(this.data.rank)) {
      invalids.push('rank');
    }
  }

  return invalids;
};

// Get a post by its id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Post.prototype.findById = function(id) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "id = :id",
      ExpressionAttributeValues: {
        ":id": id
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

// TODO: currently uses branchid-individual-index, make this versatile to
// use a local stat index too.
// Fetch the posts on a specific branch, using a specific stat, and filtered by time
Post.prototype.findByBranch = function(branchid, timeafter) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      IndexName: self.config.keys.globalIndexes[0],
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      KeyConditionExpression: "branchid = :branchid",
      FilterExpression: "#date >= :timeafter",
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        "#date": "date"
      },
      ExpressionAttributeValues: {
        ":branchid": String(branchid),
        ":timeafter": Number(timeafter)
      },
      ScanIndexForward: false   // return results highest first
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items);
    });
  });
};

module.exports = Post;
