const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class CommentData extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.CommentData,
      schema: db.Schema.CommentData,
      table: db.Table.CommentData,
    };

    this.data = this.sanitize(props);
  }

  // Get a comment's data by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no post found.
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

  // Validate the properties specified in 'properties' on the CommentData object,
  // returning an array of any invalid ones
  validate(props) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'creator',
        'date',
        'edited',
        'id',
        'text',
      ];
    }

    let invalids = [];

    if (props.includes('creator')) {
      if (!validate.username(this.data.creator)) {
        invalids = [
          ...invalids,
          'creator',
        ];
      }
    }

    if (props.includes('date')) {
      if (!validate.date(this.data.date)) {
        invalids = [
          ...invalids,
          'date',
        ];
      }
    }

    if (props.includes('edited')) {
      if (this.data.edited !== undefined && this.data.edited !== true && this.data.edited !== false) {
        invalids = [
          ...invalids,
          'edited',
        ];
      }
    }

    if (props.includes('id')) {
      if (!validate.commentid(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
        ];
      }
    }

    if (props.includes('text')) {
      if (!this.data.text || this.data.text.length < 1 || this.data.text.length > 20000) {
        invalids = [
          ...invalids,
          'text',
        ];
      }
    }

    return invalids;
  }
}

module.exports = CommentData;
