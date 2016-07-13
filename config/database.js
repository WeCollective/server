'use strict';

// Database model schemas
var Schema = {
  User: {
    username: null,
    password: null,
    email: null,
    firstname: null,
    lastname: null,
    dob: null,
    datejoined: null
  },
  UserImages: {
    id: null,
    date: null,
    extension: null
  },
  Branch: {
    id: null,
    name: null,
    creator: null,
    date: null,
    parentid: null,
    description: null,
    rules: null
  },
  BranchImages: {
    id: null,
    date: null,
    extension: null
  },
  Mod: {
    branchid: null,
    date: null,
    username: null
  },
  ModLogEntry: {
    branchid: null,
    username: null,
    date: null,
    action: null,
    data: null
  }
};

// Database table keys
var Keys = {
  Users: {
    primary: 'username'
  },
  UserImages: {
    primary: 'id'
  },
  Branches: {
    primary: 'id',
    secondary: {
      global: 'parentid-index'
    }
  },
  BranchImages: {
    primary: 'id'
  },
  Mods: {
    primary: 'branchid'
  },
  ModLog: {
    primary: 'branchid'
  }
};

// DynamoDB config info.
var config = {
  // Table names
  Table: {
    Sessions: 'Sessions',
    Users: 'Users',
    UserImages: 'UserImages',
    Branches: 'Branches',
    BranchImages: 'BranchImages',
    Mods: 'Mods',
    ModLog: 'ModLog'
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
