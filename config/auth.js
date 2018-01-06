const bcrypt = require('bcryptjs');

// Compare password with stored hash from database using bcrypt.
module.exports.compare = (password, hash) => new Promise((resolve, reject) => {
  bcrypt.compare(password, hash, (err, res) => {
    if (err) {
      return reject({
        message: 'Something went wrong',
        status: 500,
      });
    }

    if (!res) {
      return reject({
        message: 'Incorrect password',
        status: 400,
      });
    }

    return resolve();
  });
});

module.exports.generateSalt = () => new Promise((resolve, reject) => {
  bcrypt.genSalt(10, (err, salt) => {
    if (err) {
      return reject(err);
    }

    return resolve(salt);
  });
});

module.exports.generateToken = (length = 16) => {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let token = '';
  for (let i = 0; i < length; i += 1) {
    token += chars[Math.round(Math.random() * (chars.length - 1))];
  }
  return token;
};

module.exports.hash = (password, salt) => new Promise((resolve, reject) => {
  bcrypt.hash(password, salt, (err, hash) => {
    if (err) {
      return reject();
    }

    return resolve(hash);
  });
});
