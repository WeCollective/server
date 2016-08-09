'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var _ = require('lodash');

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
  }

  // ensure creation date is valid
  if(properties.indexOf('date') > -1) {
    if(!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  // ensure type is valid
  if(properties.indexOf('type') > -1) {
    if(this.data.type != 'text' && this.data.type != 'page' &&
       this.data.type != 'image' && this.data.type != 'audio' &&
       this.data.type != 'video') {
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

// Fetch the posts on a specific branch, using a specific stat, and filtered by time
Post.prototype.findByBranch = function(branchid, timeafter, stat) {
  var self = this;
  var index = self.config.keys.globalIndexes[0];
  switch(stat) {
    case 'individual':
      index = self.config.keys.globalIndexes[0];
      break;
    case 'local':
    case 'global':  // global stat requires ranking by local stat (but on root branch)
      index = self.config.keys.globalIndexes[1];
      break;
  }

  if(stat == 'global') {
    return new Promise(function(resolve, reject) {
      // fetch posts on the root branch sorted by local stat
      aws.dbClient.query({
        TableName: self.config.table,
        IndexName: index,
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        KeyConditionExpression: "branchid = :branchid",
        FilterExpression: "#date >= :timeafter",
        // date is a reserved dynamodb keyword so must use this alias:
        ExpressionAttributeNames: {
          "#date": "date"
        },
        ExpressionAttributeValues: {
          ":branchid": 'root',
          ":timeafter": Number(timeafter)
        },
        ScanIndexForward: false   // return results highest first
      }, function(err, data) {
        if(err) return reject(err);
        if(!data || !data.Items) {
          return reject();
        }

        var rootItems = data.Items;

        // get the posts on the specified branch which appear in the ids list
        aws.dbClient.query({
          TableName: self.config.table,
          IndexName: index,
          Select: 'ALL_PROJECTED_ATTRIBUTES',
          KeyConditionExpression: "branchid = :branchid",
          ExpressionAttributeValues: {
            ":branchid": String(branchid)
          },
          ScanIndexForward: false   // return results highest first
        }, function(err, data) {
          if(err) return reject(err);
          if(!data || !data.Items) {
            return reject();
          }

          // get array of just the ids of the posts appearing on the specified branch
          var ids = _.map(data.Items, 'id');

          // return only the posts from root branch which appear in the specified branch,
          // and at the same time transform the object st. the branchid is the specified
          // branch (not 'root') and the stat is renamed 'global'
          var items = rootItems.filter(function(item) {
            item.branchid = branchid;
            item.global = item.local;
            delete item.local;
            return ids.indexOf(item.id) > -1;
          });
          return resolve(items);
        });
      });
    });
  } else {
    return new Promise(function(resolve, reject) {
      aws.dbClient.query({
        TableName: self.config.table,
        IndexName: index,
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
  }
};

module.exports = Post;
