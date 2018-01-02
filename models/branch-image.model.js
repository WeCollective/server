const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');
const Constants = reqlib('config/constants');
const db = reqlib('config/database');
const Model = reqlib('models/model');

class BranchImage extends Model {
  constructor(props) {
    super(props, {
      keys: db.Keys.BranchImages,
      schema: db.Schema.BranchImages,
      table: db.Table.BranchImages,
    });
  }

  // Get a branch image of given type ('picture', 'cover') by it's id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no image entry found.
  findById(id, type) {
    if (!Constants.AllowedValues.BranchImageTypes.includes(type)) {
      return Promise.reject();
    }

    return new Promise((resolve, reject) => {
      aws.dbClient.get({
        Key: {
          id: `${id}-${type}`,
        },
        TableName: this.config.table,
      }, (err, data) => {
        if (err) {
          return reject(err);
        }

        if (!data || !data.Item) {
          return reject();
        }

        this.data = data.Item;
        return resolve(data.Item);
      });
    });
  }
}

module.exports = BranchImage;
