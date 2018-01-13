const reqlib = require('app-root-path').require;

const algolia = reqlib('config/algolia');
const ACL = reqlib('config/acl');
const Constants = reqlib('config/constants');
const Models = reqlib('models/');
const NotificationTypes = reqlib('config/notification-types');
const PostCtrl = reqlib('routers/post/controller');

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

module.exports.resolveFlag = (req, res, next) => {
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
    req.error = {
      message: 'Invalid branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!postid) {
    req.error = {
      message: 'Invalid postid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!PostFlagResponseTypes.includes(action)) {
    req.error = {
      message: 'Invalid action parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (action === PostFlagResponseChangePostType && !type) {
    req.error = {
      message: 'Missing type parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (action === PostFlagResponseDeletePost && !reason) {
    req.error = {
      message: 'Missing reason parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  switch (action) {
    // Delete flag for this post on this branch.
    case PostFlagResponseKeepPost: {
      return Models.FlaggedPost.destroy({
        branchid,
        id: postid,
      })
        .then(() => next())
        .catch(err => {
          if (err) {
            console.error('Error fetching post on branch:', err);
            req.error = {
              message: err,
            };
            return next(JSON.stringify(req.error));
          }

          req.error = {
            status: 404,
          };
          return next(JSON.stringify(req.error));
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
        .then(() => next())
        .catch(err => {
          console.error('Error resolving flag:', err);
          req.error = err;
          return next(JSON.stringify(req.error));
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
        .then(() => next())
        .catch(err => {
          console.error('Error resolving flag:', err);
          req.error = {
            message: err,
          };
          return next(JSON.stringify(req.error));
        });
    }

    default:
      req.error = {
        message: 'Invalid action parameter.',
        status: 400,
      };
      return next(JSON.stringify(req.error));
  }
};

module.exports.get = (req, res, next) => {
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
    req.error = {
      message: 'Missing branchid parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }
  
  if (!VALID_POST_TYPE_VALUES.includes(opts.postType)) {
    req.error = {
      message: 'Invalid postType parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!validSortByValues.includes(opts.sortBy)) {
    req.error = {
      message: 'Invalid sortBy parameter.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
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

          return reject({ status: 404 });
        });
    }
    
    // No last post specified, continue...
    return resolve();
  })
    // Check if the user has permissions to fetch the requested posts.
    .then(() => new Promise((resolve, reject) => {
      if (getFlaggedPosts) {
        if (!req.user) {
          return reject({ status: 403 });
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

      res.locals.data = results;
      return next();
    })
    .catch(err => {
      console.error('Error fetching posts:', err);

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

module.exports.getPost = (req, res, next) => {
  const {
    branchid,
    postid,
  } = req.params;

  if (!branchid) {
    req.error = {
      message: 'Missing branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!postid) {
    req.error = {
      message: 'Missing postid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  return Models.Post.findByPostAndBranchIds(postid, branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject();
      }

      // todo
      res.locals.data = instance.dataValues;
      return next();
    })
    .catch(err => {
      console.error('Error fetching post on branch:', err);

      if (err) {
        req.error = {
          message: err,
        };
        return next(JSON.stringify(req.error));
      }

      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.put = (req, res, next) => {
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
    req.error = {
      message: 'Invalid branchid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!postid) {
    req.error = {
      message: 'Invalid postid.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
  }

  if (!VoteDirections.includes(vote)) {
    req.error = {
      message: 'Invalid vote.',
      status: 400,
    };
    return next(JSON.stringify(req.error));
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
          status: 400,
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
    .then(() => {
      res.locals.data = resData;
      return next();
    })
    .catch(err => {
      if (err) {
        console.error('Error voting on a post:', err);

        if (typeof err === 'object' && err.status) {
          req.error = err;
          return next(JSON.stringify(req.error));
        }

        
        req.error = {
          message: err,
        };
        return next(JSON.stringify(req.error));
      }

      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};
