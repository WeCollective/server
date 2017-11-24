const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class Constant extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.Constants,
      schema: db.Schema.Constant,
      table: db.Table.Constants,
    };

    this.data = this.sanitize(props);
  }

  // Get a Constant by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no constant found.
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

  // Validate the properties specified in 'properties' on the Constant object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'data',
        'id',
      ];
    }

    let invalids = [];

    if (props.includes('data')) {
      if (!validate.wecoConstantValue(this.data.id, this.data.data)) {
        invalids = [
          ...invalids,
          'data',
        ];
      }
    }

    if (props.includes('id')) {
      if (!validate.wecoConstantId(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
        ];
      }
    }

    return invalids;
  }
}

module.exports = Constant;
