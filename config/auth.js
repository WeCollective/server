var bcrypt = require('bcryptjs');

module.exports = {
  // Compare password with stored hash from database using bcrypt.
  compare: (password, hash) => {
    return new Promise( (resolve, reject) => {
      bcrypt.compare(password, hash, (err, res) => {
        if (err) {
          return reject({
            message: 'Something went wrong',
            status: 500
          });
        }

        if (res) {
          return resolve();
        }

        return reject({
          message: 'Password mismatch',
          status: 400
        });
      });
    });
  },

  generateSalt: iterations => {
    return new Promise( (resolve, reject) => {
      bcrypt.genSalt(10, (err, salt) => {
        if (err) {
          return reject();
        }
        else {
          return resolve(salt);
        }
      });
    });
  },

  generateToken: (length = 16) => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return token;
  },

  hash: (password, salt) => {
    return new Promise( (resolve, reject) => {
      bcrypt.hash(password, salt, (err, hash) => {
        if (err) {
          return reject();
        }
        else {
          return resolve(hash);
        }
      });
    });
  }
};
