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

// POLICIES.
// Uses the RFC 822 spec.
const POLICY_EMAIL = /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/;
// Ids must include only lowercase characters, digits, underscore, or hyphen.
const POLICY_ID = /^[a-z0-9_-]+$/;
const POLICY_WHITESPACE = /\s/g;

// These are used in urls and routes.
const BranchIds = [
  'none',
  'p',
];

const BranchThumbnailType = 'picture';

const BranchImageTypes = [
  'cover',
  BranchThumbnailType,
];
const MAX_BRANCH_IMAGE_TYPE = BranchImageTypes.reduce((a, b) => a.length > b.length ? a : b).length;
const MAX_BRANCH_IMAGE_ID = MAX_BRANCH_ID + HYPHEN + MAX_BRANCH_IMAGE_TYPE;
const MAX_POST_IMAGE_ID = USERNAME_DATE + HYPHEN + MAX_BRANCH_IMAGE_TYPE;
const MAX_USER_IMAGE_ID = MAX_USERNAME + HYPHEN + MAX_BRANCH_IMAGE_TYPE;

// Defines maximum length for entities across Weco.
const EntityLimits = {
  branch: MAX_BRANCH_ID,
  branchDescription: MAX_BRANCH_DESCRIPTION,
  branchImage: MAX_BRANCH_IMAGE_ID,
  branchName: MAX_BRANCH_NAME,
  branchRules: MAX_BRANCH_RULES,
  comment: USERNAME_DATE,
  commentText: MAX_COMMENT_TEXT,
  notification: USERNAME_DATE,
  pollAnswer: USERNAME_DATE_DATE,
  pollAnswerText: MAX_POLL_ANSWER_TEXT,
  post: USERNAME_DATE,
  postImage: MAX_POST_IMAGE_ID,
  postText: MAX_POST_TEXT,
  postTitle: MAX_POST_TITLE,
  timestamp: DATE,
  username: MAX_USERNAME,
  userAgeMin: MIN_USER_AGE,
  userFullNameMax: MAX_USER_FULL_NAME,
  userFullNameMin: MIN_USER_FULL_NAME,
  userImage: MAX_USER_IMAGE_ID,
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

const PostTypesHasText = [
  'poll',
  'text',
];

const PostTypesNoText = [
  'audio',
  'image',
  'page',
  'video',
];

const PostTypes = [
  ...PostTypesHasText,
  ...PostTypesNoText,
];

// These are used in user image urls and routes.
const Usernames = [
  'me',
  'orig',
  ...BranchImageTypes,
];

const VoteDirections = [
  'down',
  'up',
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
    PostTypesHasText,
    PostTypesNoText,
    VoteDirections,
    WecoConstants,
  },
  BannedValues: {
    BranchIds,
    Usernames,
  },
  BranchThumbnailType,
  EntityLimits,
  Policy: {
    email: POLICY_EMAIL,
    id: POLICY_ID,
    whitespace: POLICY_WHITESPACE,
  },
};
