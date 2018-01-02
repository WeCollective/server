const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const validate = reqlib('models/validate');

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
const Schema = {
  Branch: {
    creator: {
      validate: validate.username,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    description: {
      validate: {
        params: [1, Constants.EntityLimits.branchDescription],
        test: validate.range,
      },
      value: null,
    },
    id: {
      validate: validate.branchid,
      value: null,
    },
    name: {
      validate: {
        params: [1, Constants.EntityLimits.branchName],
        test: validate.range,
      },
      value: null,
    },
    parentid: {
      validate: validate.branchid,
      value: null,
    },
    post_comments: {
      validate: validate.number,
      value: null,
    },
    post_count: {
      validate: validate.number,
      value: null,
    },
    post_points: {
      validate: validate.number,
      value: null,
    },
    rules: {
      validate: {
        params: [null, Constants.EntityLimits.branchRules],
        test: validate.range,
      },
      value: null,
    },
  },
  
  BranchImages: {
    date: {
      validate: validate.date,
      value: null,
    },
    extension: {
      validate: validate.extension,
      value: null,
    },
    id: {
      validate: validate.branchImageId,
      value: null,
    },
  },

  Comment: {
    date: {
      validate: validate.date,
      value: null,
    },
    down: {
      validate: validate.number,
      value: null,
    },
    id: {
      validate: validate.commentid,
      value: null,
    },
    individual: {
      validate: validate.number,
      value: null,
    },
    parentid: {
      validate: validate.commentid,
      value: null,
    },
    postid: {
      validate: validate.postid,
      value: null,
    },
    rank: {
      validate: validate.number,
      value: null,
    },
    replies: {
      validate: validate.number,
      value: null,
    },
    up: {
      validate: validate.number,
      value: null,
    },
  },
  
  CommentData: {
    creator: {
      validate: validate.username,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    edited: {
      validate: validate.boolean,
      value: null,
    },
    id: {
      validate: validate.commentid,
      value: null,
    },
    text: {
      validate: {
        params: [1, Constants.EntityLimits.commentText],
        test: validate.range,
      },
      value: null,
    },
  },

  Constant: {
    data: {
      validate: {
        params: ['$$id'],
        test: validate.wecoConstantValue,
      },
      value: null,
    },
    id: {
      validate: validate.wecoConstantId,
      value: null,
    },
  },
  
  FlaggedPost: {
    branch_rules_count: {
      validate: validate.number,
      value: null,
    },
    branchid: {
      validate: validate.branchid,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    id: {
      validate: validate.postid,
      value: null,
    },
    nsfw_count: {
      validate: validate.number,
      value: null,
    },
    site_rules_count: {
      validate: validate.number,
      value: null,
    },
    type: {
      validate: validate.postType,
      value: null,
    },
    wrong_type_count: {
      validate: validate.number,
      value: null,
    },
  },

  FollowedBranch: {
    branchid: {
      validate: validate.branchid,
      value: null,
    },
    username: {
      validate: validate.username,
      value: null,
    },
  },

  Logger: {
    createdAt: {
      validate: null,
      value: null,
    },
    event: {
      validate: null,
      value: null,
    },
    extra: {
      validate: null,
      value: null,
    },
  },

  Mod: {
    branchid: {
      validate: validate.branchid,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    username: {
      validate: validate.username,
      value: null,
    },
  },
  
  ModLogEntry: {
    action: {
      validate: validate.modLogAction,
      value: null,
    },
    branchid: {
      validate: validate.branchid,
      value: null,
    },
    data: {
      validate: validate.exists,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    username: {
      validate: validate.username,
      value: null,
    },
  },

  Notification: {
    // TODO check data is a valid JSON for the given type
    data: {
      validate: null,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    id: {
      validate: validate.notificationid,
      value: null,
    },
    type: {
      validate: validate.notificationType,
      value: null,
    },
    unread: {
      validate: validate.boolean,
      value: null,
    },
    user: {
      validate: validate.username,
      value: null,
    },
  },

  PollAnswer: {
    creator: {
      validate: validate.username,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    id: {
      validate: validate.pollanswerid,
      value: null,
    },
    postid: {
      validate: validate.postid,
      value: null,
    },
    text: {
      validate: {
        params: [1, Constants.EntityLimits.pollAnswerText],
        test: validate.range,
      },
      value: null,
    },
    votes: {
      validate: validate.number,
      value: null,
    },
  },
  
  Post: {
    branchid: {
      validate: validate.branchid,
      value: null,
    },
    comment_count: {
      validate: validate.number,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    down: {
      validate: validate.number,
      value: null,
    },
    global: {
      validate: validate.number,
      value: null,
    },
    id: {
      validate: validate.postid,
      value: null,
    },
    individual: {
      validate: validate.number,
      value: null,
    },
    local: {
      validate: validate.number,
      value: null,
    },
    locked: {
      validate: validate.boolean,
      value: null,
    },
    nsfw: {
      validate: validate.boolean,
      value: null,
    },
    type: {
      validate: validate.postType,
      value: null,
    },
    up: {
      validate: validate.number,
      value: null,
    },
  },
  
  PostData: {
    creator: {
      validate: validate.username,
      value: null,
    },
    id: {
      validate: validate.postid,
      value: null,
    },
    original_branches: {
      validate: validate.originalBranches,
      value: null,
    },
    text: {
      validate: {
        params: ['%0'],
        test: validate.postText,
      },
      value: null,
    },
    title: {
      validate: {
        params: [1, Constants.EntityLimits.postTitle],
        test: validate.range,
      },
      value: null,
    },
  },
  
  PostImages: {
    date: {
      validate: validate.date,
      value: null,
    },
    extension: {
      validate: validate.extension,
      value: null,
    },
    id: {
      validate: validate.postImageId,
      value: null,
    },
  },
  
  SubBranchRequest: {
    childid: {
      validate: validate.branchid,
      value: null,
    },
    creator: {
      validate: validate.username,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    parentid: {
      validate: validate.branchid,
      value: null,
    },
  },
  
  Tag: {
    branchid: {
      validate: validate.branchid,
      value: null,
    },
    tag: {
      validate: validate.branchid,
      value: null,
    },
  },
  
  User: {
    banned: {
      validate: validate.boolean,
      value: null,
    },
    datejoined: {
      validate: validate.date,
      value: null,
    },
    dob: {
      validate: validate.age,
      value: null,
    },
    email: {
      validate: validate.email,
      value: null,
    },
    name: {
      validate: {
        params: [
          Constants.EntityLimits.userFullNameMin,
          Constants.EntityLimits.userFullNameMax,
        ],
        test: validate.range,
      },
      value: null,
    },
    num_branches: {
      validate: validate.number,
      value: null,
    },
    num_comments: {
      validate: validate.number,
      value: null,
    },
    num_mod_positions: {
      validate: validate.number,
      value: null,
    },
    num_posts: {
      validate: validate.number,
      value: null,
    },
    password: {
      validate: validate.password,
      value: null,
    },
    resetPasswordToken: {
      validate: null,
      value: null,
    },
    show_nsfw: {
      validate: validate.boolean,
      value: null,
    },
    token: {
      validate: null,
      value: null,
    },
    username: {
      validate: validate.username,
      value: null,
    },
    verified: {
      validate: validate.boolean,
      value: null,
    },
  },
  
  UserImages: {
    extension: {
      validate: validate.extension,
      value: null,
    },
    date: {
      validate: validate.date,
      value: null,
    },
    id: {
      validate: validate.userImageId,
      value: null,
    },
  },
  
  UserVote: {
    direction: {
      validate: validate.voteDirection,
      value: null,
    },
    itemid: {
      validate: null,
      value: null,
    },
    username: {
      validate: validate.username,
      value: null,
    },
  },
};

const Keys = {
  Branches: {
    globalIndexes: [
      'parentid-date-index',
      'parentid-post_count-index',
      'parentid-post_points-index',
      'parentid-post_comments-index',
    ],
    primary: 'id',
    sort: null,
  },
  
  BranchImages: {
    primary: 'id',
    sort: null,
  },

  Comments: {
    globalIndexes: [
      'postid-individual-index',
      'postid-date-index',
      'postid-replies-index',
    ],
    primary: 'id',
    sort: null,
  },
  
  CommentData: {
    primary: 'id',
    sort: null,
  },
  
  Constants: {
    primary: 'id',
    sort: null,
  },

  FlaggedPosts: {
    globalIndexes: [
      'branchid-date-index',
      'branchid-branch_rules_count-index',
      'branchid-site_rules_count-index',
      'branchid-wrong_type_count-index',
      'branchid-nsfw_count-index',
    ],
    primary: 'id',
    sort: 'branchid',
  },
  
  FollowedBranches: {
    primary: 'username',
    sort: 'branchid',
  },

  Loggers: {
    primary: 'event',
    sort: 'createdAt',
  },
  
  Mods: {
    primary: 'branchid',
    sort: 'date',
  },
  
  ModLog: {
    primary: 'branchid',
    sort: 'date',
  },

  Notifications: {
    globalIndexes: ['user-date-index'],
    primary: 'id',
    sort: null,
  },

  PollAnswers: {
    globalIndexes: [
      'creator-date-index',
      'postid-date-index',
      'postid-votes-index',
    ],
    primary: 'id',
    sort: null,
  },

  Posts: {
    globalIndexes: [
      'branchid-individual-index',
      'branchid-local-index',
      'branchid-date-index',
      'branchid-comment_count-index',
      'branchid-global-index',
    ],
    primary: 'id',
    sort: 'branchid',
  },
  
  PostData: {
    primary: 'id',
    sort: null,
  },
  
  PostImages: {
    primary: 'id',
    sort: null,
  },
  
  SubBranchRequests: {
    globalIndexes: ['parentid-date-index'],
    primary: 'parentid',
    sort: 'childid',
  },
  
  Tags: {
    globalIndexes: ['tag-branchid-index'],
    primary: 'branchid',
    sort: 'tag',
  },

  Users: {
    globalIndexes: ['email-index'],
    primary: 'username',
    sort: null,
  },

  UserImages: {
    primary: 'id',
    sort: null,
  },

  UserVotes: {
    primary: 'username',
    sort: 'itemid',
  },
};

const DynamoDBConfig = {
  Keys,
  Schema,
  Table: {
    Branches: 'Branches',
    BranchImages: 'BranchImages',
    Comments: 'Comments',
    CommentData: 'CommentData',
    Constants: 'Constants',
    FlaggedPosts: 'FlaggedPosts',
    FollowedBranches: 'FollowedBranches',
    Loggers: 'Loggers',
    ModLog: 'ModLog',
    Mods: 'Mods',
    Notifications: 'Notifications',
    PollAnswers: 'PollAnswers',
    Posts: 'Posts',
    PostData: 'PostData',
    PostImages: 'PostImages',
    SubBranchRequests: 'SubBranchRequests',
    Tags: 'Tags',
    Users: 'Users',
    UserImages: 'UserImages',
    UserVotes: 'UserVotes',
  }
};

// Use development tables in the development environment.
if (process.env.NODE_ENV !== 'production') {
  for (const name in DynamoDBConfig.Table) {
    if (DynamoDBConfig.Table.hasOwnProperty(name)) {
      DynamoDBConfig.Table[name] = `dev${DynamoDBConfig.Table[name]}`;
    }
  }
}

module.exports = DynamoDBConfig;
