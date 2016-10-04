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
  if(properties.indexOf('global') > -1) {
    if(isNaN(this.data.global)) {
      invalids.push('global');
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
  if(properties.indexOf('comment_count') > -1) {
    if(isNaN(this.data.comment_count)) {
      invalids.push('comment_count');
    }
  }

  if(properties.indexOf('nsfw') > -1) {
    if(!validate.boolean(this.data.nsfw)) {
      invalids.push('nsfw');
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
Post.prototype.findByBranch = function(branchid, timeafter, nsfw, sortBy, stat, postType, last) {
  var limit = 30;
  var self = this;
  var index = self.config.keys.globalIndexes[0];
  if(sortBy == 'points') {
    switch(stat) {
      case 'individual':
        index = self.config.keys.globalIndexes[0];
        break;
      case 'local':
        index = self.config.keys.globalIndexes[1];
        break;
      case 'global':
        index = self.config.keys.globalIndexes[4];
        break;
    }
  } else if(sortBy == 'date') {
    index = self.config.keys.globalIndexes[2];
  } else if(sortBy == 'comment_count') {
    index = self.config.keys.globalIndexes[3];
  }

  if(sortBy == 'points') {
    if(last) {
      var tmp = {
        id: last.id,
        branchid: last.branchid
      };
      tmp[stat] = last[stat];
      last = tmp;
    }
    return new Promise(function(resolve, reject) {
      var params = {
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
        ExclusiveStartKey: last || null,  // fetch results which come _after_ this
        ScanIndexForward: false   // return results highest first
      };
      if(postType !== 'all') {
        params.FilterExpression += " AND #type = :postType";
        params.ExpressionAttributeNames["#type"] = "type";
        params.ExpressionAttributeValues[":postType"] = String(postType);
      }
      if(!nsfw) {
        params.FilterExpression += " AND nsfw = :nsfw";
        params.ExpressionAttributeValues[":nsfw"] = false;
      }
      aws.dbClient.query(params, function(err, data) {
        if(err) return reject(err);
        if(!data || !data.Items) {
          return reject();
        }
        return resolve(data.Items.slice(0, limit));
      });
    });
  } else if(sortBy == 'date') {
    if(last) {
      last = {
        id: last.id,
        branchid: last.branchid,
        date: last.date
      };
    }
    return new Promise(function(resolve, reject) {
      var params = {
        TableName: self.config.table,
        IndexName: index,
        Select: 'ALL_PROJECTED_ATTRIBUTES',
        KeyConditionExpression: "branchid = :branchid AND #date >= :timeafter",
        // date is a reserved dynamodb keyword so must use this alias:
        ExpressionAttributeNames: {
          "#date": "date"
        },
        ExpressionAttributeValues: {
          ":branchid": String(branchid),
          ":timeafter": Number(timeafter)
        },
        ExclusiveStartKey: last || null,  // fetch results which come _after_ this
        ScanIndexForward: false   // return results highest first
      };
      if(postType !== 'all') {
        params.FilterExpression = "#type = :postType";
        params.ExpressionAttributeNames["#type"] = "type";
        params.ExpressionAttributeValues[":postType"] = String(postType);
      }
      aws.dbClient.query(params, function(err, data) {
        if(err) return reject(err);
        if(!data || !data.Items) {
          return reject();
        }
        return resolve(data.Items.slice(0, limit));
      });
    });
  } else if(sortBy == 'comment_count') {
    if(last) {
      last = {
        id: last.id,
        branchid: last.branchid,
        comment_count: last.comment_count
      };
    }
    return new Promise(function(resolve, reject) {
      var params = {
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
        ExclusiveStartKey: last || null,  // fetch results which come _after_ this
        ScanIndexForward: false   // return results highest first
      };
      if(postType !== 'all') {
        params.FilterExpression += " AND #type = :postType";
        params.ExpressionAttributeNames["#type"] = "type";
        params.ExpressionAttributeValues[":postType"] = String(postType);
      }
      aws.dbClient.query(params, function(err, data) {
        if(err) return reject(err);
        if(!data || !data.Items) {
          return reject();
        }
        return resolve(data.Items.slice(0, limit));
      });
    });
  }
};

// Get a post by both its post id and branch id, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
// Used to ensure a post exists on a given branch.
Post.prototype.findByPostAndBranchIds = function(postid, branchid) {
  var self = this;
  return new Promise(function(resolve, reject) {
    aws.dbClient.query({
      TableName: self.config.table,
      KeyConditionExpression: "id = :postid AND branchid = :branchid",
      ExpressionAttributeValues: {
        ":postid": postid,
        ":branchid": branchid
      }
    }, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items || data.Items.length == 0) {
        return reject();
      }
      self.data = data.Items[0];
      return resolve();
    });
  });
};

module.exports = Post;
