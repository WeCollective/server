const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class Tag extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Tags,
      schema: db.Schema.Tag,
      table: db.Table.Tags,
    });
  }

  // Get the tags of a specific branch, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no data found.
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

        if (!data.Items.length) {
          return reject({
            code: 400,
            message: `Invalid branch tag "${branchid}"`,
          });
        }

        return resolve(data.Items);
      });
    });
  }

  // Get the all the branches with a specific tag, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no data found.
  findByTag(tag) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':tag': tag,
        },
        IndexName: this.config.keys.globalIndexes[0],
        KeyConditionExpression: 'tag = :tag',
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

  findByBranchAndTag(branchid, tag) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':branchid': branchid,
          ':tag': tag,
        },
        KeyConditionExpression: 'branchid = :branchid AND tag = :tag',
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return reject();
        }

        this.data = data.Items[0];
        return resolve(this.data);
      });
    });
  }

  // Validate the properties specified in 'properties' on the Tag object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'branchid',
        'tag',
      ];
    }

    let invalids = [];

    if (props.includes('branchid')) {
      if (!validate.branchid(this.data.branchid)) {
        invalids = [
          ...invalids,
          'Invalid branchid.'
        ];
      }
    }

    if (props.includes('tag')) {
      if (!validate.branchid(this.data.tag)) {
        invalids = [
          ...invalids,
          'Invalid tag.'
        ];
      }
    }

    return invalids;
  }
}

module.exports = Tag;
