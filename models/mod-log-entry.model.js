const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class ModLogEntry extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.ModLog,
      schema: db.Schema.ModLogEntry,
      table: db.Table.ModLog,
    });
  }

  // Get a mod log by branch id, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no log data found.
  findByBranch(branchid) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': branchid,
        },
        KeyConditionExpression: 'branchid = :id',
        // Newest results first.
        ScanIndexForward: false,
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

    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let test;

      switch (key) {
        case 'action':
          test = validate.modLogAction;
          break;

        case 'branchid':
          test = validate.branchid;
          break;

        case 'data':
          test = validate.exists;
          break;

        case 'date':
          test = validate.date;
          break;

        case 'username':
          test = validate.username;
          break;

        default:
          throw new Error(`Invalid validation key "${key}"`);
      }

      if (!test(value)) {
        invalids = [
          ...invalids,
          `Invalid ${key} - ${value}.`,
        ];
      }
    });

    return invalids;
  }
}

module.exports = ModLogEntry;
