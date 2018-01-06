const reqlib = require('app-root-path').require;

const AWS = reqlib('config/Dynamite/aws');

class Model {
  constructor(config) {
    this.config = Object.assign({}, config || {});
  }

  create(data) {
    const { schema } = this.config;
    const defaultValues = {};

    Object.keys(schema).forEach(key => defaultValues[key] = schema[key].defaultValue);

    if (!this.isObject(data)) {
      data = {};
    }

    Object.keys(data).forEach(key => defaultValues[key] = data[key]);

    return new Promise((resolve, reject) => {
      const invalidArr = this.validate(defaultValues);

      if (invalidArr.length) {
        return reject({
          message: invalidArr[0],
          status: 400,
        });
      }

      return this.save(defaultValues)
        .then(instance => resolve(instance))
        .catch(err => reject(err));
    });
  }

  createInstance(data) {
    const sanitize = this.sanitizeDataValues.bind(this);
    const validate = this.validate.bind(this);

    const instance = {
      _changed: {},
      config: this.config,
      dataValues: sanitize(data),
    };

    Object.defineProperty(instance, 'destroy', {
      enumerable: false,
      value() {
        const {
          primary,
          sort,
        } = this.config.keys;

        // Key is used to select the instance to perform an action on.
        const Key = {
          [primary]: this.get(primary),
        };
        if (sort) Key[sort] = this.get(sort);

        return new Promise((resolve, reject) => AWS.dbClient.delete({
          Key,
          TableName: this.config.table,
        }, err => {
          if (err) {
            console.log('DynamoDB error occurred.');
            console.log(err);
            return reject(err);
          }

          instance.dataValues = sanitize();
          return resolve();
        }));
      },
    });

    Object.defineProperty(instance, 'get', {
      enumerable: false,
      value(prop) {
        return this.dataValues[prop];
      },
    });

    Object.defineProperty(instance, 'set', {
      enumerable: false,
      value(prop, value) {
        if (!this._changed[prop]) {
          this._changed[prop] = [];
        }

        this._changed[prop] = [
          ...this._changed[prop],
          {
            oldValue: this.get(prop),
            newValue: value,
          },
        ];

        this.dataValues[prop] = value;
        return this.dataValues[prop];
      },
    });

    Object.defineProperty(instance, 'update', {
      enumerable: false,
      value() {
        const {
          primary,
          sort,
        } = this.config.keys;

        // Key is used to select the instance to perform an action on.
        const Key = {
          [primary]: this.get(primary),
        };
        if (sort) Key[sort] = this.get(sort);

        return new Promise((resolve, reject) => {
          const invalidArr = validate(this.dataValues);

          if (invalidArr.length) {
            return reject({
              message: invalidArr[0],
              status: 400,
            });
          }

          // Update the entry with values which have changed in the model
          const AttributeUpdates = {};
          const _changed = Object.keys(this._changed);

          for (let i = 0; i < _changed.length; i += 1) {
            const key = _changed[i];
            const value = this.get(key);

            AttributeUpdates[key] = {
              Action: 'PUT',
              Value: value === '' ? null : value,
            };
          }

          // Perform the update.
          AWS.dbClient.update({
            AttributeUpdates,
            Key,
            TableName: this.config.table,
          }, err => {
            if (err) {
              console.log('DynamoDB error occurred.');
              console.log(err);
              return reject(err);
            }

            this._changed = {};
            return resolve();
          });
        });
      },
    });
    return instance;
  }

  destroy(Key) {
    if (!this.isObject(Key)) {
      return Promise.reject('Invalid model schema passed to destroy() method.');
    }

    return new Promise((resolve, reject) => AWS.dbClient.delete({
      Key,
      TableName: this.config.table,
    }, err => {
      if (err) {
        console.log('DynamoDB error occurred.');
        console.log(err);
        return reject(err);
      }

      return resolve();
    }));
  }

  findById(id) {
    return this.findOne({
      where: {
        id,
      },
    });
  }

  // todo validation for findAll()
  findAll(config) {
    const cfg = this.validateOperationConfig(config);
    let Keys = [];

    Object.keys(cfg.where).map(key => {
      const value = cfg.where[key];
      let arr = [];

      if (Array.isArray(value)) {
        arr = value.map(v => ({
          [key]: v,
        }));
      }
      else {
        arr = [{
          [key]: value,
        }];
      }

      Keys = [
        ...Keys,
        ...arr,
      ];
    });

    return new Promise((resolve, reject) => AWS.dbClient.batchGet({
      RequestItems: {
        [cfg.table]: {
          Keys,
        },
      },
    }, (err, data) => {
      if (err || !data) {
        console.log('DynamoDB error occurred.');
        console.log(err);
        console.log('Passed configuration object.');
        console.log(cfg);
        return reject(err);
      }

      let instances = [];
      let results = data.Responses[cfg.table];

      // The rows were not found.
      if (!Array.isArray(results)) {
        results = [];
      }

      results.forEach(data => {
        const instance = this.createInstance(data);
        instances = [
          ...instances,
          instance,
        ];
      });

      return resolve(instances);
    }));
  }

  findOne(config) {
    const cfg = this.validateOperationConfig(config);

    return new Promise((resolve, reject) => AWS.dbClient.get({
      Key: cfg.where,
      TableName: cfg.table,
    }, (err, data) => {
      if (err || !data) {
        console.log('DynamoDB error occurred.');
        console.log(err);
        console.log('Passed configuration object.');
        console.log(cfg);
        return reject(err);
      }

      // The row was not found.
      if (!Object.keys(data).length || !data.Item) {
        return resolve(null);
      }

      const instance = this.createInstance(data.Item);
      return resolve(instance);
    }));
  }

  isInstance(data) {
    return !this.isObject(data);
  }

  isObject(obj) {
    return obj && typeof obj === 'object' && !Array.isArray(obj);
  }

  responseHandler(type, err, data, queryParams, limit) {
    if (err || !data) {
      console.log('DynamoDB error occurred.');
      console.log(err);
      console.log('Passed configuration object.');
      console.log(queryParams);
      return Promise.reject(err);
    }

    let arr = data.Items;
    let instances = []; // not in 'first'

    if (!arr || !Array.isArray(arr)) {
      arr = [];
    }

    const slice = limit ? arr.slice(0, limit) : arr;

    slice.forEach(data => {
      const instance = this.createInstance(data);
      instances = [
        ...instances,
        instance,
      ];
    });

    if (type === 'first') {
      const row = instances[0];
      return Promise.resolve(row || null);
    }

    return Promise.resolve(instances);
  }

  // Ensure data adheres to the schema.
  sanitizeDataValues(data = {}, schema = this.config.schema) {
    const schemaEmpty = {};
    Object.keys(schema).forEach(key => schemaEmpty[key] = schema[key].defaultValue || schema[key].value);
    const schemaWithData = Object.assign({}, schemaEmpty, data);
    const result = {};
    Object.keys(schema).forEach(key => result[key] = schemaWithData[key]);
    return result;
  }

  save(data) {
    const isInstance = this.isInstance(data);

    if (isInstance) {
      throw new Error('Instance does not support saving for now...');
    }

    return new Promise((resolve, reject) => AWS.dbClient.put({
      Item: data,
      TableName: this.config.table,
    }, err => {
      if (err) {
        console.log('DynamoDB error occurred.');
        console.log(err);
        return reject(err);
      }

      const instance = this.createInstance(data);
      return resolve(instance);
    }));
  }

  update(config, data) {
    if (!this.isObject(config)) {
      config = {};
    }

    const cfg = this.validateOperationConfig(config);

    if (!this.isObject(data)) {
      data = {};
    }

    return new Promise((resolve, reject) => {
      // Skip everything but the updated attributes.
      let skipAttributes = [];
      Object.keys(this.config.schema).forEach(key => {
        if (data[key] === undefined) {
          skipAttributes = [
            ...skipAttributes,
            key,
          ];
        }
      });
      const invalidArr = this.validate(data, skipAttributes);

      if (invalidArr.length) {
        return reject({
          message: invalidArr[0],
          status: 400,
        });
      }

      // Update the entry with values which have changed in the model
      const AttributeUpdates = {};
      const _changed = Object.keys(data);

      for (let i = 0; i < _changed.length; i += 1) {
        const key = _changed[i];
        const value = data[key];

        AttributeUpdates[key] = {
          Action: 'PUT',
          Value: value === '' ? null : value,
        };
      }

      // Perform the update.
      AWS.dbClient.update({
        AttributeUpdates,
        Key: cfg.where,
        TableName: cfg.table,
      }, err => {
        if (err) {
          console.log(err);
          return reject(err);
        }

        // todo
        // this.createInstance(data)
        return resolve();
      });
    });
  }

  /**
   * Legend references for params in validation.
   *
   * $$key = The schema key, used to grab the current value.
   *
   * Example:
   * params: ['$$id']
   * We will use the id value as a parameter.
   *
   * %int = Validation function parameter, indexed from 0.
   *
   * Example:
   * params: ['%0']
   * validate(props, param1, param2)
   * We will grab param1.
   *
   */
  validate(data, skipAttributes = []) {
    const { schema } = this.config;
    let invalidArr = [];

    // Check all attributes.
    Object.keys(schema).forEach(key => {
      if (skipAttributes.includes(key)) return;

      const validation = schema[key].validate;
      const value = data[key];
      let params = [];
      let test;

      // Find the test method.
      if (typeof validation === 'function') {
        test = validation;
      }
      else if (this.isObject(validation) && typeof validation.test === 'function') {
        test = validation.test;

        if (Array.isArray(validation.params)) {
          // Transpile any parameter references.
          params = validation.params.map(param => {
            if (typeof param === 'string') {
              // Other key values.
              if (param.substring(0, 2) === '$$') {
                const key = param.substring(2);
                param = data[key];
              }
            }

            return param;
          });
        }
      }

      if (test && !test(value, ...params)) {
        if ((value === null || value === undefined) && schema[key].allowNull) return;
        const canDisplayValue = key !== 'password';
        invalidArr = [
          ...invalidArr,
          `Invalid ${key}${canDisplayValue ? ` - ${value}` : ''}.`,
        ];
      }
    });

    return invalidArr;
  }

  validateOperationConfig(config) {
    const { table } = this.config;
    const errorMessage = 'Invalid configuration passed to the DynamoDB operation.';

    // Config must be an object.
    if (!this.isObject(config)) {
      throw new Error(errorMessage);
    }

    config.where = config.where || {};

    if (!Object.keys(config.where).length) {
      throw new Error(errorMessage);
    }

    // All is good in the hood.
    return Object.assign({
      table,
    }, config);
  }
}

module.exports = Model;
