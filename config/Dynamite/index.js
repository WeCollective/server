const pluralize = require('pluralize');
const reqlib = require('app-root-path').require;

const AWS = reqlib('config/Dynamite/aws');
const Limits = reqlib('config/Dynamite/limits');
const Model = reqlib('config/Dynamite/model');
const validator = reqlib('config/Dynamite/validator');

const Dynamite = {
  aws: AWS,

  define(name, schema, options) {
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      options = {};
    }

    const prefix = process.env.NODE_ENV !== 'production' ? 'dev' : '';
    const table = `${prefix}${pluralize(name, options.pluralize === false ? 1 : 2)}`;

    if (this.models[name]) {
      throw new Error('');
    }

    const keys = this.extractKeys(schema, options);
    const config = {
      keys,
      schema,
      table,
    };
    const model = new Model(config);

    Object.defineProperty(model, 'config', {
      enumerable: false,
      value: config,
    });
    Object.defineProperty(model, 'name', {
      enumerable: false,
      value: name,
    });

    this.models[name] = model;
    return model;
  },

  extractKeys(schema, options) {
    const keys = {
      primary: null,
      sort: null,
    };
    Object.keys(schema).forEach(columnName => {
      const col = schema[columnName];
      if (col.primary) keys.primary = columnName;
      if (col.sort) keys.sort = columnName;
    });
    if (options.TableIndexes) keys.TableIndexes = options.TableIndexes;
    return keys;
  },

  getPaginationLimit(model) {
    const { models } = this;
    switch (model) {
      case models.Branch:
        return Limits.branches;

      case models.Comment:
        return Limits.comments;

      case models.FlaggedPost:
      case models.Post:
        return Limits.posts;

      case models.Notification:
        return Limits.notifications;

      case models.PollAnswer:
        return Limits.pollAnswers;

      default:
        return 0;
    }
  },

  import(path) {
    const name = require(path)(this, validator).name;
    return this.models[name];
  },

  models: {},

  query(...params) {
    const last = params[params.length - 1];
    const handler = typeof last === 'string' ? last : null;
    const queryParams = params[0];
    let caller = null;

    if (params.length > 1) {
      const end = handler ? 2 : 1;
      caller = params[params.length - end];
      queryParams.TableName = caller.config.table;
    }

    return new Promise((resolve, reject) => this.aws.dbClient.query(queryParams, (err, data) => {
      if (caller && handler) {
        const limit = caller && handler === 'slice' ? this.getPaginationLimit(caller) : 0;
        return caller
          .responseHandler(handler, err, data, queryParams, limit)
          .then(res => resolve(res))
          .catch(err => reject(err));
      }

      if (err) {
        return reject(err);
      }

      return resolve(data);
    }));
  },



  scan(...params) {
    const last = params[params.length - 1];
    const handler = typeof last === 'string' ? last : null;
    const queryParams = params[0];
    let caller = null;

    if (params.length > 1) {
      const end = handler ? 2 : 1;
      caller = params[params.length - end];
      queryParams.TableName = caller.config.table;
    }

    return new Promise((resolve, reject) => this.aws.dbClient.scan(queryParams, (err, data) => {
      if (caller && handler) {
        const limit = caller && handler === 'slice' ? this.getPaginationLimit(caller) : 0;
        return caller
          .responseHandler(handler, err, data, queryParams, limit)
          .then(res => resolve(res))
          .catch(err => reject(err));
      }

      if (err) {
        return reject(err);
      }

      return resolve(data);
    }));
  },



  //not finished not working
  batchGetItems(...params) {
    const last = params[params.length - 1];
    const handler = typeof last === 'string' ? last : null;
    const queryParams = params[0];
    let caller = null;

    if (params.length > 1) {
      const end = handler ? 2 : 1;
      caller = params[params.length - end];
      queryParams.TableName = caller.config.table;
    }

    return new Promise((resolve, reject) => this.aws.dbClient.batchGet(queryParams, (err, data) => {
      if (caller && handler) {
        const limit = caller && handler === 'slice' ? this.getPaginationLimit(caller) : 0;
        return caller
          .responseHandler(handler, err, data, queryParams, limit)
          .then(res => resolve(res))
          .catch(err => reject(err));
      }

      if (err) {
        return reject(err);
      }

      return resolve(data);
    }));
  },



  validator,
};

module.exports = Dynamite;
