var NotificationTypes = require('../config/notification-types.js');

var validate = {};

validate.date = function(date) {
  if(!date || !Number(date) > 0) {
    return false;
  }
  return true;
};

validate.extension = function(extension) {
  var extensions = ['jpg', 'JPG', 'jpe', 'JPE', 'jpeg', 'JPEG', 'png', 'PNG', 'bmp', 'BMP'];
  if(extensions.indexOf(extension) == -1) {
    return false;
  }
  return true;
};

validate.branchid = function(id) {
  if(!id || id.length < 1 || id.length > 30) {
    return false;
  }
  // ensure id contains no whitespace
  if(/\s/g.test(id)) {
    return false;
  }
  // ensure id is a lowercase string
  if(!(typeof id === 'string' || id instanceof String) ||
      id != id.toLowerCase()) {
    return false;
  }
  // ensure id is not one of the banned words
  // (these words are used in urls and routes)
  var bannedIds = ['p', 'none'];
  if(bannedIds.indexOf(id) > -1) {
    return false;
  }

  return true;
};

validate.username = function(username) {
  // ensure username length is over 1 char and less than 20
  if(!username ||
      username.length < 1 || username.length > 20) {
    return false;
  }
  // ensure username contains no whitespace
  if(/\s/g.test(username)) {
    return false;
  }
  // ensure username is a lowercase string
  if(!(typeof username === 'string' || username instanceof String) ||
      username != username.toLowerCase()) {
    return false;
  }
  // ensure username is not one of the banned words
  // (these words are used in user image urls and routes)
  var bannedUsernames = ['me', 'orig', 'picture', 'cover'];
  if(bannedUsernames.indexOf(username) > -1) {
    return false;
  }
  // ensure username is not only numeric
  if(Number(username)) {
    return false;
  }

  return true;
};

validate.postid = function(id) {
  if(!id || id.length < 1 || id.length > 45) {
    return false;
  }
  // ensure id contains no whitespace
  if(/\s/g.test(id)) {
    return false;
  }
  // ensure id is a lowercase string
  if(!(typeof id === 'string' || id instanceof String) ||
      id != id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.commentid = function(id) {
  if(!id || id.length < 1 || id.length > 45) {
    return false;
  }
  // ensure id contains no whitespace
  if(/\s/g.test(id)) {
    return false;
  }
  // ensure id is a lowercase string
  if(!(typeof id === 'string' || id instanceof String) ||
      id != id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.notificationid = function(id) {
  if(!id || id.length < 1 || id.length > 30) {
    return false;
  }
  // ensure id contains no whitespace
  if(/\s/g.test(id)) {
    return false;
  }
  // ensure id is a lowercase string
  if(!(typeof id === 'string' || id instanceof String) ||
      id != id.toLowerCase()) {
    return false;
  }

  return true;
};

validate.boolean = function(value) {
  return typeof value === 'boolean';
};

validate.notificationType = function(value) {
  for(var type in NotificationTypes) {
    if(NotificationTypes[type] == value) {
      return true;
    }
  }
  return false;
};

validate.wecoConstantId = function(value) {
  // ensure value is one of the valid site wide constants
  if(['donation_total', 'raised_total', 'user_count', 'branch_count'].indexOf(value) > -1) {
    return true;
  }
  return false;
};

validate.wecoConstantValue = function(id, value) {
  switch(id) {
    case 'donation_total':
    case 'raised_total':
    case 'user_count':
    case 'branch_count':
      console.log("TYPEOF: ", typeof value);
      if(typeof value === "number") return true;
      return false;
    default:
      return false;
  }
};

module.exports = validate;
