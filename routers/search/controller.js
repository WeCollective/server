const algolia = require('../../config/algolia');
const error = require('../../responses/errors');
const success = require('../../responses/successes');

module.exports.search = (req, res) => {
  const { q: query } = req.query;
  let username = '';

  if (req.user) {
    username = req.user.username;
  }

  // todo save user data?
  console.log(query, username);

  return algolia.search(query)
    .then(results => success.OK(res, { results }))
    .catch(() => error.InternalServerError(res));
};
