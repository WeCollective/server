const NotificationTypes = require('../config/notification-types');

const policy = /^[a-z0-9_-]+$/;
const validate = {};

validate.boolean = value => {
  return 'boolean' === typeof value;
};

validate.branchid = string => {
  // Branch id cannot be one of these words.
  // They are used in urls and routes.
  const bannedIds = [
    'p',
    'none',
  ];

  if (!string || string.length < 1 || string.length > 30) {
    return false;
  }

  if (!policy.test(string) || bannedIds.includes(string)) {
    return false;
  }

  return true;
};

validate.commentid = id => {
  if (!id || id.length < 1 || id.length > 45) {
    return false;
  }
  
  // ensure id contains no whitespace
  if (/\s/g.test(id)) {
    return false;
  }
  
  // ensure id is a lowercase string
  if (!('string' === typeof id || id instanceof String) ||
    id !== id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.date = date => {
  if (!date || !Number(date) > 0) {
    return false;
  }

  return true;
};

validate.extension = ext => {
  const allowedExt = [
    'jpg',
    'jpe',
    'jpeg',
    'png',
    'bmp',
  ];
  return allowedExt.includes(ext.toLowerCase());
};

validate.notificationid = id => {
  if (!id || id.length < 1 || id.length > 30) {
    return false;
  }

  // ensure id contains no whitespace
  if (/\s/g.test(id)) {
    return false;
  }
  
  // ensure id is a lowercase string
  if (!('string' === typeof id || id instanceof String) ||
    id !== id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.notificationType = value => {
  for (let type in NotificationTypes) {
    if (NotificationTypes[type] === value) {
      return true;
    }
  }

  return false;
};

validate.pollanswerid = id => {
  if (!id || id.length < 1 || id.length > 45) {
    return false;
  }
  
  // ensure id contains no whitespace
  if (/\s/g.test(id)) {
    return false;
  }
  
  // ensure id is a lowercase string
  if (!('string' === typeof id || id instanceof String) ||
    id != id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.postid = id => {
  if (!id || id.length < 1 || id.length > 45) {
    return false;
  }
  
  // ensure id contains no whitespace
  if (/\s/g.test(id)) {
    return false;
  }
  
  // ensure id is a lowercase string
  if (!('string' === typeof id || id instanceof String) ||
    id != id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.username = string => {
  // Username cannot be one of these words.
  // They are used in user image urls and routes.
  const bannedUsernames = [
    'me',
    'orig',
    'picture',
    'cover',
  ];

  if (!string || string.length < 1 || string.length > 20) {
    return false;
  }

  if (!policy.test(string) || bannedUsernames.includes(string)) {
    return false;
  }
  
  // Username cannot be only numeric.
  if (Number(string)) {
    return false;
  }

  return true;
};

validate.wecoConstantId = value => {
  const allowedConstants = ['donation_total', 'raised_total', 'user_count', 'branch_count'];
  return allowedConstants.includes(value);
};

validate.wecoConstantValue = (id, value) => {
  switch(id) {
    case 'branch_count':
    case 'donation_total':
    case 'raised_total':
    case 'user_count':
      console.log('TYPEOF: ', typeof value);
      
      if (typeof value === 'number') {
        return true;
      }
      return false;

    default:
      return false;
  }
};

module.exports = validate;
