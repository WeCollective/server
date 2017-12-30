const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class ModLogEntry extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.ModLog,
      schema: db.Schema.ModLogEntry,
      table: db.Table.ModLog,
    };

    this.data = this.sanitize(props);
  }

  // Get a mod log by branch id, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no log data found.
  findByBranch(branchid) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': branchid,
        },
        KeyConditionExpression: 'branchid = :id',
        // Newest results first.
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
  }

  // Validate the properties specified in 'properties' on the ModLogEntry object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'action',
        'branchid',
        'data',
        'date',
        'username',
      ];
    }

    const allowedActions = [
      'addmod',
      'answer-subbranch-request',
      'make-subbranch-request',
      'removemod',
    ];

    let invalids = [];

    // Action and data must be checked whether specified or not.
    if (!this.data.action || !allowedActions.includes(this.data.action)) {
      invalids = [
        ...invalids,
        'action',
      ];
    }

    if (props.includes('branchid')) {
      if (!validate.branchid(this.data.branchid)) {
    
        invalids = [
          ...invalids,
          'branchid',
        ];
      }
    }

    if (!this.data.data) {
      invalids = [
        ...invalids,
        'data',
      ];
    }

    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'date',
        ];
      }
    }

    if (props.includes('username')) {
      if (!validate.username(this.data.username)) {
        invalids = [
          ...invalids,
          'username',
        ];
      }
    }

    return invalids;
  }
}

module.exports = ModLogEntry;
