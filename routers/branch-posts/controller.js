'use strict';

const ACL = require('../../config/acl');
const aws = require('../../config/aws');
const Branch = require('../../models/branch.model');
const error  = require('../../responses/errors');
const FlaggedPost = require('../../models/flagged-post.model');
const fs  = require('../../config/filestorage');
const Mod = require('../../models/mod.model');
const Notification = require('../../models/notification.model');
const NotificationTypes = require('../../config/notification-types');
const Post = require('../../models/post.model');
const PostCtrl = require('../post/controller');
const PostData  = require('../../models/post-data.model');
const PostImage = require('../../models/post-image.model');
const success   = require('../../responses/successes');
const User = require('../../models/user.model');
const Vote = require('../../models/user-vote.model');

const VALID_POST_TYPE_VALUES = [
  'all',
  'audio',
  'image',
  'page',
  'poll',
  'text',
  'video',
];
const VALID_SORT_BY_MOD_VALUES = [
  'branch_rules',
  'date',
  'nsfw',
  'site_rules',
  'wrong_type',
];
const VALID_SORT_BY_USER_VALUES = [
  'comment_count',
  'date',
  'points',
];

function userCanDisplayNSFWPosts(req) {
  return new Promise((resolve, reject) => {
    if (req.isAuthenticated() && req.user.username) {
      const user = new User();

      user.findByUsername(req.user.username)
        .then(() => resolve(user.data.show_nsfw))
        .catch(reject);
    }
    else {
      return resolve(false);
    }
  });
}

const put = {
  verifyParams(req) {
    if (!req.params.branchid) {
      return Promise.reject({
        code: 400,
        message: 'Missing branchid',
      });
    }

    if (!req.params.postid) {
      return Promise.reject({
        code: 400,
        message: 'Missing postid.',
      });
    }

    if (!req.user.username) {
      console.error('No username found in session.');
      return Promise.reject({ code: 500 });
    }

    if (!req.body.vote || (req.body.vote !== 'up' && req.body.vote !== 'down')) {
      return Promise.reject({
        code: 400,
        message: 'Missing or malformed vote parameter.',
      });
    }

    return Promise.resolve();
  },
};

module.exports = {
  get(req, res) {
    const branchid = req.params.branchid;

    if (!branchid) {
      return error.BadRequest(res, 'Missing branchid parameter');
    }

    const getFlaggedPosts = req.query.flag === 'true';

    let opts = {
      fetchOnlyflaggedPosts: getFlaggedPosts,
      nsfw: false,
      postType: req.query.postType  || 'all',
      sortBy: req.query.sortBy || (getFlaggedPosts ? 'date' : 'points'),
      // individual/local/global stats [if normal posts]
      stat: req.query.stat || 'individual',
      timeafter: req.query.timeafter || 0,
    };
    
    if (!VALID_POST_TYPE_VALUES.includes(opts.postType)) {
      return error.BadRequest(res, 'Invalid postType parameter');
    }

    const validSortByValues = opts.fetchOnlyflaggedPosts ? VALID_SORT_BY_MOD_VALUES : VALID_SORT_BY_USER_VALUES;
    if (!validSortByValues.includes(opts.sortBy)) {
      return error.BadRequest(res, 'Invalid sortBy parameter');
    }

    let lastPost = null;
    let posts = [];
    
    new Promise((resolve, reject) => {
      // Client wants only results that appear after this post (pagination).
      if (req.query.lastPostId) {
        const post = new Post();
        const postData = new PostData();

        // get the post
        return post
          .findByPostAndBranchIds(req.query.lastPostId, branchid)
          // fetch post data
          .then(() => postData.findById(req.query.lastPostId) )
          .then(() => {
            // create lastPost object
            lastPost = post.data;
            lastPost.data = postData.data;
            return resolve();
          })
          .catch(err => {
            if (err) {
              return reject(err);
            }

            // Invalid lastPostId.
            return reject({ code: 404 });
          });
      }
      
      // No last post specified, continue...
      return resolve();
    })
      // Authenticated users can set to display nsfw posts.
      .then(() => new Promise((resolve, reject) => userCanDisplayNSFWPosts(req)
        .then(displayNSFWPosts => {
          opts.nsfw = displayNSFWPosts;
          return resolve();
        })
        .catch(reject)
      ))
      // Check if the user has permissions to fetch the requested posts.
      .then(() => new Promise((resolve, reject) => {
        if (opts.fetchOnlyflaggedPosts) {
          if (!req.user) {
            return reject({ code: 403 });
          }

          // User must be a mod.
          return ACL.validateRole(ACL.Roles.Moderator, branchid)(req, res, resolve);
        }
        
        return resolve();
      }))
      // Get the posts - metadata, votes, etc.
      .then(() => {
        const post = opts.fetchOnlyflaggedPosts ? new FlaggedPost() : new Post();
        return post.findByBranch(branchid, opts.timeafter, opts.nsfw, opts.sortBy, opts.stat, opts.postType, lastPost);
      })
      // Get posts.
      .then(results => {
        posts = results;

        const promises = [];

        posts.forEach((post, index) => promises.push(new Promise((resolve, reject) => PostCtrl
          .getOnePost(post.id, req, branchid)
          .then(post => {
            // Extend object so we don't delete the flag properties.
            Object.assign(posts[index], post);
            return resolve();
          })
          .catch(reject))));

        return Promise.all(promises);
      })
      .then(() => success.OK(res, posts))
      .catch(err => {
        console.error('Error fetching posts:', err);

        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      });
  },

  put(req, res) {
    const branchid = req.params.branchid;
    const branchIds = [];
    const postid = req.params.postid;
    const username = req.user.username;
    const vote = new Vote();

    let newVoteDirection;
    let newVoteOppositeDirection;
    let post;
    let resData = { delta: 0 };
    let userAlreadyVoted = false;

    put.verifyParams(req)
      .then(() => {
        post = new Post({
          branchid,
          id: postid,
        });

        newVoteDirection = req.body.vote;

        return vote.findByUsernameAndItemId(username, `post-${postid}`);
      })
      .then(existingVoteData => {
        if (existingVoteData) {
          userAlreadyVoted = true;

          if (existingVoteData.direction !== newVoteDirection) {
            newVoteOppositeDirection = newVoteDirection === 'up' ? 'down' : 'up';
          }
        }

        return Promise.resolve();
      })
      .then(() => new Post().findById(postid))
      // Update the post "up" and "down" attributes.
      // Vote stats will be auto-updated by a lambda function.
      .then(posts => {
        // find all post entries to get the list of branches it is tagged to
        let promise;

        for (let i = 0; i < posts.length; i += 1) {
          branchIds.push(posts[i].branchid);

          // Find the post on the specified branchid.
          if (posts[i].branchid === branchid) {
            let delta = 0;

            if (userAlreadyVoted) {
              // Undo the last vote and add the new vote.
              if (newVoteOppositeDirection) {
                post.set(newVoteOppositeDirection, posts[i][newVoteOppositeDirection] - 1);
                post.set(newVoteDirection, posts[i][newVoteDirection] + 1);
                delta = (newVoteOppositeDirection === 'up') ? 2 : -2;
              }
              // Undo the last vote.
              else {
                post.set(newVoteDirection, posts[i][newVoteDirection] - 1);
                delta = (newVoteDirection === 'up') ? -1 : 1;
              }
            }
            else {
              post.set(newVoteDirection, posts[i][newVoteDirection] + 1);
              delta = (newVoteDirection === 'up') ? 1 : -1;
            }

            promise = post.update();
            resData.delta = delta;
          }
        }

        if (!promise) {
          return Promise.reject({
            code: 400,
            message: 'Invalid branchid',
          });
        }

        return promise;
      })
      // Update the post points count on each branch object the post appears in.
      .then(() => {
        const promises = [];        

        for (let i = 0; i < branchIds.length; i += 1) {
          promises.push(new Promise((resolve, reject) => {
            const branch = new Branch();

            branch.findById(branchIds[i])
              .then(() => {
                branch.set('post_points', branch.data.post_points + resData.delta);

                branch
                  .update()
                  .then(resolve)
                  .catch(reject);
              })
              .catch(reject);
          }));
        }

        return Promise.all(promises);
      })
      // Create, update, or delete the vote record in the database.
      .then(() => {
        if (userAlreadyVoted) {
          if (newVoteOppositeDirection) {
            vote.set('direction', newVoteDirection);
            return vote.update();
          }

          return vote.delete();
        } 
        
        const newVote = new Vote({
          direction: newVoteDirection,
          itemid: `post-${postid}`,
          username,
        });

        const propertiesToCheck = [
          'itemid',
          'username',
        ];

        const invalids = newVote.validate(propertiesToCheck);

        if (invalids.length > 0) {
          console.error(`Error creating Vote: invalid ${invalids[0]}`);
          return Promise.reject({ code: 500 });
        }

        return newVote.save();
      })
      .then(() => success.OK(res, resData))
      .catch(err => {
        if (err) {
          console.error('Error voting on a post: ', err);

          if (typeof err === 'object' && err.code) {
            return error.code(res, err.code, err.message);
          }

          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  getPost(req, res) {
    const branchid = req.params.branchid;
    const post = new Post();
    const postid = req.params.postid;

    if (!branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (!postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    post.findByPostAndBranchIds(postid, branchid)
      .then(() => success.OK(res, post.data))
      .catch(err => {
        if (err) {
          console.error('Error fetching post on branch:', err);
          return error.InternalServerError(res);
        }
        return error.NotFound(res);
      });
  },

  resolveFlag(req, res) {
    const action = req.body.action;
    const branchid = req.params.branchid;
    const message = req.body.message;
    const postid = req.params.postid;
    const reason = req.body.reason;
    const type = req.body.type;
    const username = req.user.username;

    const date = new Date().getTime();

    if (!branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (!postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    if (!username) {
      console.error('No username found in session.');
      return error.InternalServerError(res);
    }

    if (!action || !['approve', 'change_type', 'mark_nsfw', 'remove'].includes(action)) {
      return error.BadRequest(res, 'Missing/invalid action parameter');
    }

    if (action === 'change_type' && !type) {
      return error.BadRequest(res, 'Missing type parameter');
    }

    if (action === 'remove' && !reason) {
      return error.BadRequest(res, 'Missing reason parameter');
    }

    switch (action) {
      // Delete flag for this post on this branch.
      case 'approve': {
        return new FlaggedPost().delete({
          branchid,
          id: postid,
        })
          .then(() => success.OK(res))
          .catch(err => {
            if (err) {
              console.error('Error fetching post on branch:', err);
              return error.InternalServerError(res);
            }
            return error.NotFound(res);
          });
      }

      case 'change_type':
      case 'mark_nsfw': {
        const oldPost = new Post();
        const postData = new PostData();

        // Get the post data.
        return postData.findById(postid)
          .then(() => {
            // Change post type for all branches it appears in.
            if (action === 'change_type') {
              return new Post().findById(postid);
            }

            // Get the original post.
            return oldPost.findByPostAndBranchIds(postid, branchid);
          })
          .then(posts => {
            if (action === 'change_type') {
              if (!posts || posts.length === 0) {
                return Promise.reject({ code: 404 });
              }

              const promises = [];

              for (let i = 0; i < posts.length; i += 1) {
                const post = new Post();
                post.set('type', type);

                // validate post properties
                const propertiesToCheck = ['type'];
                const invalids = post.validate(propertiesToCheck);
                if (invalids.length > 0) {
                  return Promise.reject({
                    code: 400,
                    message: 'Invalid type parameter',
                  });
                }

                promises.push(post.update({
                  branchid: posts[i].branchid,
                  id: posts[i].id,
                }));
              }

              return Promise.all(promises);
            }

            oldPost.set('nsfw', true);
            return oldPost.update();
          })
          // Now delete post flags.
          .then(() => new FlaggedPost().delete({
            branchid,
            id: postid,
          }))
          // Notify the OP that their post type was changed.
          .then(() => {
            const user = postData.data.creator;

            const notification = new Notification({
              data: {
                branchid,
                postid,
                username,
              },
              date,
              id: `${user}-${date}`,
              type: (action === 'change_type') ? NotificationTypes.POST_TYPE_CHANGED : NotificationTypes.POST_MARKED_NSFW,
              unread: true,
              user,
            });

            if (action === 'change_type') {
              notification.data.data.type = type;
            }

            const invalids = notification.validate();
            if (invalids.length > 0) {
              console.error('Error creating notification.', invalids);
              return Promise.reject({ code: 500 });
            }

            return notification.save();
          })
          .then(() => success.OK(res))
          .catch(err => {
            if (err) {
              console.error('Error fetching post on branch:', err);
              return error.InternalServerError(res);
            }
            return error.NotFound(res);
          });
      }

      case 'remove': {
        const deletedPost = new Post();
        const parentBranch = new Branch();
        const postData = new PostData();

        let pointsToSubtract = 0;
        let commentsToSubtract = 0;

        // Get the original post.
        return postData.findById(postid)
          // Update the branch stats. Grab the deleted posts comments and global points.
          // Subtract those values from the branch totals for the branch where this post
          // belonged to. Also decrease the branch post totals by one. We are applying
          // this diff only to a single branch. If this post resides in any child branches,
          // we do not interact with those or modify the post's instances in those branches.
          .then(() => deletedPost.findByPostAndBranchIds(postid, branchid))
          .then(() => {
            console.log(deletedPost, postid, branchid);
            return Promise.reject('fail me');
            pointsToSubtract = deletedPost.data.global;
            commentsToSubtract = deletedPost.data.comment_count;
            return parentBranch.findById(branchid);
          })
          .then(() => {
            parentBranch.set('post_comments', parentBranch.data.post_comments - commentsToSubtract);
            parentBranch.set('post_count', parentBranch.data.post_count - 1);
            parentBranch.set('post_points', parentBranch.data.post_points - pointsToSubtract);
            return parentBranch.update();
          })
          // Delete flag for this post on this branch.
          .then(() => new FlaggedPost().delete({
            branchid,
            id: postid,
          }))
          // Delete actual post from this branch.
          .then(() => deletedPost.delete())
          // Notify the OP that their post was removed.
          .then(() => {
            const user = postData.data.creator;

            const notification = new Notification({
              data: {
                branchid,
                message,
                postid,
                reason,
                username,
              },
              date,
              id: `${user}-${date}`,
              type: NotificationTypes.POST_REMOVED,
              unread: true,
              user,
            });

            const invalids = notification.validate();
            if (invalids.length > 0) {
              console.error('Error creating notification.', invalids);
              return Promise.reject({ code: 500 });
            }

            return notification.save();
          })
          // Notify global mods of posts removed for breaching site rules.
          .then(() => {
            if (reason === 'site_rules') {
              const promises = [];

              // Get global mods.
              return new Mod().findByBranch('root')
                .then(mods => {
                  for (let i = 0; i < mods.length; i += 1) {
                    const notification = new Notification({
                      data: {
                        branchid,
                        message,
                        postid,
                        reason,
                        username,
                      },
                      date,
                      id: `${mods[i].username}-${date}`,
                      type: NotificationTypes.POST_REMOVED,
                      unread: true,
                      user: mods[i].username,
                    });

                    const invalids = notification.validate();
                    if (invalids.length > 0) {
                      console.error('Error creating notification.', invalids);
                      return Promise.reject({ code: 500 });
                    }

                    promises.push(notification.save());
                  }

                  return Promise.all(promises);
                })
                .catch(err => Promise.reject(err));
            }

            return Promise.resolve();
          })
          .then(() => success.OK(res))
          .catch(err => {
            if (err) {
              console.error('Error fetching post on branch:', err);
              return error.InternalServerError(res);
            }
            return error.NotFound(res);
          });
      }

      default:
        return error.BadRequest(res, 'Invalid action parameter');
    }
  }
};
