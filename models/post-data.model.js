const aws = require('../config/aws');
const db = require('../config/database');
const Model = require('./model');
const validate = require('./validate');

class PostData extends Model {
  constructor(props) {
    super(props);

    this.config = {
      keys: db.Keys.PostData,
      schema: db.Schema.PostData,
      table: db.Table.PostData,
    };

    this.data = this.sanitize(props);
  }

  // Get a post' data by its id from the db, and
  // instantiate the object with this data.
  // Rejects promise with true if database error, with false if no post found.
  findById(id) {
    const self = this;

    return new Promise( (resolve, reject) => {
      aws.dbClient.get({
        Key: { id },
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

  // Validate the properties specified in 'properties' on the PostData object,
  // returning an array of any invalid ones
  validate(props, postType) {
    if (!Array.isArray(props) || !props.length) {
      props = [
        'id',
        'creator',
        'title',
        'text',
        'original_branches',
      ];
    }

    let invalids = [];

    if (props.includes('id')) {
      if (!validate.postid(this.data.id)) {
        invalids = [
          ...invalids,
          'id',
        ];
      }
    }

    if (props.includes('creator')) {
      if (!validate.username(this.data.creator)) {
        invalids = [
          ...invalids,
          'creator',
        ];
      }
    }

    if (props.includes('title')) {
      if (!this.data.title || this.data.title.length < 1 || this.data.title.length > 300) {
        invalids = [
          ...invalids,
          'title',
        ];
      }
    }

    const text = this.data.text;
    if (props.includes('text')) {
      if ((!['poll', 'text'].includes(postType) &&
        (!text || text.length < 1)) || (text && text.length > 20000)) {
        invalids = [
          ...invalids,
          'text',
        ];
      }
    }

    // Must be valid JSON array.
    if (props.includes('original_branches')) {
      if (!this.data.original_branches || !this.data.original_branches.length) {
        invalids = [
          ...invalids,
          'original_branches',
        ];
      }
      else {
        try {
          JSON.parse(this.data.original_branches);
        }
        catch (err) {
          invalids = [
            ...invalids,
            'original_branches',
          ];
        }
      }
    }

    return invalids;
  }
}

module.exports = PostData;
