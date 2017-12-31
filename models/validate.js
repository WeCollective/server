const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const NotificationTypes = reqlib('config/notification-types');

// CONSTANTS.
const ALLOWED_CONST = Constants.AllowedValues.WecoConstants;
const ALLOWED_IMAGE_EXT = Constants.AllowedValues.ImageExtensions;
const BANNED_BRANCH_IDS = Constants.BannedValues.BranchIds;
const BANNED_USERNAMES = Constants.BannedValues.Usernames;

// HELPERS.
const allowStr = (str, allowArr) => str && typeof str === 'string' && allowArr.includes(str);
const banStr = (str, banArr) => str && typeof str === 'string' && !banArr.includes(str);
const checkId = (type, str) => {
  const maxLen = Constants.EntityLimits[type];

  if (maxLen === undefined) {
    throw new Error(`Id type "${type}" is missing maximum length definition.`);
  }

  // Ids cannot contain whitespace and must include only
  // lowercase characters, digits, underscore, or hyphen.
  return !!(str && typeof str === 'string' &&
    str.length > 0 && str.length <= maxLen &&
    !/\s/g.test(str) && /^[a-z0-9_-]+$/.test(str));
};

// EXPORTS.
const boolean = value => typeof value === 'boolean';
const branchid = str => checkId('branch', str) && banStr(str, BANNED_BRANCH_IDS);
const commentid = str => checkId('comment', str);
const date = date => !!(date && Number(date) > 0);
const extension = str => allowStr(str.toLowerCase(), ALLOWED_IMAGE_EXT);
const notificationid = str => checkId('notification', str);
const notificationType = int => !!NotificationTypes[int];
const pollanswerid = str => checkId('pollAnswer', str);
const postid = str => checkId('post', str);
const username = str => checkId('username', str) && !Number(str) && banStr(str, BANNED_USERNAMES);
const wecoConstantId = str => allowStr(str, ALLOWED_CONST);
const wecoConstantValue = (str, int) => allowStr(str, ALLOWED_CONST) && typeof int === 'number';

module.exports = {
  boolean,
  branchid,
  commentid,
  date,
  extension,
  notificationid,
  notificationType,
  pollanswerid,
  postid,
  username,
  wecoConstantId,
  wecoConstantValue,
};
