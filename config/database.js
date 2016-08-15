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
    date: null,
    type: null,
    local: null,
    individual: null,
    up: null,
    down: null,
    rank: null
  },
  PostData: {
    id: null,
    creator: null,
    title: null,
    text: null
  },
  PostImages: {
    id: null,
    date: null,
    extension: null
  },
  Comment: {
    id: null,
    postid: null,
    parentid: null,
    individual: null,
    up: null,
    down: null,
    date: null,
    rank: null
  },
  CommentData: {
    id: null,
    text: null,
    creator: null,
    date: null
  }
};

// Database table keys
var Keys = {
  Users: {
    primary: 'username',
    sort: null
  },
  UserImages: {
    primary: 'id',
    sort: null
  },
  Branches: {
    primary: 'id',
    sort: null,
    globalIndexes: ['parentid-date-index']
  },
  BranchImages: {
    primary: 'id',
    sort: null
  },
  Mods: {
    primary: 'branchid',
    sort: 'date'
  },
  ModLog: {
    primary: 'branchid',
    sort: 'date'
  },
  SubBranchRequests: {
    primary: 'parentid',
    sort: 'childid',
    globalIndexes: ['parentid-date-index']
  },
  Tags: {
    primary: 'branchid',
    sort: 'tag',
    globalIndexes: ['tag-branchid-index']
  },
  Posts: {
    primary: 'id',
    sort: 'branchid',
    globalIndexes: ['branchid-individual-index', 'branchid-local-index']
  },
  PostData: {
    primary: 'id',
    sort: null
  },
  PostImages: {
    primary: 'id',
    sort: null
  },
  Comments: {
    primary: 'id',
    sort: null,
    globalIndexes: ['postid-parentid-index']
  },
  CommentData: {
    primary: 'id',
    sort: null
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
    PostData: 'PostData',
    PostImages: 'PostImages',
    Comments: 'Comments',
    CommentData: 'CommentData'
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
