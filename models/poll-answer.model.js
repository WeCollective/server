'use strict';

var Model = require('./model.js');
var db = require('../config/database.js');
var aws = require('../config/aws.js');
var validate = require('./validate.js');

var PollAnswer = function(data) {
  this.config = {
    schema: db.Schema.PollAnswer,
    table: db.Table.PollAnswers,
    keys: db.Keys.PollAnswers
  };
  this.data = this.sanitize(data);
};

// PollAnswer model inherits from Model
PollAnswer.prototype = Object.create(Model.prototype);
PollAnswer.prototype.constructor = PollAnswer;

// Validate the properties specified in 'properties' on the PollAnswer object,
// returning an array of any invalid ones
PollAnswer.prototype.validate = function(properties) {
  var invalids = [];

  // ensure id exists and is of correct length
  if(properties.indexOf('id') > -1) {
    if(!validate.pollanswerid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure postid exists and is of correct length
  if(properties.indexOf('postid') > -1) {
    if(!validate.postid(this.data.postid)) {
      invalids.push('postid');
    }
  }

  // ensure votes exists and is a valid number
  if(properties.indexOf('votes') > -1) {
    if(isNaN(this.data.votes)) {
      invalids.push('votes');
    }
  }

  // ensure title is valid
  if(properties.indexOf('text') > -1) {
    if(!this.data.text || this.data.text.length < 1 || this.data.text.length > 300) {
      invalids.push('text');
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

  return invalids;
};

// Get a PollAnswer by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no post found.
PollAnswer.prototype.findById = function(id) {
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


// Fetch the answers on a specific poll sorted by either date or number of votes
PollAnswer.prototype.findByPost = function(postid, sortBy, last) {
  var limit = 30;
  var self = this;
  var index = self.config.keys.globalIndexes[1];
  if(sortBy == 'date') {
    index = self.config.keys.globalIndexes[1];
  } else if(sortBy == 'votes') {
    index = self.config.keys.globalIndexes[2];
  }
  if(last) {
    last = {
      id: last.id,
      postid: last.postid
    };
  }
  return new Promise(function(resolve, reject) {
    var params = {
      TableName: self.config.table,
      IndexName: index,
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      KeyConditionExpression: "postid = :postid",
      ExpressionAttributeValues: {
        ":postid": String(postid)
      },
      ExclusiveStartKey: last || null,  // fetch results which come _after_ this
      ScanIndexForward: false   // return results highest first
    };
    aws.dbClient.query(params, function(err, data) {
      if(err) return reject(err);
      if(!data || !data.Items) {
        return reject();
      }
      return resolve(data.Items.slice(0, limit));
    });
  });
};

module.exports = PollAnswer;
