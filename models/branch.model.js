const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');

class Branch extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Branches,
      schema: db.Schema.Branch,
      table: db.Table.Branches,
    });
  }

  // Get root branches using the GSI 'parentid', which will be set to 'root'.
  // TODO: this has an upper limit on the number of results; if so, a LastEvaluatedKey
  // will be supplied to indicate where to continue the search from
  // (see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property)
  findSubbranches(parentid, timeafter, sortBy, last, limit) {
    if (limit === undefined || limit === null) {
      limit = 20;
    }

    let IndexName;

    switch(sortBy) {
      case 'post_count':
        IndexName = this.config.keys.globalIndexes[1];
        break;

      case 'post_points':
        IndexName = this.config.keys.globalIndexes[2];
        break;

      case 'post_comments':
        IndexName = this.config.keys.globalIndexes[3];
        break;

      case 'date':
      default:
        IndexName = this.config.keys.globalIndexes[0];
        break;
    }

    if (last) {
      const tmp = {
        id: last.id,
        parentid: last.parentid,
        [sortBy]: last[sortBy],
      };

      last = tmp;
    }

    const queryParams = {
      ExclusiveStartKey: last || null, // fetch results which come _after_ this
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':parentid': String(parentid),
        ':timeafter': Number(timeafter),
      },
      IndexName,
      // return results highest first
      ScanIndexForward: false,
      Select: 'ALL_PROJECTED_ATTRIBUTES',
      TableName: this.config.table,
    };

    if (sortBy === 'date') {
      queryParams.KeyConditionExpression = 'parentid = :parentid AND #date >= :timeafter';
    }
    else {
      queryParams.FilterExpression = '#date >= :timeafter';
      queryParams.KeyConditionExpression = 'parentid = :parentid';
    }

    return new Promise((resolve, reject) => {
      aws.dbClient.query(queryParams, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Items) {
          return reject();
        }

        const slice = limit ? data.Items.slice(0, limit) : data.Items;
        return resolve(slice);
      });
    });
  }
}

module.exports = Branch;
