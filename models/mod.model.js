const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class Mod extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Mods,
      schema: db.Schema.Mod,
      table: db.Table.Mods,
    });
  }

  // Get the mods of a specific branch, passing results into resolve
  // Rejects promise with true if database error, with false if no mods found.
  findByBranch(branchid) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': branchid,
        },
        KeyConditionExpression: 'branchid = :id',
        TableName: this.config.table,
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
