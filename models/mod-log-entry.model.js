const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

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
}

module.exports = ModLogEntry;
