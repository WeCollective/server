var bcrypt = require('bcryptjs');

module.exports = {
  generateToken: function() {
    // create a random 16 character verification token for the new user
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var token = '';
    for(var i = 0; i < 16; i++) {
      token += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return token;
  },
  generateSalt: function(iterations) {
    return new Promise(function(resolve, reject) {
      bcrypt.genSalt(10, function(err, salt) {
        if(err) reject();
        resolve(salt);
      });
    });
  },
  hash: function(password, salt) {
    return new Promise(function(resolve, reject) {
      bcrypt.hash(password, salt, function(err, hash) {
        if(err) reject();
        resolve(hash);
      });
    });
  },
  compare: function(password, hash) {
    return new Promise(function(resolve, reject) {
      // compare password with stored hash from database using bcrypt
      bcrypt.compare(password, hash, function(err, res) {
        if(err) reject({ status: 500, message: 'Something went wrong' });
        if(res) resolve();
        reject({ status: 400, message: 'Password mismatch' });
      });
    });
  }
};
