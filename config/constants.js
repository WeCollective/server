// check each model validations and entity limits checking

// BASE CONSTANTS.
const DATE = 13; // We use 13-digit unix timestamps.
const HYPHEN = 1; // Classic "-" character.
const MAX_BRANCH = 30;
const MAX_USERNAME = 20;
const USERNAME_DATE = MAX_USERNAME + HYPHEN + DATE;
const USERNAME_DATE_DATE = USERNAME_DATE + HYPHEN + DATE;

// These are used in urls and routes.
const BranchIds = [
  'none',
  'p',
];

// Defines maximum length for entities across Weco.
const EntityLimits = {
  branch: MAX_BRANCH,
  comment: USERNAME_DATE,
  notification: USERNAME_DATE,
  pollAnswer: USERNAME_DATE_DATE,
  post: USERNAME_DATE,
  username: MAX_USERNAME,
};

const ImageExtensions = [
  'bmp',
  'jpe',
  'jpeg',
  'jpg',
  'png',
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
    ImageExtensions,
    WecoConstants,
  },
  BannedValues: {
    BranchIds,
    Usernames,
  },
  EntityLimits,
};
