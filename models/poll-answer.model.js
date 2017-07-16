'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

var PollAnswer = function(data) {
  this.config = {
    schema: db.Schema.PollAnswer,
    table: db.Table.PollAnswers,
    keys: db.Keys.PollAnswers,
  };
  this.data = this.sanitize(data);
};

// PollAnswer model inherits from Model
PollAnswer.prototype = Object.create(Model.prototype);
PollAnswer.prototype.constructor = PollAnswer;

// Get a PollAnswer by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no post found.
PollAnswer.prototype.findById = function (id) {
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


// Fetch the answers on a specific poll sorted by either date or number of votes
PollAnswer.prototype.findByPost = function (postid, sortBy, last) {
  const limit = 30;
  const self = this;
  let IndexName = self.config.keys.globalIndexes[1];

  if (sortBy == 'date') {
    IndexName = self.config.keys.globalIndexes[1];
  }
  else if (sortBy == 'votes') {
    IndexName = self.config.keys.globalIndexes[2];
  }

  if (last) {
    last = {
      id: last.id,
      postid: last.postid,
    };
  }

  return new Promise((resolve, reject) => {
    const params = {
      ExclusiveStartKey: last || null, // fetch results which come _after_ this
      ExpressionAttributeValues: { ':postid': String(postid) },
      IndexName,
      KeyConditionExpression: 'postid = :postid',
      ScanIndexForward: false, // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      TableName: self.config.table,
    };
    aws.dbClient.query(params, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      return resolve(data.Items.slice(0, limit));
    });
  });
};

// Validate the properties specified in 'properties' on the PollAnswer object,
// returning an array of any invalid ones
PollAnswer.prototype.validate = function (props) {
  const invalids = [];

  // ensure id exists and is of correct length
  if (props.includes('id')) {
    if (!validate.pollanswerid(this.data.id)) {
      invalids.push('id');
    }
  }

  // ensure postid exists and is of correct length
  if (props.includes('postid')) {
    if (!validate.postid(this.data.postid)) {
      invalids.push('postid');
    }
  }

  // ensure votes exists and is a valid number
  if (props.includes('votes')) {
    if (isNaN(this.data.votes)) {
      invalids.push('votes');
    }
  }

  // ensure title is valid
  if (props.includes('text')) {
    if (!this.data.text || this.data.text.length < 1 || this.data.text.length > 300) {
      invalids.push('text');
    }
  }

  // ensure creator is valid username
  if (props.includes('creator')) {
    if (!validate.username(this.data.creator)) {
      invalids.push('creator');
    }
  }

  // ensure creation date is valid
  if (props.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('date');
    }
  }

  return invalids;
};

module.exports = PollAnswer;
