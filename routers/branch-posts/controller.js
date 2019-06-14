const reqlib = require('app-root-path').require
const { List } = require('immutable')

const ACL = reqlib('config/acl')
const Constants = reqlib('config/constants')
const Models = reqlib('models/')
const NotificationTypes = reqlib('config/notification-types')
const PostCtrl = reqlib('routers/post/controller')

const {
  PostFlagPostViolatesSiteRules,
  PostFlagResponseChangePostType,
  PostFlagResponseDeletePost,
  PostFlagResponseKeepPost,
  PostFlagResponseMarkPostNSFW,
} = Constants

const {
  PostFlagTypes,
  PostFlagResponseTypes,
  PostTypes,
  VoteDirections,
} = Constants.AllowedValues

const { createNotificationId, createUserVoteItemId } = Constants.Helpers

const VALID_POST_TYPE_VALUES = ['all', ...PostTypes]
const VALID_SORT_BY_MOD_VALUES = ['date', ...PostFlagTypes]
const VALID_SORT_BY_USER_VALUES = ['comments', 'date', 'points']

// Authenticated users can choose to see nsfw posts.
const userCanDisplayNSFWPosts = req => req.user ? !!req.user.get('show_nsfw') : false

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
          const typeNotif = isChangingType ? NotificationTypes.POST_TYPE_CHANGED : NotificationTypes.POST_MARKED_NSFW;
          const user = postData.get('creator');

          if (isChangingType) {
            data.type = type;
          }

          return Models.Notification.create({
            data,
            date,
            id: createNotificationId(user, date),
            type: typeNotif,
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
    query,
    lastFiltered,
  } = req.query;


  //set queryIsOk
  var queryIsOk = query != null && query.length > 0;
  var lastfilteredobj = null;


  const getFlaggedPosts = flag === 'true';
  const opts = {
    fetchOnlyflaggedPosts: getFlaggedPosts,
    nsfw: userCanDisplayNSFWPosts(req),
    postType: postType || 'all',
    sortBy: sortBy || (getFlaggedPosts ? 'date' : 'points'),
    // individual/local/global stats [if normal posts]
    stat: stat || 'individual',
    timeafter: timeafter || 0,
  };
  const validSortByValues = getFlaggedPosts ? VALID_SORT_BY_MOD_VALUES : VALID_SORT_BY_USER_VALUES;
  const { branchid } = req.params;
  let lastInstance = null;
  let posts = [];
  //this will be passed back with the response to mark the last post that was gotten by the query
  //(if searching)
  let lastPostToPass = {};

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

  let searchedForPosts = [];
  //idea for searching
  //find posts using the query (scan for now replace give title sort or partition new CSGI)
  //then for each of those posts get them ordered and filtered
  //then add the additional data


  //initial search finds too many posts and has to pagnate, passes found posts to filters, filters remove all and you don't get all possible results
  //fix: after applying filter do a check if the err case is the case, redo the search starting from the lasteval index until lasteval indexes converge send that [] found //not implemented
  //problem: filter might return 0 because of dynamodb scan and end preemptively (same for search)
  //fix: check if lasteval exists if it does there's more to search //not implemented
  //TODO merge two fixes
  //TODO make same thing for flag posts
  //TODO remove tags from query


  //problem: results from the searched ones are grabbed by the filters and the posts that are good are taken
  //there may be more results from the search than the filter can handle
  //fix: what you wanna do is start evaluating filter starting from it's last one but with the same search keys
  //idea to merge fixes: newPosts are 0 but lastfilterid and/or searchid are set

  //problem: when searching sort by applied to posts in segments that are downloaded and not through all segments
  //fix: None

  return new Promise((resolve, reject) => {
    // Client wants only results that appear after this post (pagination).
    //if searching don't bother looking up old post (as you only need the id and you already have it)
    //set last posts id to the passed id
    if (lastPostId && !!query) {

      lastInstance = { id: lastPostId };
      return resolve();

    }
    else if (lastPostId) {
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
  }).then(() => {
    if (lastFiltered) {
      return Models.Post.findByPostAndBranchIds(lastFiltered, branchid)
        // fetch post data
        .then(instance => {
          if (instance === null) {
            return;
          }

          lastfilteredobj = instance;
          return Models.PostData.findById(lastFiltered);
        })
        .then(instance => {
          if (instance === null) {
            return;
          }

          Object.keys(instance.dataValues).forEach(key => lastfilteredobj.set(key, instance.get(key)));
          return;
        })
        .catch(err => {
          if (err) {
            return err;
          }
        });

    }
    // No last filtered post specified, continue...
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
    //either search by query and then filter or just filter
    .then(() => {
      if (queryIsOk) {
        return Models.PostData.findPostLooselyByTitle(query, lastInstance);
      }
      else {
        const model = opts.fetchOnlyflaggedPosts ? Models.FlaggedPost : Models.Post;
        return model.findByBranch(branchid, opts.timeafter, opts.nsfw, opts.sortBy, opts.stat, opts.postType, lastInstance);
      }
    })
    .then(instances => {

      //if instances > 0 get the last instance and set it to lastPostToPass
      lastPostToPass = instances.length > 0 ? instances[instances.length - 1] : null;

      if (queryIsOk) {
        searchedForPosts = instances;
        //filter them and return the filtered ones
        //return Models.Post.batchGetItems(branchid, instances, opts.timeafter, opts.nsfw, opts.sortBy, opts.stat, opts.postType);
        //TODO do the same for flagged posts
        if (lastFiltered)
          return Models.Post.ScanForPosts(branchid, instances, opts.timeafter, opts.nsfw, opts.sortBy, opts.stat, opts.postType, lastfilteredobj);
        else
          return Models.Post.ScanForPosts(branchid, instances, opts.timeafter, opts.nsfw, opts.sortBy, opts.stat, opts.postType);

      }
      else {
        return instances;
      }
    })
    // Get posts.
    .then(instances => {
      posts = instances;
      let promises = [];
      //check again and don't send last post if results after filter are 0
      //can do a check over here if filter destroyed all the queryied by title posts
      if (queryIsOk) {

        lastPostToPass = instances.length > 0 ? lastPostToPass : null;
        //TODO change this to use the set constant limit.posts
        if (lastPostToPass && instances.length == 30) {
          //if the filtered posts list has reached it's max len go through again with the same search keys
          //set start to get old keys
          lastPostToPass = searchedForPosts[0];
          //set filter to start from
          lastPostToPass.dataValues.lastfilterid = instances[instances.length - 1].get('id');
          //have to attach lastFiltered if you want to pagnete the filter

        }
        //if (instances.length==0 && searchedForPosts.length!=0){}
      }

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
          .catch(err => console.log(err));

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
      //add last to pasw
      if (lastPostToPass)
        results = [...results, lastPostToPass.dataValues];
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

module.exports.postVote = async (req, res, next) => {
  try {
    const { branchid, postid } = req.params
    if (!branchid) throw {
      message: 'Invalid branchid.',
      status: 400,
    }

    if (!postid) throw {
      message: 'Invalid postid.',
      status: 400,
    }

    const { vote } = req.body
    if (!VoteDirections.includes(vote)) throw {
      message: 'Invalid vote.',
      status: 400,
    }

    const itemid = createUserVoteItemId(postid, 'post')
    const username = req.user.get('username')
    const voteInstance = await Models.UserVote.findByUsernameAndItemId(username, itemid)
    // Find all post entries to get the list of branches it is tagged to.
    const posts = await Models.Post.findById(postid)
    const resData = { delta: 0 }

    // Update the post 'up' attribute.
    // Vote stats will be auto-updated by a lambda function.
    let branchIds = new List()
    let promise
    for (let i = 0; i < posts.length; i += 1) {
      const post = posts[i]
      const postBranchId = post.get('branchid')
      branchIds = branchIds.push(postBranchId)
      // Find the post on the specified branch and undo the existing vote or
      // add to the total. If a vote instance exists, the user has voted.
      if (postBranchId === branchid) {
        resData.delta = voteInstance ? -1 : 1
        post.set(vote, post.get(vote) + resData.delta)
        promise = () => post.update()
      }
    }

    if (!promise) throw {
      message: 'Invalid branchid.',
      status: 400,
    }
    else {
      await promise()
    }

    // Update the post points count on each branch object the post appears in.
    let promises = new List()
    branchIds.forEach(postBranchId => {
      const promise = async () => {
        const branch = await Models.Branch.findById(postBranchId)
        if (branch) {
          branch.set('post_points', branch.get('post_points') + resData.delta)
          await branch.update()
        }
      }
      promises = promises.push(promise())
    })
    await Promise.all(promises.toArray())

    // Create or delete the vote record in the database.
    if (voteInstance) {
      await voteInstance.destroy()
    }
    else {
      await Models.UserVote.create({ direction: vote, itemid, username })
    }

    res.locals.data = resData
    next()
  }
  catch (e) {
    const error = typeof e === 'object' && e.status ? e : { status: 404 }
    req.error = error
    next(JSON.stringify(req.error))
  }
}
