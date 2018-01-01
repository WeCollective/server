// check each controller validations and entity limits checking

// BASE CONSTANTS.
const DATE = 13; // We use 13-digit unix timestamps.
const HYPHEN = 1; // Classic "-" character.
const MAX_BRANCH_DESCRIPTION = 10000;
const MAX_BRANCH_ID = 30;
const MAX_BRANCH_NAME = 30;
const MAX_BRANCH_RULES = 10000;
const MAX_COMMENT_TEXT = 20000;
const MAX_POLL_ANSWER_TEXT = 300;
const MAX_POST_TEXT = 20000;
const MAX_POST_TITLE = 300;
const MAX_USER_FULL_NAME = 30;
const MAX_USER_PASSWORD = 30;
const MAX_USERNAME = 20;
const MIN_USER_AGE = 13;
const MIN_USER_FULL_NAME = 2;
const MIN_USER_PASSWORD = 6;
const USERNAME_DATE = MAX_USERNAME + HYPHEN + DATE;
const USERNAME_DATE_DATE = USERNAME_DATE + HYPHEN + DATE;

// These are used in urls and routes.
const BranchIds = [
  'none',
  'p',
];

const BranchImageTypes = [
  'cover',
  'picture',
];

// Defines maximum length for entities across Weco.
const EntityLimits = {
  branch: MAX_BRANCH_ID,
  branchDescription: MAX_BRANCH_DESCRIPTION,
  branchName: MAX_BRANCH_NAME,
  branchRules: MAX_BRANCH_RULES,
  comment: USERNAME_DATE,
  commentText: MAX_COMMENT_TEXT,
  notification: USERNAME_DATE,
  pollAnswer: USERNAME_DATE_DATE,
  pollAnswerText: MAX_POLL_ANSWER_TEXT,
  post: USERNAME_DATE,
  postText: MAX_POST_TEXT,
  postTitle: MAX_POST_TITLE,
  username: MAX_USERNAME,
  userAgeMin: MIN_USER_AGE,
  userFullNameMax: MAX_USER_FULL_NAME,
  userFullNameMin: MIN_USER_FULL_NAME,
  userPasswordMax: MAX_USER_PASSWORD,
  userPasswordMin: MIN_USER_PASSWORD,
};

const ImageExtensions = [
  'bmp',
  'jpe',
  'jpeg',
  'jpg',
  'png',
];

const ModLogActionTypes = [
  'addmod',
  'answer-subbranch-request',
  'make-subbranch-request',
  'removemod',
];

const PostTypes = [
  'audio',
  'image',
  'page',
  'poll',
  'text',
  'video',
];

// These are used in user image urls and routes.
const Usernames = [
  'cover',
  'me',
  'orig',
  'picture',
];

const WecoConstants = [
  'branch_count',
  'donation_total',
  'raised_total',
  'user_count',
];

module.exports = {
  AllowedValues: {
    BranchImageTypes,
    ImageExtensions,
    ModLogActionTypes,
    PostTypes,
    WecoConstants,
  },
  BannedValues: {
    BranchIds,
    Usernames,
  },
  EntityLimits,
};
