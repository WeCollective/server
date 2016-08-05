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
}

module.exports = validate;
