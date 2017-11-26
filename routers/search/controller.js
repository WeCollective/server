const error = require('../../responses/errors');
// const success = require('../../responses/successes');

module.exports.search = (req, res) => {
  const { q } = req.query;
  let username = '';

  if (req.user) {
    username = req.user.username;
  }

  console.log(q, username);

  return error.InternalServerError(res);
};
