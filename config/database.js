'use strict';

// DynamoDB config info.
// Table names should be accessed through this object.
var config = {
  Table: {
    Users: 'Users'
  }
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

module.exports = function(AWS) {
  config.client = new AWS.DynamoDB.DocumentClient();
  return config;
}
