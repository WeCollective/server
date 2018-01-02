const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

class FollowedBranch extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.FollowedBranches,
      schema: db.Schema.FollowedBranch,
      table: db.Table.FollowedBranches,
    });
  }

  // Get a FollowedBranch by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findByUsername(username) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':username': username,
        },
        KeyConditionExpression: 'username = :username',
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

module.exports = FollowedBranch;
