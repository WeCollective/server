const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

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
}

module.exports = Mod;
