const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class Mod extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Mods,
      schema: db.Schema.Mod,
      table: db.Table.Mods,
    };

    this.data = this.sanitize(props);
  }

  // Get the mods of a specific branch, passing results into resolve
  // Rejects promise with true if database error, with false if no mods found.
  findByBranch(branchid) {
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

        return resolve(data.Items);
      });
    });
  }

  // Validate the properties specified in 'properties' on the mod object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'branchid',
        'date',
        'username',
      ];
    }

    let invalids = [];

    if (props.includes('branchid')) {
      if (!validate.branchid(this.data.branchid)) {
        invalids = [
          ...invalids,
          'Invalid branchid.',
        ];
      }
    }

    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'Invalid date.',
        ];
      }
    }

    if (props.includes('username')) {
      if (!validate.username(this.data.username)) {
        invalids = [
          ...invalids,
          'Invalid username.',
        ];
      }
    }

    return invalids;
  }
}

module.exports = Mod;
