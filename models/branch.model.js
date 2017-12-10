const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class Branch extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Branches,
      schema: db.Schema.Branch,
      table: db.Table.Branches,
    };

    this.data = this.sanitize(props);
  }

  // Get a branch by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no user found.
  findById(id) {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id,
        },
        TableName: self.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Item) {
          return reject();
        }

        self.data = data.Item;
        return resolve(self.data);
      });
    });
  }

  // Get root branches using the GSI 'parentid', which will be set to 'root'.
  // TODO: this has an upper limit on the number of results; if so, a LastEvaluatedKey
  // will be supplied to indicate where to continue the search from
  // (see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property)
  findSubbranches(parentid, timeafter, sortBy, last, limit) {
    const self = this;

    if (limit === undefined || limit === null) {
      limit = 20;
    }

    let IndexName;

    switch(sortBy) {
    case 'post_count':
      IndexName = self.config.keys.globalIndexes[1];
      break;

    case 'post_points':
      IndexName = self.config.keys.globalIndexes[2];
      break;

    case 'post_comments':
      IndexName = self.config.keys.globalIndexes[3];
      break;

    case 'date':
    default:
      IndexName = self.config.keys.globalIndexes[0];
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
      TableName: self.config.table,
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

  // Validate the properties specified in 'properties' on the branch object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'creator',
        'date',
        'description',
        'id',
        'name',
        'parentid',
        'post_comments',
        'post_count',
        'post_points',
        'rules',
      ];
    }

    let invalids = [];

    if (props.includes('creator')) {
      if (!validate.username(this.data.creator)) {
        invalids = [
          ...invalids,
          'Invalid creator.',
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

    if (props.includes('description')) {
      if (!this.data.description || this.data.description.length < 1) {
        invalids = [
          ...invalids,
          'Description cannot be empty.',
        ];
      }
      else if (this.data.description.length > 10000) {
        invalids = [
          ...invalids,
          'Description cannot be longer than 10,000 characters.',
        ];
      }
    }

    if (props.includes('id')) {
      if (!validate.branchid(this.data.id)) {
        invalids = [
          ...invalids,
          'Invalid id.',
        ];
      }
    }

    if (props.includes('name')) {
      if (!this.data.name || this.data.name.length < 1) {
        invalids = [
          ...invalids,
          'Visible name cannot be empty.',
        ];
      }
      else if (this.data.name.length > 30) {
        invalids = [
          ...invalids,
          'Visible name cannot be longer than 30 characters.',
        ];
      }
    }

    if (props.includes('parentid')) {
      if (!validate.branchid(this.data.parentid)) {
        invalids = [
          ...invalids,
          'Invalid parentid.',
        ];
      }
    }

    if (props.includes('post_comments')) {
      if (Number.isNaN(this.data.post_comments)) {
        invalids = [
          ...invalids,
          'Invalid post_comments.',
        ];
      }
    }

    if (props.includes('post_count')) {
      if (Number.isNaN(this.data.post_count)) {
        invalids = [
          ...invalids,
          'Invalid post_count.',
        ];
      }
    }
    
    if (props.includes('post_points')) {
      if (Number.isNaN(this.data.post_points)) {
        invalids = [
          ...invalids,
          'Invalid post_points.',
        ];
      }
    }

    if (props.includes('rules')) {
      if (this.data.rules.length > 10000) {
        invalids = [
          ...invalids,
          'Rules cannot be longer than 10,000 characters.',
        ];
      }
    }

    return invalids;
  }
}

module.exports = Branch;
