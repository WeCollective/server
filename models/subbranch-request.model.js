'use strict';

const Model = require('./model.js');
const Mod = require('./mod.model.js');
const Notification = require('./notification.model.js');

const NotificationTypes = require('../config/notification-types.js');
const db = require('../config/database.js');
const aws = require('../config/aws.js');
const validate = require('./validate.js');

const _ = require('lodash');

const SubBranchRequest = function (data) {
  this.config = {
    keys: db.Keys.SubBranchRequests,
    schema: db.Schema.SubBranchRequest,
    table: db.Table.SubBranchRequests,
  };
  this.data = this.sanitize(data);
};

// SubBranchRequest model inherits from Model
SubBranchRequest.prototype = Object.create(Model.prototype);
SubBranchRequest.prototype.constructor = SubBranchRequest;

// Get a subbranch request by the parent and childs ids, passing data to resolve
// Rejects promise with true if database error, with false if no data found.
SubBranchRequest.prototype.find = function (parentid, childid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':childid': childid,
        ':parentid': parentid,
      },
      KeyConditionExpression: 'parentid = :parentid and childid = :childid',
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

// Get the subbranch requests of a specific branch, passing in results to promise resolve.
// Rejects promise with true if database error, with false if no data found.
SubBranchRequest.prototype.findByBranch = function (branchid) {
  const self = this;

  return new Promise((resolve, reject) => {
    aws.dbClient.query({
      ExpressionAttributeValues: {
        ':id': branchid,
      },
      IndexName: self.config.keys.globalIndexes[0],
      KeyConditionExpression: 'parentid = :id',
      // return results newest first
      ScanIndexForward: false,
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

// Override Model.save() in order to create a notification for the branch
// mods whenever a new SubBranchRequest is created
SubBranchRequest.prototype.save = function () {
  const self = this;

  return new Promise((resolve, reject) => {
    // fetch the mods of the parent (recipient) branch
    let parentMods;
    let childMods;

    new Mod()
      .findByBranch(self.data.parentid)
      .then(mods => {
        parentMods = mods;
        return new Mod().findByBranch(self.data.childid);
      })
      .then(mods => {
        childMods = mods;
        // remove any duplicates e.g. for user who is a mod of both branches
        const allMods = _.uniqBy(parentMods.concat(childMods), 'username');

        // send notification of the new child branch request to these mods
        const promises = [];
        const date = new Date().getTime();
        for (let i = 0; i < allMods.length; i += 1) {
          const notification = new Notification({
            data: {
              childid: self.data.childid,
              parentid: self.data.parentid,
              username: self.data.creator,
            },
            date,
            id: `${allMods[i].username}-${date}`,
            unread: true,
            user: allMods[i].username,
            type: NotificationTypes.NEW_CHILD_BRANCH_REQUEST,
          });

          const invalids = notification.validate();
          if (invalids.length > 0) {
            console.error('Error creating notification.');
            return error.InternalServerError(res);
          }

          promises.push(notification.save());
        }

        return Promise.all(promises);
      })
      .then(() => {
        // save the subbranchRequest
        aws.dbClient.put({
          Item: self.data,
          TableName: self.config.table,
        }, (err, data) => {
          if (err) {
            return reject(err);
          }

          // clear dirtys array
          self.dirtys.splice(0, self.dirtys.length);
          return resolve();
        });
      });
  });
};

// Validate the properties specified in 'properties' on the branch object,
// returning an array of any invalid ones
SubBranchRequest.prototype.validate = function (properties) {
  if (!properties || properties.length === 0) {
    properties = [
      'childid',
      'creator',
      'date',
      'parentid',
    ];
  }

  const invalids = [];

  if (properties.includes('childid')) {
    if (!validate.branchid(this.data.childid)) {
      invalids.push('Invalid childid.');
    }
  }

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

  if (properties.includes('parentid')) {
    if (!validate.branchid(this.data.parentid)) {
      invalids.push('Invalid parentid.');
    }
  }

  return invalids;
};

module.exports = SubBranchRequest;
