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
    datejoined: null,
    verified: null,
    token: null,
    resetPasswordToken: null,
    num_posts: null,
    num_comments: null,
    num_branches: null,
    num_mod_positions: null,
    show_nsfw: null
  },
  UserImages: {
    id: null,
    date: null,
    extension: null
  },
  UserVote: {
    username: null,
    itemid: null,
    direction: null
  },
  Branch: {
    id: null,
    name: null,
    creator: null,
    date: null,
    parentid: null,
    description: null,
    rules: null,
    post_count: null,
    post_points: null,
    post_comments: null
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
    global: null,
    up: null,
    down: null,
    comment_count: null,
    nsfw: null
  },
  PostData: {
    id: null,
    creator: null,
    title: null,
    text: null,
    original_branches: null
  },
  PostImages: {
    id: null,
    date: null,
    extension: null
  },
  FlaggedPost: {
    id: null,
    branchid: null,
    type: null,
    date: null,
    branch_rules_count: null,
    site_rules_count: null,
    wrong_type_count: null,
    nsfw_count: null
  },
  PollAnswer: {
    id: null,
    postid: null,
    votes: null,
    text: null,
    creator: null,
    date: null
  },
  Comment: {
    id: null,
    postid: null,
    parentid: null,
    individual: null,
    replies: null,
    up: null,
    down: null,
    date: null,
    rank: null
  },
  CommentData: {
    id: null,
    text: null,
    creator: null,
    date: null,
    edited: null
  },
  Notification: {
    id: null,
    user: null,
    date: null,
    unread: null,
    type: null,
    data: null
  },
  Session: {
    id: null,
    expires: null,
    sess: null,
    type: null,
    socketID: null
  },
  Constant: {
    id: null,
    data: null
  },
  FollowedBranch: {
    username: null,
    branchid: null
  }
};

// Database table keys
var Keys = {
  Users: {
    primary: 'username',
    sort: null,
    globalIndexes: ['email-index']
  },
  UserImages: {
    primary: 'id',
    sort: null
  },
  UserVotes: {
    primary: 'username',
    sort: 'itemid'
  },
  Branches: {
    primary: 'id',
    sort: null,
    globalIndexes: ['parentid-date-index', 'parentid-post_count-index', 'parentid-post_points-index', 'parentid-post_comments-index']
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
    globalIndexes: ['branchid-individual-index', 'branchid-local-index', 'branchid-date-index', 'branchid-comment_count-index', 'branchid-global-index']
  },
  PostData: {
    primary: 'id',
    sort: null
  },
  PostImages: {
    primary: 'id',
    sort: null
  },
  FlaggedPosts: {
    primary: 'id',
    sort: 'branchid',
    globalIndexes: ['branchid-date-index', 'branchid-branch_rules_count-index', 'branchid-site_rules_count-index', 'branchid-wrong_type_count-index', 'branchid-nsfw_count-index']
  },
  PollAnswers: {
    primary: 'id',
    sort: null,
    globalIndexes: ['creator-date-index']
  },
  Comments: {
    primary: 'id',
    sort: null,
    globalIndexes: ['postid-individual-index', 'postid-date-index', 'postid-replies-index']
  },
  CommentData: {
    primary: 'id',
    sort: null
  },
  Notifications: {
    primary: 'id',
    sort: null,
    globalIndexes: ['user-date-index']
  },
  Sessions: {
    primary: 'id',
    sort: null
  },
  Constants: {
    primary: 'id',
    sort: null
  },
  FollowedBranches: {
    primary: 'username',
    sort: 'branchid'
  }
};

// DynamoDB config info.
var config = {
  // Table names
  Table: {
    Sessions: 'Sessions',
    Users: 'Users',
    UserImages: 'UserImages',
    UserVotes: 'UserVotes',
    Branches: 'Branches',
    BranchImages: 'BranchImages',
    Mods: 'Mods',
    ModLog: 'ModLog',
    SubBranchRequests: 'SubBranchRequests',
    Tags: 'Tags',
    Posts: 'Posts',
    PostData: 'PostData',
    PostImages: 'PostImages',
    FlaggedPosts: 'FlaggedPosts',
    PollAnswers: 'PollAnswers',
    Comments: 'Comments',
    CommentData: 'CommentData',
    Notifications: 'Notifications',
    Constants: 'Constants',
    FollowedBranches: 'FollowedBranches'
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
