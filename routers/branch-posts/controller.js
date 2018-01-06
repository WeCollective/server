const reqlib = require('app-root-path').require;

const algolia = reqlib('config/algolia');
const ACL = reqlib('config/acl');
const Constants = reqlib('config/constants');
const error  = reqlib('responses/errors');
const Models = reqlib('models/');
const NotificationTypes = reqlib('config/notification-types');
const PostCtrl = reqlib('routers/post/controller');
const success = reqlib('responses/successes');

const {
  PostFlagPostViolatesSiteRules,
  PostFlagResponseChangePostType,
  PostFlagResponseDeletePost,
  PostFlagResponseKeepPost,
  PostFlagResponseMarkPostNSFW,
} = Constants;

const {
  PostFlagTypes,
  PostFlagResponseTypes,
  PostTypes,
  VoteDirections,
} = Constants.AllowedValues;

const {
  createNotificationId,
  createUserVoteItemId,
} = Constants.Helpers;

const VALID_POST_TYPE_VALUES = [
  'all',
  ...PostTypes,
];

const VALID_SORT_BY_MOD_VALUES = [
  'date',
  ...PostFlagTypes,
];
const VALID_SORT_BY_USER_VALUES = [
  'comment_count',
  'date',
  'points',
];

// Authenticated users can choose to see nsfw posts.
const userCanDisplayNSFWPosts = req => req.user ? !!req.user.get('show_nsfw') : false;

module.exports.resolveFlag = (req, res) => {
  const {
    action,
    message,
    reason,
    type,
  } = req.body;
  const {
    branchid,
    postid,
  } = req.params;
  const date = new Date().getTime();
  const username = req.user.get('username');

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  if (!PostFlagResponseTypes.includes(action)) {
    return error.BadRequest(res, 'Invalid action parameter.');
  }

  if (action === PostFlagResponseChangePostType && !type) {
    return error.BadRequest(res, 'Missing type parameter.');
  }

  if (action === PostFlagResponseDeletePost && !reason) {
    return error.BadRequest(res, 'Missing reason parameter.');
  }

  switch (action) {
    // Delete flag for this post on this branch.
    case PostFlagResponseKeepPost: {
      return Models.FlaggedPost.destroy({
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

    case PostFlagResponseChangePostType:
    case PostFlagResponseMarkPostNSFW: {
      const isChangingType = action === PostFlagResponseChangePostType;
      let postData;

      return Models.PostData.findById(postid)
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'Post does not exist.',
              status: 404,
            });
          }

          postData = instance;

          // Change post type for all branches it appears in.
          if (isChangingType) {
            return Models.Post.findById(postid);
          }

          // Get the original post.
          return Models.Post.findByPostAndBranchIds(postid, branchid);
        })
        .then(oneOrManyInstances => {
          let post;

          if (Array.isArray(oneOrManyInstances)) {
            if (!oneOrManyInstances.length) {
              return Promise.reject({
                message: 'Post does not exist.',
                status: 404,
              });
            }

            post = oneOrManyInstances[0];
          }
          else {
            post = oneOrManyInstances;
          }

          if (post === null) {
            return Promise.reject({
              message: 'Post does not exist.',
              status: 404,
            });
          }

          if (isChangingType) {
            return Models.Post.update({
              where: {
                branchid: post.get('branchid'),
                id: post.get('id'),
              },
            }, {
              type,
            });
          }

          post.set('nsfw', true);
          return post.update();
        })
        // Update post data type so it stays in sync.
        .then(() => {
          if (isChangingType) {
            postData.set('type', type);
            return postData.update();
          }
          return Promise.resolve();
        })
        // Now delete the flags.
        .then(() => Models.FlaggedPost.destroy({
          branchid,
          id: postid,
        }))
        // Notify the OP about the action.
        .then(() => {
          const data = {
            branchid,
            postid,
            username,
          };
          const type = isChangingType ? NotificationTypes.POST_TYPE_CHANGED : NotificationTypes.POST_MARKED_NSFW;
          const user = postData.get('creator');

          if (isChangingType) {
            data.type = type;
          }

          return Models.Notification.create({
            data,
            date,
            id: createNotificationId(user, date),
            type,
            unread: true,
            user,
          });
        })
        .then(() => success.OK(res))
        .catch(err => {
          console.error('Error resolving flag:', err);
          return error.code(res, err.status, err.message);
        });
    }

    case PostFlagResponseDeletePost: {
      let branch;
      let post;
      let postData;

      let pointsToSubtract = 0;
      let commentsToSubtract = 0;

      // Get the original post.
      return Models.PostData.findById(postid)
        // Update the branch stats. Grab the deleted posts comments and global points.
        // Subtract those values from the branch totals for the branch where this post
        // belonged to. Also decrease the branch post totals by one. We are applying
        // this diff only to a single branch. If this post resides in any child branches,
        // we do not interact with those or modify the post's instances in those branches.
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'Post does not exist.',
              status: 404,
            });
          }

          postData = instance;
          return Models.Post.findByPostAndBranchIds(postid, branchid);
        })
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'Post does not exist.',
              status: 404,
            });
          }

          post = instance;
          pointsToSubtract = post.get('global');
          commentsToSubtract = post.get('comment_count');
          return Models.Branch.findById(branchid);
        })
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'Branch does not exist.',
              status: 404,
            });
          }

          branch = instance;
          branch.set('post_comments', branch.get('post_comments') - commentsToSubtract);
          branch.set('post_count', branch.get('post_count') - 1);
          branch.set('post_points', branch.get('post_points') - pointsToSubtract);
          return branch.update();
        })
        // todo
        .then(() => algolia.updateObjects(branch.dataValues, 'branch'))
        // Delete flag for this post on this branch.
        .then(() => Models.FlaggedPost.destroy({
          branchid,
          id: postid,
        }))
        // Delete actual post from this branch.
        .then(() => post.destroy())
        // Notify the OP that their post was removed.
        .then(() => {
          const user = postData.get('creator');
          return Models.Notification.create({
            data: {
              branchid,
              message,
              postid,
              reason,
              username,
            },
            date,
            id: createNotificationId(user, date),
            type: NotificationTypes.POST_REMOVED,
            unread: true,
            user,
          });
        })
        .then(() => {
          // Notify global mods of posts removed if they breached site rules.
          if (reason === PostFlagPostViolatesSiteRules) {
            return Models.Mod.findByBranch('root')
              .then(mods => {
                let promises = [];

                for (let i = 0; i < mods.length; i += 1) {
                  const user = mods[i].get('username');
                  const promise = Models.Notification.create({
                    data: {
                      branchid,
                      message,
                      postid,
                      reason,
                      username,
                    },
                    date,
                    id: createNotificationId(user, date),
                    type: NotificationTypes.POST_REMOVED,
                    unread: true,
                    user,
                  });

                  promises = [
                    ...promises,
                    promise,
                  ];
                }

                return Promise.all(promises);
              })
              .catch(err => Promise.reject(err));
          }

          return Promise.resolve();
        })
        .then(() => success.OK(res))
        .catch(err => {
          console.error('Error resolving flag:', err);
          return error.InternalServerError(res);
        });
    }

    default:
      return error.BadRequest(res, 'Invalid action parameter');
  }
};

module.exports.get = (req, res) => {
  const {
    flag,
    lastPostId,
    postType,
    sortBy,
    stat,
    timeafter,
  } = req.query;
  const getFlaggedPosts = flag === 'true';
  const opts = {
    fetchOnlyflaggedPosts: getFlaggedPosts,
    nsfw: userCanDisplayNSFWPosts(req),
    postType: postType  || 'all',
    sortBy: sortBy || (getFlaggedPosts ? 'date' : 'points'),
    // individual/local/global stats [if normal posts]
    stat: stat || 'individual',
    timeafter: timeafter || 0,
  };
  const validSortByValues = getFlaggedPosts ? VALID_SORT_BY_MOD_VALUES : VALID_SORT_BY_USER_VALUES;
  const { branchid } = req.params;
  let lastInstance = null;
  let posts = [];

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid parameter');
  }
  
  if (!VALID_POST_TYPE_VALUES.includes(opts.postType)) {
    return error.BadRequest(res, 'Invalid postType parameter');
  }

  if (!validSortByValues.includes(opts.sortBy)) {
    return error.BadRequest(res, 'Invalid sortBy parameter');
  }
  
  return new Promise((resolve, reject) => {
    // Client wants only results that appear after this post (pagination).
    if (lastPostId) {
      return Models.Post.findByPostAndBranchIds(lastPostId, branchid)
        // fetch post data
        .then(instance => {
          if (instance === null) {
            return Promise.reject();
          }

          lastInstance = instance;
          return Models.PostData.findById(lastPostId);
        })
        .then(instance => {
          if (instance === null) {
            return Promise.reject();
          }

          Object.keys(instance.dataValues).forEach(key => lastInstance.set(key, instance.get(key)));
          return resolve();
        })
        .catch(err => {
          if (err) {
            return reject(err);
          }

          return reject({ code: 404 });
        });
    }
    
    // No last post specified, continue...
    return resolve();
  })
    // Check if the user has permissions to fetch the requested posts.
    .then(() => new Promise((resolve, reject) => {
      if (getFlaggedPosts) {
        if (!req.user) {
          return reject({ code: 403 });
        }

        // User must be a mod.
        return ACL.allow(ACL.Roles.Moderator, branchid)(req, res, resolve);
      }
      
      return resolve();
    }))
    // Get the posts - metadata, votes, etc.
    .then(() => {
      const model = opts.fetchOnlyflaggedPosts ? Models.FlaggedPost : Models.Post;
      return model.findByBranch(branchid, opts.timeafter, opts.nsfw, opts.sortBy, opts.stat, opts.postType, lastInstance);
    })
    // Get posts.
    .then(instances => {
      posts = instances;

      let promises = [];

      posts.forEach((instance, index) => {
        const promise = PostCtrl
          .getOnePost(instance.get('id'), req, branchid)
          .then(instance => {
            // Set manually so we don't overwrite the flagged post properties.
            const post = posts[index];
            // todo have instance method for this
            Object.keys(instance.dataValues).forEach(key => post.set(key, instance.get(key)));
            return Promise.resolve();
          })
          .catch(err => Promise.reject(err));

        promises = [
          ...promises,
          promise,
        ];
      });

      return Promise.all(promises);
    })
    .then(() => {
      let results = [];
      posts.forEach(instance => {
        results = [
          ...results,
          Object.assign({}, instance.dataValues),
        ];
      });
      return success.OK(res, results);
    })
    .catch(err => {
      console.error('Error fetching posts:', err);

      if (typeof err === 'object' && err.code) {
        return error.code(res, err.code, err.message);
      }

      return error.InternalServerError(res);
    });
};

module.exports.getPost = (req, res) => {
  const {
    branchid,
    postid,
  } = req.params;

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  return Models.Post.findByPostAndBranchIds(postid, branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject();
      }

      return success.OK(res, instance.dataValues);
    })
    .catch(err => {
      console.error('Error fetching post on branch:', err);

      if (err) {
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.put = (req, res) => {
  const {
    branchid,
    postid,
  } = req.params;
  const { vote } = req.body;
  const itemid = createUserVoteItemId(postid, 'post');
  const username = req.user.get('username');
  let branchIds = [];
  let resData = { delta: 0 };
  let voteInstance;

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  if (!VoteDirections.includes(vote)) {
    return error.BadRequest(res, 'Invalid vote.');
  }

  return Models.UserVote.findByUsernameAndItemId(username, itemid)
    // If the vote already exists, we can update it.
    .then(instance => {
      if (instance !== null) {
        voteInstance = instance;
      }

      return Models.Post.findById(postid);
    })
    // Update the post 'up' attribute.
    // Vote stats will be auto-updated by a lambda function.
    .then(posts => {
      // find all post entries to get the list of branches it is tagged to
      let promise;

      for (let i = 0; i < posts.length; i += 1) {
        const postBranchId = posts[i].get('branchid');
        branchIds = [
          ...branchIds,
          postBranchId,
        ];

        // Find the post on the specified branch and
        // undo the existing vote or add to the total.
        if (postBranchId === branchid) {
          const instance = posts[i];
          // If the vote instance exists, the user has voted.
          resData.delta = voteInstance ? -1 : 1;
          instance.set(vote, instance.get(vote) + resData.delta);
          promise = instance.update();
        }
      }

      if (!promise) {
        return Promise.reject({
          code: 400,
          message: 'Invalid branchid.',
        });
      }

      return promise;
    })
    // Update the post points count on each branch object the post appears in.
    .then(() => {
      let promises = [];        

      for (let i = 0; i < branchIds.length; i += 1) {
        const promise = Models.Branch.findById(branchIds[i])
          .then(instance => {
            if (instance === null) {
              return Promise.reject({
                message: 'Branch does not exist.',
                status: 404,
              });
            }

            instance.set('post_points', instance.get('post_points') + resData.delta);

            // todo
            algolia.updateObjects(instance.dataValues, 'branch');
            return instance.update();
          })
          .catch(err => Promise.reject(err));

        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Create or delete the vote record in the database.
    .then(() => {
      if (voteInstance) {
        return voteInstance.destroy();
      }

      return Models.UserVote.create({
        direction: vote,
        itemid,
        username,
      });
    })
    .then(() => success.OK(res, resData))
    .catch(err => {
      if (err) {
        console.error('Error voting on a post:', err);

        if (typeof err === 'object' && err.code) {
          return error.code(res, err.code, err.message);
        }

        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};
