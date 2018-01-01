const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class FlaggedPost extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.FlaggedPosts,
      schema: db.Schema.FlaggedPost,
      table: db.Table.FlaggedPosts,
    });
  }

  // Fetch the flagged posts on a specific branch
  findByBranch(branchid, timeafter, nsfw, sortBy, stat, postType, last) {
    const limit = 30;
    let index;

    switch (sortBy) {
      case 'branch_rules':
        index = this.config.keys.globalIndexes[1];
        break;

      case 'nsfw':
        index = this.config.keys.globalIndexes[4];
        break;

      case 'site_rules':
        index = this.config.keys.globalIndexes[2];
        break;

      case 'wrong_type':
        index = this.config.keys.globalIndexes[3];
        break;

      case 'date':
      default:
        index = this.config.keys.globalIndexes[0];
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
          TableName: this.config.table,
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
          TableName: this.config.table,
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
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':id': id,
        },
        KeyConditionExpression: 'id = :id',
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

  findByPostAndBranchIds(postid, branchid) {
    return new Promise((resolve, reject) => {
      aws.dbClient.query({
        ExpressionAttributeValues: {
          ':branchid': branchid,
          ':postid': postid,
        },
        KeyConditionExpression: 'id = :postid AND branchid = :branchid',
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items || !data.Items.length) {
          return reject();
        }

        this.data = data.Items[0];
        return resolve();
      });
    });
  }

  validate(props) {
    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let test;

      switch (key) {
        case 'branch_rules_count':
        case 'nsfw_count':
        case 'site_rules_count':
        case 'wrong_type_count':
          test = validate.number;
          break;

        case 'branchid':
          test = validate.branchid;
          break;

        case 'date':
          test = validate.date;
          break;

        case 'id':
          test = validate.postid;
          break;

        case 'type':
          test = validate.postType;
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

module.exports = FlaggedPost;
