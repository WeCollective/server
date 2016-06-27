'use strict';

// Database model schemas
var Schema = {
  User: {
    username: null,
    password: null,
    email: null,
    firstname: null,
    lastname: null
  }
};

// Database table keys
var Keys = {
  Users: {
    primary: 'username'
  }
};

// DynamoDB config info.
var config = {
  // Table names
  Table: {
    Sessions: 'Sessions',
    Users: 'Users'
  },
  // Model schemas
  Schema: Schema,
  // Database keys
  Keys: Keys
}

// If in a development environment we should user the development tables.
// Iterate over config object and append the prefix 'dev' to all table names.
if(process.env.NODE_ENV != 'production') {
  for(var name in config.Table) {
    if(config.Table.hasOwnProperty(name)) {
      config.Table[name] = 'dev' + config.Table[name];
    }
  }
}

module.exports = config;
