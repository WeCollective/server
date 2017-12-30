const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class FlaggedPost extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.FlaggedPosts,
      schema: db.Schema.FlaggedPost,
      table: db.Table.FlaggedPosts,
    };

    this.data = this.sanitize(props);
  }

  // Fetch the flagged posts on a specific branch
  findByBranch(branchid, timeafter, nsfw, sortBy, stat, postType, last) {
    const limit = 30;
    const self = this;
    let index;

    switch (sortBy) {
    case 'branch_rules':
      index = self.config.keys.globalIndexes[1];
      break;

    case 'nsfw':
      index = self.config.keys.globalIndexes[4];
      break;

    case 'site_rules':
      index = self.config.keys.globalIndexes[2];
      break;

    case 'wrong_type':
      index = self.config.keys.globalIndexes[3];
      break;

    case 'date':
    default:
      index = self.config.keys.globalIndexes[0];
      break;
    }

    if (sortBy === 'date') {
      if (last) {
        last = {
          branchid: last.branchid,
          date: last.date,
          id: last.id,
        };
      }

      return new Promise((resolve, reject) => {
        const params = {
          ExclusiveStartKey: last || null, // fetch results which come _after_ this
          // date is a reserved dynamodb keyword so must use this alias:
          ExpressionAttributeNames: {
            '#date': 'date',
          },
          ExpressionAttributeValues: {
            ':branchid': String(branchid),
            ':timeafter': Number(timeafter),
          },
          IndexName: index,
          KeyConditionExpression: 'branchid = :branchid AND #date >= :timeafter',
          ScanIndexForward: false, // return results highest first
          Select: 'ALL_PROJECTED_ATTRIBUTES',
          TableName: self.config.table,
        };

        if (postType !== 'all') {
          params.FilterExpression = '#type = :postType';
          params.ExpressionAttributeNames['#type'] = 'type';
          params.ExpressionAttributeValues[':postType'] = String(postType);
        }

        aws.dbClient.query(params, (err, data) => {
          if (err) {
            return reject(err);
          }

          if (!data || !data.Items) {
            return reject();
          }

          return resolve(data.Items.slice(0, limit));
        });
      });
    }
    else {
      if (last) {
        const tmp = {
          branchid: last.branchid,
          id: last.id,
        };
        tmp[`${sortBy}_count`] = last[`${sortBy}_count`];
        last = tmp;
      }

      return new Promise((resolve, reject) => {
        const params = {
          ExclusiveStartKey: last || null, // fetch results which come _after_ this
          // date is a reserved dynamodb keyword so must use this alias:
          ExpressionAttributeNames: {
            '#date': 'date',
          },
          ExpressionAttributeValues: {
            ':branchid': String(branchid),
            ':timeafter': Number(timeafter),
          },
          FilterExpression: '#date >= :timeafter',
          IndexName: index,
          KeyConditionExpression: 'branchid = :branchid',
          ScanIndexForward: false, // return results highest first
          Select: 'ALL_PROJECTED_ATTRIBUTES',
          TableName: self.config.table,
        };

        if (postType !== 'all') {
          params.FilterExpression += ' AND #type = :postType';
          params.ExpressionAttributeNames['#type'] = 'type';
          params.ExpressionAttributeValues[':postType'] = String(postType);
        }

        aws.dbClient.query(params, (err, data) => {
          if (err) {
            return reject(err);
          }

          if (!data || !data.Items) {
            return reject();
          }

          return resolve(data.Items.slice(0, limit));
        });
      });
    }
  }

  // Get a flaggedpost by its id, passing in results to promise resolve.
  // Rejects promise with true if database error, with false if no data found.
  findById(id) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': id,
        },
        KeyConditionExpression: 'id = :id',
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

  findByPostAndBranchIds(postid, branchid) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':branchid': branchid,
          ':postid': postid,
        },
        KeyConditionExpression: 'id = :postid AND branchid = :branchid',
        TableName: self.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return reject();
        }

        self.data = data.Items[0];
        return resolve();
      });
    });
  }

  // Validate the properties specified in 'properties' on the FlaggedPost object,
  // returning an array of any invalid ones
  validate(props) {
    let invalids = [];

    // ensure id exists and is of correct length
    if (props.includes('id')) {
      if (!validate.postid(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
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

    // ensure creation date is valid
    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'date',
        ];
      }
    }

    // ensure type is valid
    if (props.includes('type')) {
      if (!['text', 'page', 'image', 'audio', 'video'].includes(this.data.type)) {
        invalids = [
          ...invalids,
          'type',
        ];
      }
    }

    // ensure flag counts are valid numbers
    if (props.includes('branch_rules_count')) {
      if (Number.isNaN(this.data.branch_rules_count)) {
        invalids = [
          ...invalids,
          'branch_rules_count',
        ];
      }
    }

    if (props.includes('site_rules_count')) {
      if (Number.isNaN(this.data.site_rules_count)) {
        invalids = [
          ...invalids,
          'site_rules_count',
        ];
      }
    }

    if (props.includes('wrong_type_count')) {
      if (Number.isNaN(this.data.wrong_type_count)) {
        invalids = [
          ...invalids,
          'wrong_type_count',
        ];
      }
    }

    if (props.includes('nsfw_count')) {
      if (Number.isNaN(this.data.nsfw_count)) {
        invalids = [
          ...invalids,
          'nsfw_count',
        ];
      }
    }

    return invalids;
  }
}

module.exports = FlaggedPost;
