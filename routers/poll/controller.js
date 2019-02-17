const reqlib = require('app-root-path').require;

const Constants = reqlib('config/constants');
const Models = reqlib('models/');

const {
  createPollAnswerId,
  createUserVoteItemId,
} = Constants.Helpers;

const { VoteDirections } = Constants.AllowedValues;

module.exports.addAnswer = (req, res, next) => {
  const { postid } = req.params;
  const { text } = req.body;
  const date = new Date().getTime();
  const username = req.user.get('username');
  let post;
  let postData;

  // Post must exist.
  return Models.Post.findById(postid)
    .then(posts => {
      if (!posts.length || posts[0] === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 403,
        });
      }

      post = posts[0];

      return Models.PostData.findById(postid);
    })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 403,
        });
      }

      postData = instance;

      if (post.get('locked') && username !== postData.get('creator')) {
        return Promise.reject({
          message: 'Only the post authors can add answers to this poll.',
          status: 403,
        });
      }

      return Promise.resolve();
    })
    // Add the new poll answer.
    .then(() => Models.PollAnswer.create({
      creator: username,
      date,
      id: createPollAnswerId(postid, date),
      postid,
      text,
      votes: 0,
    }))
    .then(() => next())
    .catch(err => {
      console.log('Error adding a new poll answer:', err);
      req.error = err;
      return next(JSON.stringify(req.error));
    });
};

module.exports.getAnswers = (req, res, next) => {
  const { postid } = req.params;
  const {
    // Used for pagination.
    lastAnswerId,
    sortBy = 'date',
  } = req.query;
  let lastInstance;

  if (!postid) {
    req.error = {
      message: 'Invalid postid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return new Promise((resolve, reject) => {
    if (lastAnswerId) {
      return Models.PollAnswer.findById(lastAnswerId)
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'Poll answer does not exist.',
              status: 403,
            });
          }

          lastInstance = instance;
          return resolve();
        })
        .catch(err => reject(err));
    }

    // No last answer specified, continue...
    return resolve();
  })
    .then(() => Models.PollAnswer.findByPost(postid, sortBy, lastInstance))
    // todo do not return votes if we want to only view them before voting
    .then(answers => {
      res.locals.data = answers.map(instance => ({
        creator: instance.get('creator'),
        date: instance.get('date'),
        id: instance.get('id'),
        postid: instance.get('postid'),
        text: instance.get('text'),
        votes: instance.get('votes'),
      }));
      return next();
    })
    .catch(err => {
      console.error('Error fetching poll answers:', err);
      req.error = err;
      return next(JSON.stringify(req.error));
    });
};

module.exports.vote = (req, res, next) => {
  const {
    answerid,
    postid,
  } = req.params;
  const { vote } = req.body;
  const itemid = createUserVoteItemId(postid, 'poll');
  const username = req.user.get('username');
  let answer;

  if (!postid) {
    req.error = {
      message: 'Invalid postid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!answerid) {
    req.error = {
      message: 'Invalid answerid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!VoteDirections.includes(vote)) {
    req.error = {
      message: 'Invalid vote parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.PollAnswer.findById(answerid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Poll answer does not exist.',
          status: 404,
        });
      }

      answer = instance;

      if (answer.get('postid') !== postid) {
        return Promise.reject({
          message: 'Poll answer does not exist.',
          status: 404,
        });
      }

      return Models.UserVote.findByUsernameAndItemId(username, itemid);
    })
    .then(instance => {
      if (instance !== null) {
        return Promise.reject({
          status: 400,
          message: 'You have already voted on this poll.',
        });
      }

      return Models.UserVote.create({
        direction: vote,
        itemid,
        username,
      });
    })
    .then(() => {
      answer.set('votes', answer.get('votes') + 1);
      return answer.update();
    })
    .then(() => next())
    .catch(err => {
      console.error('Error voting on poll answer:', err);

      if (typeof err === 'object' && err.status) {
        req.error = err;
        return next(JSON.stringify(req.error));
      }

      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};
