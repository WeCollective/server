const moment = require('moment');
const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const NotificationTypes = reqlib('config/notification-types');

// CONSTANTS.
const {
  BranchImageTypes,
  ImageExtensions,
  ModLogActionTypes,
  PostTypes,
  VoteDirections,
  WecoConstants,
} = Constants.AllowedValues;
const {
  BranchIds,
  Usernames,
} = Constants.BannedValues;
const {
  postText,
  timestamp,
  userAgeMin,
  userPasswordMax,
  userPasswordMin,
} = Constants.EntityLimits;
const {
  email,
  id,
  whitespace,
} = Constants.Policy;

// HELPERS.
const allowExt = (str, allowArr) => {
  for (let i = 0; i < allowArr.length; i += 1) {
    if (str.endsWith(`-${allowArr[i]}`)) {
      return true;
    }
  }
  return false;
};
const allowStr = (str, allowArr) => str && typeof str === 'string' && allowArr.includes(str);
const banStr = (str, banArr) => str && typeof str === 'string' && !banArr.includes(str);
const checkId = (type, str) => {
  const maxLen = Constants.EntityLimits[type];

  if (maxLen === undefined) {
    throw new Error(`Id type "${type}" is missing maximum length definition.`);
  }

  return !!(str && typeof str === 'string' &&
    str.length > 0 && str.length <= maxLen &&
    !whitespace.test(str) && id.test(str));
};

// EXPORTS.
const date = int => int && Number.parseInt(int, 10) > 0 && int.toString().length <= timestamp;
const age = int => date(int) && moment().diff(moment(int), 'years') >= userAgeMin;
const array = (arr, minEntries = 0) => Array.isArray(arr) && arr.length >= minEntries;
const boolean = value => typeof value === 'boolean';
const branchid = (str, branchid) => {
  const isValid = checkId('branch', str);

  if (!isValid) return false;

  const hasInvalidValue = !banStr(str, BranchIds);

  // We are verifying branch id or parent id for branch other than root.
  if (!branchid || branchid !== 'root') {
    return !hasInvalidValue;
  }

  // Parent id for root is 'none' which is an invalid value.
  // This is the only exception.
  return true;
};
const branchImageId = str => checkId('branchImage', str) && allowExt(str, BranchImageTypes);
const commentid = str => checkId('comment', str);
const exists = str => !!str;
const extension = str => allowStr(str.toLowerCase(), ImageExtensions);
const isEmail = str => email.test(str);
const length = (str, len) => str && typeof str === 'string' && str.length === len;
const modLogAction = str => allowStr(str, ModLogActionTypes);
const notificationid = str => checkId('notification', str);
const notificationType = int => exists(NotificationTypes[int]);
const number = int => !Number.isNaN(int);
const originalBranches = str => {
  try {
    const arr = JSON.parse(str);
    return array(arr, 1);
  }
  catch (err) {
    return false;
  }
};
const pollanswerid = str => checkId('pollAnswer', str);
const postid = str => checkId('post', str);
const postImageId = str => checkId('postImage', str) && allowExt(str, [Constants.BranchThumbnailType]);
const postType = str => allowStr(str, PostTypes);
const range = (str, min, max) => str && (min === null || str.length >= min) && (max === null || str.length <= max);
const userImageId = str => checkId('userImage', str) && allowExt(str, BranchImageTypes);
const username = str => checkId('username', str) && !Number(str) && banStr(str, Usernames);
const validateEmail = str => exists(str) && isEmail(str);
const validatePostText = str => range(str, null, postText);
const voteDirection = str => allowStr(str, VoteDirections);
const wecoConstantId = str => allowStr(str, WecoConstants);
const wecoConstantValue = (int, str) => allowStr(str, WecoConstants) && typeof int === 'number';

const password = str => range(str, userPasswordMin, userPasswordMax) && !whitespace.test(str);

module.exports = {
  age,
  array,
  boolean,
  branchid,
  branchImageId,
  commentid,
  Constants,
  date,
  email: validateEmail,
  exists,
  extension,
  length,
  modLogAction,
  notificationid,
  notificationType,
  number,
  originalBranches,
  password,
  pollanswerid,
  postid,
  postImageId,
  postText: validatePostText,
  postType,
  range,
  userImageId,
  username,
  voteDirection,
  wecoConstantId,
  wecoConstantValue,
};
