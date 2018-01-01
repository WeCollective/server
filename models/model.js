const _ = require('lodash');
const reqlib = require('app-root-path').require;

const aws = reqlib('config/aws');

class Model {
  constructor(props, config) {
    if (new.target === Model) {
      throw new Error('Can\'t instantiate abstract class!');
    }

    // Includes table name, schema, and database keys.
    this.config = Object.assign({}, config || {});
    this.data = this.sanitize(props);
    // Changed data properties.
    this.dirtys = [];
  }

  // Delete the database entry specified by the model data.
  // The key should be the Primary key values identifying the object to be deleted.
  delete(Key) {
    const {
      primary,
      sort,
    } = this.config.keys;

    return new Promise((resolve, reject) => {
      // Construct key to identify the entry to be deleted if it isn't provided.
      if (!Key) {
        Key = {
          [primary]: this.data[primary],
        };

        if (sort) {
          Key[sort] = this.data[sort];
        }
      }

      aws.dbClient.delete({
        Key,
        TableName: this.config.table,
      }, err => {
        if (err) {
          return reject(err);
        }

        this.data = this.sanitize({});
        return resolve();
      });
    });
  }

  get(name) {
    return this.data[name];
  }

  // Ensure data adheres to the schema.
  sanitize(data, schema) {
    data = data || {};
    const defaultSchema = this.config.schema;
    return _.pick(_.defaults(data, schema || defaultSchema), _.keys(schema || defaultSchema));
  }

  // Save a new database entry according to the model data.
  save() {
    const self = this;

    return new Promise((resolve, reject) => {
      aws.dbClient.put({
        Item: self.data,
        TableName: self.config.table,
      }, (err) => {
        if (err) {
          return reject(err);
        }

        self.dirtys.splice(0, self.dirtys.length); // clear dirtys array
        return resolve();
      });
    });
  }

  set(name, value) {
    this.data[name] = value;

    // Set dirty flag for this property.
    if (!this.dirtys.includes(name)) {
      this.dirtys = [
        ...this.dirtys,
        name,
      ];
    }
  }

  // Update the existing database entry according to the model data.
  // The key should be the Primary key values identifying the object to be updated.
  update(Key) {
    const {
      primary,
      sort,
    } = this.config.keys;

    return new Promise((resolve, reject) => {
      // Construct key to identify the entry to be updated if it isnt provided
      if (!Key) {
        Key = {
          [primary]: this.data[primary],
        };

        if (sort) {
          Key[sort] = this.data[sort];
        }
      }

      // Update the entry with values which have changed in the model
      const AttributeUpdates = {};

      for (let i = 0; i < this.dirtys.length; i += 1) {
        const name = this.dirtys[i];
        const value = this.data[name];

        AttributeUpdates[name] = {
          Action: 'PUT',
          Value: value === '' ? null : value,
        };
      }

      // Perform the update.
      aws.dbClient.update({
        AttributeUpdates,
        Key,
        TableName: this.config.table,
      }, err => {
        if (err) {
          console.log(err);
          return reject(err);
        }

        // Clear dirtys array.
        this.dirtys.splice(0, this.dirtys.length);
        return resolve();
      });
    });
  }
}

module.exports = Model;
