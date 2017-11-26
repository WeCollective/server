// const error = require('../../responses/errors');
const success = require('../../responses/successes');

module.exports.search = (req, res) => {
  const { q } = req.query;
  let username = '';

  if (req.user) {
    username = req.user.username;
  }

  console.log(q, username);

  const results = [{
    text: 'item 1',
  }, {
    text: 'item 2',
  }, {
    text: 'item 3',
  }, {
    text: 'item 4',
  }, {
    text: 'item 5',
  }];

  return success.OK(res, { results });
  // return error.InternalServerError(res);
};
