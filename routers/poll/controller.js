'use strict';

const error = require('../../responses/errors');
const PollAnswer = require('../../models/poll-answer.model');
const Post = require('../../models/post.model');
const PostData = require('../../models/post-data.model');
const success = require('../../responses/successes');
const UserVote = require('../../models/user-vote.model');

module.exports = {
  get(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    const sortBy = req.query.sortBy || 'date';

    // if lastAnswerId is specified, client wants results which appear _after_ this answer (pagination)
    let lastAnswer;
    new Promise((resolve, reject) => {
      if (req.query.lastAnswerId) {
        const answer = new PollAnswer();
        // get the post
        answer.findById(req.query.lastAnswerId)
          .then(() => {
            // create lastAnswer object
            lastAnswer = answer.data;
            return resolve();
          })
          .catch(err => {
            if (err) {
              return reject();
            }

            return error.NotFound(res); // lastAnswerId is invalid
          });
      }
      else {
        // no last answer specified, continue
        resolve();
      }
    })
    .then(() => new PollAnswer().findByPost(req.params.postid, sortBy, lastAnswer))
    .then(answers => {
      if (!answers || !answers.length) {
        return error.NotFound(res);
      }

      return success.OK(res, answers);
    })
    .catch(err => {
      if (err) {
        console.error('Error fetching post data:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
  },

  post(req, res) {
    if (!req.user.username) {
      console.error(`No username found in session.`);
      return error.InternalServerError(res);
    }

    // ensure postid exists
    const postdata = new PostData();
    new Post()
      .findById(req.params.postid)
      .then(posts => {
        if (!posts.length) {
          return error.NotFound(res);
        }

        return new Promise((resolve, reject) => {
          if (posts[0].locked) {
            postdata.findById(req.params.postid)
              .then(() => {
                if (req.user.username !== postdata.data.creator) {
                  return error.Forbidden(res, 'Post is locked, only the creator can submit answers');
                }
                else {
                  return resolve();
                }
              })
              .catch(() => error.InternalServerError(res));
          }
          else {
            return resolve();
          }
        });
      })
      .then(() => {
        const date = new Date().getTime();

        // create new poll answer
        const answer = new PollAnswer({
          creator: req.user.username,
          date,
          id: `${req.params.postid}-${date}`,
          postid: req.params.postid,
          text: req.body.text,
          votes: 0,
        });

        // validate request properties
        const propertiesToCheck = ['id', 'postid', 'votes', 'text', 'creator', 'date'];
        const invalids = answer.validate(propertiesToCheck);
        
        if (invalids.length > 0) {
          return error.BadRequest(res, `Invalid ${invalids[0]}`);
        }

        answer
          .save()
          .then(() => success.OK(res))
          .catch(() => error.InternalServerError(res));
      })
      .catch(() => error.NotFound(res));
  },

  votePoll(req, res) {
    if (!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    if (!req.params.answerid) {
      return error.BadRequest(res, 'Missing answerid');
    }

    if (req.body.vote !== 'up') {
      return error.BadRequest(res, 'Missing or malformed vote parameter');
    }

    const updatedAnswer = new PollAnswer();
    updatedAnswer
      .findById(req.params.answerid)
      .then(() => {
        if (updatedAnswer.data.postid !== req.params.postid) {
          return error.NotFound(res);
        }

        const uservote = new UserVote();
        return uservote.findByUsernameAndItemId(req.user.username, `poll-${req.params.postid}`);
      }, () => {
        return error.NotFound(res);
      })
      .then(() => {
        // user has voted on this poll before
        return error.BadRequest(res, 'User has already voted on this poll');
      }, () => {
        // user has not voted on this poll before
        updatedAnswer.set('votes', updatedAnswer.data.votes + 1);
        return updatedAnswer.update();
      })
      .then(response => {
        const vote = new UserVote({
          direction: req.body.vote,
          itemid: `poll-${req.params.postid}`,
          username: req.user.username,
        });

        return vote.save();
      })
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          console.error('Error voting on poll answer:', err);
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },
};
