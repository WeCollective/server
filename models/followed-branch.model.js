const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class FollowedBranch extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.FollowedBranches,
      schema: db.Schema.FollowedBranch,
      table: db.Table.FollowedBranches,
    };

    this.data = this.sanitize(props);
  }

  // Get a FollowedBranch by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findByUsername(username) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':username': username,
        },
        KeyConditionExpression: 'username = :username',
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

  // Validate the properties specified in 'properties' on the FollowedBranch object,
  // returning an array of any invalid ones
  validate(props) {
    let invalids = [];

    // ensure username is valid username
    if (props.includes('username')) {
      if (!validate.username(this.data.username)) {
        invalids = [
          ...invalids,
          'username',
        ];
      }
    }

    // ensure branchid exists and is of correct length
    if (props.includes('branchid')) {
      if (!validate.branchid(this.data.branchid)) {
        invalids = [
          ...invalids,
          'branchid',
        ];
      }
    }

    return invalids;
  }
}

module.exports = FollowedBranch;
