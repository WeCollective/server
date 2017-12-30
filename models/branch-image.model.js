const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const db = reqlib('config/database');
const Model = reqlib('models/model');
const validate = reqlib('models/validate');

class BranchImage extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.BranchImages,
      schema: db.Schema.BranchImages,
      table: db.Table.BranchImages,
    };

    this.data = this.sanitize(props);
    this.restricted = ['id'];
  }

  // Get a branch image of given type ('picture', 'cover') by it's id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no image entry found.
  findById(id, type) {
    if (!['picture', 'cover'].includes(type)) {
      return Promise.reject();
    }

    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id: `${id}-${type}`,
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
        return resolve(data.Item);
      });
    });
  }

  // Validate user picture object, returning an array of any invalid properties
  validate() {
    let invalids = [];

    // check for valid id ending with -picture or -cover
    if (!this.data.id || (!this.data.id.endsWith('-picture') && !this.data.id.endsWith('-cover'))) {
      invalids = [
        ...invalids,
        'id',
      ];
    }

    // check for valid date
    if (!validate.date(this.data.date)) {
      invalids = [
        ...invalids,
        'date',
      ];
    }

    // check for valid extension
    if (!validate.extension(this.data.extension)) {
      invalids = [
        ...invalids,
        'extension',
      ];
    }

    return invalids;
  }
}

module.exports = BranchImage;
