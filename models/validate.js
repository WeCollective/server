const NotificationTypes = require('../config/notification-types');

let validate = {};

validate.boolean = value => {
  return 'boolean' === typeof value;
};

validate.branchid = id => {
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
  
  // ensure id is not one of the banned words
  // (these words are used in urls and routes)
  const bannedIds = ['p', 'none'];
  
  if (bannedIds.indexOf(id) !== -1) {
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
    id != id.toLowerCase()) {
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
  const allowedExt = ['jpg', 'JPG', 'jpe', 'JPE', 'jpeg', 'JPEG', 'png', 'PNG', 'bmp', 'BMP'];
  return allowedExt.includes(ext);
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

validate.username = username => {
  // ensure username length is over 1 char and less than 20
  if (!username || username.length < 1 || username.length > 20) {
    return false;
  }
  
  // ensure username contains no whitespace
  if (/\s/g.test(username)) {
    return false;
  }
  
  // ensure username is a lowercase string
  if (!('string' === typeof username || username instanceof String) ||
    username != username.toLowerCase()) {
    return false;
  }
  
  // ensure username is not one of the banned words
  // (these words are used in user image urls and routes)
  const bannedUsernames = ['me', 'orig', 'picture', 'cover'];
  if (bannedUsernames.includes(username)) {
    return false;
  }
  
  // ensure username is not only numeric
  if (Number(username)) {
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
