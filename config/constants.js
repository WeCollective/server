// These are used in urls and routes.
const BranchIds = [
  'none',
  'p',
];

// Defines maximum length for entities across Weco.
const EntityLimits = {
  branch: 30,
  comment: 45,
  notification: 30,
  pollAnswer: 45,
  post: 45,
  username: 20,
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
