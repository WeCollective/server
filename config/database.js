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
  },
  SubBranchRequest: {
    parentid: null,
    childid: null,
    date: null,
    creator: null
  },
  Tag: {
    branchid: null,
    tag: null
  },
  Post: {
    id: null,
    branchid: null,
    type: null,
    local: null,
    individual: null,
    up: null,
    down: null
  },
  PostData: {
    id: null,
    creator: null,
    date: null,
    title: null,
    text: null
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
      global: 'parentid-date-index'
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
  },
  SubBranchRequests: {
    primary: 'parentid',
    secondary: {
      global: 'parentid-date-index'
    }
  },
  Tags: {
    primary: 'branchid',
    secondary: {
      global: 'tag-branchid-index'
    }
  },
  Posts: {
    primary: 'id',
    secondary: {
      global: 'branchid-individual-index'
    }
  },
  PostData: {
    primary: 'id'
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
    ModLog: 'ModLog',
    SubBranchRequests: 'SubBranchRequests',
    Tags: 'Tags',
    Posts: 'Posts',
    PostData: 'PostData'
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
