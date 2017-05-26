'use strict';

const ModelSchemas = {
  Branch: {
    creator: null,
    date: null,
    description: null,
    id: null,
    name: null,
    parentid: null,
    post_comments: null,
    post_count: null,
    post_points: null,
    rules: null,
  },
  
  BranchImages: {
    date: null,
    extension: null,
    id: null
  },

  Comment: {
    date: null,
    down: null,
    id: null,
    individual: null,
    parentid: null,
    postid: null,
    rank: null,
    replies: null,
    up: null
  },
  
  CommentData: {
    creator: null,
    date: null,
    edited: null,
    id: null,
    text: null
  },

  Constant: {
    data: null,
    id: null
  },
  
  FlaggedPost: {
    branch_rules_count: null,
    branchid: null,
    date: null,
    id: null,
    nsfw_count: null,
    site_rules_count: null,
    type: null,
    wrong_type_count: null
  },

  FollowedBranch: {
    branchid: null,
    username: null
  },

  Mod: {
    branchid: null,
    date: null,
    username: null
  },
  
  ModLogEntry: {
    action: null,
    branchid: null,
    data: null,
    date: null,
    username: null
  },

  Notification: {
    data: null,
    date: null,
    id: null,
    type: null,
    unread: null,
    user: null
  },

  PollAnswer: {
    creator: null,
    date: null,
    id: null,
    postid: null,
    text: null,
    votes: null
  },
  
  Post: {
    branchid: null,
    comment_count: null,
    date: null,
    down: null,
    global: null,
    id: null,
    individual: null,
    local: null,
    locked: null,
    nsfw: null,
    type: null,
    up: null
  },
  
  PostData: {
    creator: null,
    id: null,
    original_branches: null,
    text: null,
    title: null
  },
  
  PostImages: {
    date: null,
    extension: null,
    id: null
  },

  Session: {
    expires: null,
    id: null,
    sess: null,
    socketID: null,
    type: null
  },
  
  SubBranchRequest: {
    childid: null,
    creator: null,
    date: null,
    parentid: null
  },
  
  Tag: {
    branchid: null,
    tag: null
  },
  
  User: {
    datejoined: null,
    dob: null,
    email: null,
    firstname: null,
    lastname: null,
    num_branches: null,
    num_comments: null,
    num_mod_positions: null,
    num_posts: null,
    password: null,
    resetPasswordToken: null,
    show_nsfw: null,
    token: null,
    username: null,
    verified: null,
  },
  
  UserImages: {
    extension: null,
    date: null,
    id: null
  },
  
  UserVote: {
    direction: null,
    itemid: null,
    username: null
  }
};

const TableKeys = {
  Branches: {
    globalIndexes: [
      'parentid-date-index',
      'parentid-post_comments-index',
      'parentid-post_count-index',
      'parentid-post_points-index'
    ],
    primary: 'id',
    sort: null
  },
  
  BranchImages: {
    primary: 'id',
    sort: null
  },

  Comments: {
    globalIndexes: [
      'postid-date-index',
      'postid-individual-index',
      'postid-replies-index'
    ],
    primary: 'id',
    sort: null
  },
  
  CommentData: {
    primary: 'id',
    sort: null
  },
  
  Constants: {
    primary: 'id',
    sort: null
  },

  FlaggedPosts: {
    globalIndexes: [
      'branchid-branch_rules_count-index',
      'branchid-date-index',
      'branchid-nsfw_count-index',
      'branchid-site_rules_count-index',
      'branchid-wrong_type_count-index'
    ],
    primary: 'id',
    sort: 'branchid'
  },
  
  FollowedBranches: {
    primary: 'username',
    sort: 'branchid'
  },
  
  Mods: {
    primary: 'branchid',
    sort: 'date'
  },
  
  ModLog: {
    primary: 'branchid',
    sort: 'date'
  },

  Notifications: {
    globalIndexes: ['user-date-index'],
    primary: 'id',
    sort: null
  },

  PollAnswers: {
    globalIndexes: [
      'creator-date-index',
      'postid-date-index',
      'postid-votes-index'
    ],
    primary: 'id',
    sort: null
  },

  Posts: {
    globalIndexes: [
      'branchid-comment_count-index',
      'branchid-date-index',
      'branchid-global-index',
      'branchid-individual-index',
      'branchid-local-index'
    ],
    primary: 'id',
    sort: 'branchid'
  },
  
  PostData: {
    primary: 'id',
    sort: null
  },
  
  PostImages: {
    primary: 'id',
    sort: null
  },

  Sessions: {
    primary: 'id',
    sort: null
  },
  
  SubBranchRequests: {
    globalIndexes: ['parentid-date-index'],
    primary: 'parentid',
    sort: 'childid'
  },
  
  Tags: {
    globalIndexes: ['tag-branchid-index'],
    primary: 'branchid',
    sort: 'tag'
  },

  Users: {
    globalIndexes: ['email-index'],
    primary: 'username',
    sort: null
  },

  UserImages: {
    primary: 'id',
    sort: null
  },

  UserVotes: {
    primary: 'username',
    sort: 'itemid'
  }
};

const DynamoDBConfig = {
  Keys: TableKeys,
  Schema: ModelSchemas,
  Table: {
    Branches: 'Branches',
    BranchImages: 'BranchImages',
    Comments: 'Comments',
    CommentData: 'CommentData',
    Constants: 'Constants',
    FlaggedPosts: 'FlaggedPosts',
    FollowedBranches: 'FollowedBranches',
    ModLog: 'ModLog',
    Mods: 'Mods',
    Notifications: 'Notifications',
    PollAnswers: 'PollAnswers',
    Posts: 'Posts',
    PostData: 'PostData',
    PostImages: 'PostImages',
    Sessions: 'Sessions',
    SubBranchRequests: 'SubBranchRequests',
    Tags: 'Tags',
    Users: 'Users',
    UserImages: 'UserImages',
    UserVotes: 'UserVotes'
  }
};

// If in a development environment we should use the development tables.
// Iterate over DynamoDBConfig object and append the prefix 'dev' to all table names.
if ('production' !== process.env.NODE_ENV) {
  for (const name in DynamoDBConfig.Table) {
    if (DynamoDBConfig.Table.hasOwnProperty(name)) {
      DynamoDBConfig.Table[name] = `dev${DynamoDBConfig.Table[name]}`;
    }
  }
}

module.exports = DynamoDBConfig;