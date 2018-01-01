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
    const self = this;
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

        self.data = ids.length === 1 ? Responses[0] : Responses;
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
