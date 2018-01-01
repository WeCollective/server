const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class Constant extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.Constants,
      schema: db.Schema.Constant,
      table: db.Table.Constants,
    });
  }

  // Get a Constant by its id from the db, and instantiate the object with this data.
  // Rejects promise with true if database error, with false if no constant found.
  // Update: Preserve functionality, but support fetching multiple constants at once.
  // this.validate() will not work in such cases, we should support multiple items in all
  // models though.
  findById(ids) {
    const { table } = this.config;

    if (!Array.isArray(ids)) {
      ids = [ids];
    }

    return new Promise((resolve, reject) => {
      aws.dbClient.batchGet({
        RequestItems: {
          [table]: {
            Keys: ids.map(id => ({ id })),
          },
        },
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Responses) {
          return reject();
        }

        const Responses = data.Responses[table];

        if (!Responses || !Responses.length) {
          return reject();
        }

        this.data = ids.length === 1 ? Responses[0] : Responses;
        return resolve(this.data);
      });
    });
  }

  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'data',
        'id',
      ];
    }

    let invalids = [];

    props.forEach(key => {
      const value = this.data[key];
      let params = [];
      let test;

      switch (key) {
        case 'data':
          params = [this.data.id]
          test = validate.wecoConstantValue;
          break;

        case 'id':
          test = validate.wecoConstantId;
          break;

        default:
          throw new Error(`Invalid validation key "${key}"`);
      }

      if (!test(value, ...params)) {
        invalids = [
          ...invalids,
          `Invalid ${key} - ${value}.`,
        ];
      }
    });

    return invalids;
  }
}

module.exports = Constant;
