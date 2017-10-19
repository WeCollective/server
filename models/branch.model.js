'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

var Branch = function(data) {
  this.config = {
    keys: db.Keys.Branches,
    schema: db.Schema.Branch,
    table: db.Table.Branches,
  };

  this.data = this.sanitize(data);
};

// Branch model inherits from Model
Branch.prototype = Object.create(Model.prototype);
Branch.prototype.constructor = Branch;

// Get a branch by its id from the db, and
// instantiate the object with this data.
// Rejects promise with true if database error, with false if no user found.
Branch.prototype.findById = function (id) {
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

// Get root branches using the GSI 'parentid', which will be set to 'root'.
// TODO: this has an upper limit on the number of results; if so, a LastEvaluatedKey
// will be supplied to indicate where to continue the search from
// (see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property)
Branch.prototype.findSubbranches = function(parentid, timeafter, sortBy, last, limit) {
  const self = this;

  if (limit === undefined || limit === null) {
    limit = 20;
  }

  let IndexName;

  switch(sortBy) {
    case 'date':
      IndexName = self.config.keys.globalIndexes[0];
      break;

    case 'post_count':
      IndexName = self.config.keys.globalIndexes[1];
      break;

    case 'post_points':
      IndexName = self.config.keys.globalIndexes[2];
      break;

    case 'post_comments':
      IndexName = self.config.keys.globalIndexes[3];
      break;

    default:
      IndexName = self.config.keys.globalIndexes[0];  // date index is default
      break;
  }

  if (last) {
    const tmp = {
      id: last.id,
      parentid: last.parentid,
      [sortBy]: last[sortBy],
    };

    last = tmp;
  }

  let queryParams = {
    ExclusiveStartKey: last || null,  // fetch results which come _after_ this
    // date is a reserved dynamodb keyword so must use this alias:
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: {
      ':parentid': String(parentid),
      ':timeafter': Number(timeafter),
    },
    IndexName,
    // return results highest first
    ScanIndexForward: false,
    Select: 'ALL_PROJECTED_ATTRIBUTES',
    TableName: self.config.table,
  };

  if (sortBy === 'date') {
    queryParams.KeyConditionExpression = 'parentid = :parentid AND #date >= :timeafter';
  }
  else {
    queryParams.FilterExpression = '#date >= :timeafter';
    queryParams.KeyConditionExpression = 'parentid = :parentid';
  }

  return new Promise((resolve, reject) => {
    aws.dbClient.query(queryParams, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      const slice = limit ? data.Items.slice(0, limit) : data.Items;
      return resolve(slice);
    });
  });
}

// Validate the properties specified in 'properties' on the branch object,
// returning an array of any invalid ones
Branch.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'creator',
      'date',
      'description',
      'id',
      'name',
      'parentid',
      'post_comments',
      'post_count',
      'post_points',
      'rules',
    ];
  }

  const invalids = [];

  if (properties.includes('creator')) {
    if (!validate.username(this.data.creator)) {
      invalids.push('Invalid creator.');
    }
  }

  if (properties.includes('date')) {
    if (!validate.date(this.data.date)) {
      invalids.push('Invalid date.');
    }
  }

  if (properties.includes('description')) {
    if (!this.data.description || this.data.description.length < 1) {
      invalids.push('Description cannot be empty.');
    }
    else if (this.data.description.length > 10000) {
      invalids.push('Description cannot be longer than 10,000 characters.');
    }
  }

  if (properties.includes('id')) {
    if (!validate.branchid(this.data.id)) {
      invalids.push('Invalid id.');
    }
  }

  if (properties.includes('name')) {
    if (!this.data.name || this.data.name.length < 1) {
      invalids.push('Visible name cannot be empty.');
    }
    else if (this.data.name.length > 30) {
      invalids.push('Visible name cannot be longer than 30 characters.');
    }
  }

  if (properties.includes('parentid')) {
    if (!validate.branchid(this.data.parentid)) {
      invalids.push('Invalid parentid.');
    }
  }

  if (properties.includes('post_comments')) {
    if (isNaN(this.data.post_comments)) {
      invalids.push('Invalid post_comments.');
    }
  }

  if (properties.includes('post_count')) {
    if (isNaN(this.data.post_count)) {
      invalids.push('Invalid post_count.');
    }
  }
  
  if (properties.includes('post_points')) {
    if (isNaN(this.data.post_points)) {
      invalids.push('Invalid post_points.');
    }
  }

  if (properties.includes('rules')) {
    if (!this.data.rules || this.data.rules.length < 1) {
      invalids.push('Rules cannot be empty.');
    }
    else if (this.data.rules.length > 10000) {
      invalids.push('Rules cannot be longer than 10,000 characters.');
    }
  }

  return invalids;
};

module.exports = Branch;
