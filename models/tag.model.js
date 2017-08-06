'use strict';

const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

const Tag = function (data) {
  this.config = {
    keys: db.Keys.Tags,
    schema: db.Schema.Tag,
    table: db.Table.Tags,
  };
  this.data = this.sanitize(data);
};

// Tag model inherits from Model
Tag.prototype = Object.create(Model.prototype);
Tag.prototype.constructor = Tag;

// Get the tags of a specific branch, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Tag.prototype.findByBranch = function (branchid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':id': branchid,
      },
      KeyConditionExpression: 'branchid = :id',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      if (data.Items.length === 0) {
        return reject({
          code: 400,
          message: `Invalid branch tag "${branchid}"`,
        });
      }

      return resolve(data.Items);
    });
  });
};

// Get the all the branches with a specific tag, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
Tag.prototype.findByTag = function (tag) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':tag': tag,
      },
      IndexName: self.config.keys.globalIndexes[0],
      KeyConditionExpression: 'tag = :tag',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items) {
        return reject();
      }

      return resolve(data.Items);
    });
  });
};

Tag.prototype.findByBranchAndTag = function (branchid, tag) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':branchid': branchid,
        ':tag': tag,
      },
      KeyConditionExpression: 'branchid = :branchid AND tag = :tag',
      TableName: self.config.table,
    }, (err, data) => {
      if (err) {
        return reject(err);
      }

      if (!data || !data.Items || !data.Items.length) {
        return reject();
      }

      self.data = data.Items[0];
      return resolve(self.data);
    });
  });
};

// Validate the properties specified in 'properties' on the Tag object,
// returning an array of any invalid ones
Tag.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'branchid',
      'tag',
    ];
  }

  const invalids = [];

  if (properties.includes('branchid')) {
    if (!validate.branchid(this.data.branchid)) {
      invalids.push('Invalid branchid.');
    }
  }

  if (properties.includes('tag')) {
    if (!validate.branchid(this.data.tag)) {
      invalids.push('Invalid tag.');
    }
  }

  return invalids;
};

module.exports = Tag;
