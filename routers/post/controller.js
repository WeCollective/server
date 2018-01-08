const htmlparser = require('htmlparser');
const reqlib = require('app-root-path').require;
const request = require('request');

const algolia = reqlib('config/algolia');
const Constants = reqlib('config/constants');
const error = reqlib('responses/errors');
const fs = reqlib('config/filestorage');
const mailer = reqlib('config/mailer');
const Models = reqlib('models/');
const NotificationTypes = reqlib('config/notification-types');
const success = reqlib('responses/successes');

const {
  createCommentId,
  createNotificationId,
  createPostId,
  createPostImageId,
  createUserVoteItemId,
} = Constants.Helpers;

const {
  PostFlagTypes,
  VoteDirections,
} = Constants.AllowedValues;

const { postTitle } = Constants.EntityLimits;

const ensureHost = (url, host) => {
  const protocol = 'https';

  if (!url.includes('http') && !url.includes('ftp') && url.indexOf('//') !== 0) {
    if (!url.includes(host)) {
      url = `${protocol}://${host}${url}`;
    }
    else {
      url = `${protocol}://${url}`;
    }
  }

  return url;
};

const shouldAddImage = attrs => {
  const {
    height,
    width,
  } = attrs;

  const h = Number.parseInt(height, 10);
  const w = Number.parseInt(width, 10);

  if (!Number.isNaN(h) || !Number.isNaN(w)) {
    // Skip tracking pixels.
    if (h <= 1 || w <= 1) {
      return false;
    }
  }

  return true;
};

const searchImages = node => {
  const {
    children,
    name,
    type,
  } = node;

  let resultsArr = [];
  let { attribs } = node;

  attribs = attribs || {};

  if (type === 'tag') {
    const {
      itemprop,
      name: aName,
      property,
    } = attribs;

    if (name === 'meta') {
      const metaTagsArr = [
        'twitter:image',
        'og:image',
      ];

      if (itemprop === 'image' && shouldAddImage(attribs)) {
        resultsArr = [
          ...resultsArr,
          {
            src: attribs.content,
            weight: 1,
          },
        ];
      }

      if ((metaTagsArr.includes(property) ||
        metaTagsArr.includes(aName)) && shouldAddImage(attribs)) {
        resultsArr = [
          ...resultsArr,
          {
            src: attribs.content,
            weight: 3,
          },
        ];
      }
    }

    if (name === 'img' && shouldAddImage(attribs)) {
      resultsArr = [
        ...resultsArr,
        {
          src: attribs.src,
          weight: 2,
        },
      ];
    }
  }

  if (children) {
    for (let i = 0; i < children.length; i += 1) {
      resultsArr = [
        ...resultsArr,
        ...searchImages(children[i]),
      ];
    }
  }

  return resultsArr;
};

module.exports.delete = (req, res) => {
  const { postid } = req.params;
  const username = req.user.get('username');
  let branchesToUpdate = [];
  let postComments = null;
  let postGlobalPoints = null;

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  return Models.PostData.findById(postid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 404,
        });
      }

      if (instance.get('creator') !== username) {
        return Promise.reject({
          message: 'You can delete only your own posts.',
          status: 403,
        });
      }

      // Delete all post entries on all branches where it was included.
      // NB: Do not remove post data and post images for now - may want to reinstate posts.
      return Models.Post.findById(postid);
    })
    .then(posts => {
      let promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        const branchid = post.get('branchid');

        branchesToUpdate = [
          ...branchesToUpdate,
          branchid,
        ];

        if (postComments === null) postComments = post.get('comment_count');
        if (postGlobalPoints === null) postGlobalPoints = post.get('global');

        const promise = post.destroy();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Delete all flagged post instances.
    .then(() => Models.FlaggedPost.findById(postid))
    .then(posts => {
      let promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const promise = posts[i].destroy();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Update branch stats.
    .then(() => {
      let promises = [];

      for (let i = 0; i < branchesToUpdate.length; i += 1) {
        const promise = Models.Branch.findById(branchesToUpdate[i]);
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    .then(branches => {
      let promises = [];

      for (let i = 0; i < branches.length; i += 1) {
        const branch = branches[i];
        branch.set('post_count', branch.get('post_count') - 1);
        branch.set('post_comments', branch.get('post_comments') - postComments);
        branch.set('post_points', branch.get('post_points') - postGlobalPoints);

        const promise = branch.update()
          // todo
          .then(() => algolia.updateObjects(branch.dataValues, 'branch'))
          .catch(err => Promise.reject(err));

        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    .then(() => success.OK(res))
    .catch(err => {
      console.error('Error deleting post: ', err);
      return error.InternalServerError(res, err);
    });
};

module.exports.deleteComment = (req, res) => {
  const {
    commentid,
    postid,
  } = req.params;
  const username = req.user.get('username');
  let comment;

  if (!commentid) {
    return error.BadRequest(res, 'Invalid commentid.');
  }

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  return module.exports.getOneComment(commentid, req)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      comment = instance;

      if (comment.get('data').creator !== username) {
        return Promise.reject({
          message: 'You can delete only your own comments.',
          status: 403,
        });
      }

      if (!comment.get('replies')) {
        return Models.CommentData.destroy({ id: comment.get('id') });
      }

      // Removing the comment would cut off the replies, we don't want that.
      return Models.CommentData.update({
        where: {
          id: comment.get('id'),
        },
      }, {
        deleted: true,
      });
    })
    // Update counters.
    // Decrease total user comments.
    .then(() => {
      req.user.set('num_comments', req.user.get('num_comments') - 1);
      return req.user.update();
    })
    // Find all post entries where the comment appears and decrease their comment count.
    .then(() => Models.Post.findById(postid))
    .then(posts => {
      let promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        post.set('comment_count', post.get('comment_count') - 1);
        const promise = post.update();

        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    .then(() => {
      if (comment.get('parentid') === 'none') {
        return Promise.resolve();
      }

      return Models.Comment.findById(comment.get('parentid'));
    })
    // Decrease the parent comment replies counter if a parent comment exists.
    .then(instance => {
      if (!instance) {
        return Promise.resolve();
      }

      instance.set('replies', instance.get('replies') - 1);
      return instance.update();
    })
    .then(() => {
      if (!comment.get('replies')) {
        return comment.destroy();
      }
      return Promise.resolve();
    })
    // Find all post entries to get the list of branches it is tagged to.
    .then(() => Models.Post.findById(postid))
    // Decrease post comments totals for each branch.
    .then(posts => {
      let promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const promise = Models.Branch.findById(posts[i].get('branchid'))
          .then(instance => {
            if (instance === null) {
              return Promise.reject({
                message: 'Branch does not exist.',
                status: 404,
              });
            }

            instance.set('post_comments', instance.get('post_comments') - 1);
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
    .then(() => success.OK(res))
    .catch(err => {
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res, err);
    });
};

module.exports.editComment = (req, res) => {
  const {
    commentid,
    postid,
  } = req.params;
  const username = req.user.get('username');
  const { text } = req.body;
  // const comment = new Comment();
  // const commentData = new CommentData();

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  if (!commentid) {
    return error.BadRequest(res, 'Invalid commentid.');
  }

  if (!text) {
    return error.BadRequest(res, 'Invalid text.');
  }

  // Check if the comment belongs to this post.
  return Models.Comment.findById(commentid)
    .then(instance => {
      if (instance === null || instance.get('postid') !== postid) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      return Models.CommentData.findById(commentid);
    })
    // Check if user is the author fo the comment.
    // Otherwise, they cannot edit it.
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      if (instance.get('creator') !== username) {
        return Promise.reject({
          message: 'You can edit only your own comments.',
          status: 403,
        });
      }

      instance.set('edited', true);
      instance.set('text', text);
      return instance.update();
    })
    .then(() => success.OK(res))
    .catch(err => {
      console.error('Error editing comment:', err);
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }
      return error.InternalServerError(res, err);
    });
};

module.exports.flagPost = (req, res) => {
  const {
    branchid,
    flag_type,
  } = req.body;
  const { postid } = req.params;
  const date = new Date().getTime();
  const username = req.user.get('username');
  let flag;

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  if (!PostFlagTypes.includes(flag_type)) {
    return error.BadRequest(res, 'Invalid flag_type');
  }

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  // This post might have been flagged already.
  return Models.FlaggedPost.findByPostAndBranchIds(postid, branchid)
    .then(instance => {
      // Oh, seems like no one flagged it yet, we are the first. Let's
      // grab the post data then so we can create a flag.
      if (instance === null) {
        return Models.Post.findByPostAndBranchIds(postid, branchid);
      }

      // Yes, flag exists, update our instance.
      flag = instance;
      return Promise.resolve([]);
    })
    .then(instance => {
      const count = `${flag_type}_count`;

      // We grabbed the post on our way to create the flag, so let's draw
      // the first blood now.
      if (instance) {
        const data = {
          branch_rules_count: 0,
          branchid: instance.get('branchid'),
          date,
          id: instance.get('id'),
          nsfw_count: 0,
          site_rules_count: 0,
          type: instance.get('type'),
          wrong_type_count: 0,
        };
        data[count] = 1;
        return Models.FlaggedPost.create(data);
      }

      // The post has been already flagged, update only the respective key.
      if (flag) {
        flag.set(count, flag.get(count) + 1);
        return flag.update();
      }

      // No flag and no post found? Something is fishy!
      return Promise.reject({
        message: 'The post does not exist.',
        status: 404,
      });
    })
    // Let's gather the branch mods to let them know something is up on their watch.
    .then(() => Models.Mod.findByBranch(branchid))
    .then(mods => {
      let promises = [];

      for (let i = 0; i < mods.length; i += 1) {
        const modUsername = mods[i].get('username');
        const promise = Models.Notification.create({
          data: {
            branchid,
            postid,
            reason: flag_type,
            username,
          },
          date,
          id: createNotificationId(modUsername, date),
          type: NotificationTypes.POST_FLAGGED,
          unread: true,
          user: username,
        });

        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    .then(() => success.OK(res))
    .catch(err => {
      if (err) {
        console.error('Error flagging post:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.get = (req, res) => {
  const { postid } = req.params;
  const { branchid } = req.query;

  if (!postid) {
    return error.BadRequest(res, 'Missing postid.');
  }

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid.');
  }

  return Models.Post.findByPostAndBranchIds(postid, branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 404,
        });
      }

      // Returns richer response, we should probably merge those somehow
      // to save time.
      return module.exports.getOnePost(postid, req);
    })
    .then(instance => success.OK(res, {
      branchid: instance.get('branchid'),
      comment_count: instance.get('comment_count'),
      date: instance.get('date'),
      global: instance.get('global'),
      id: instance.get('id'),
      individual: instance.get('individual'),
      local: instance.get('local'),
      locked: instance.get('locked'),
      nsfw: instance.get('nsfw'),
      type: instance.get('type'),
      up: instance.get('up'),
      creator: instance.get('creator'),
      original_branches: instance.get('original_branches'),
      text: instance.get('text'),
      title: instance.get('title'),
      profileUrl: instance.get('profileUrl'),
      profileUrlThumb: instance.get('profileUrlThumb'),
    }))
    .catch(err => {
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res);
    });
};

module.exports.getComment = (req, res) => {
  const {
    commentid,
    postid,
  } = req.params;
  let comments;
  let parent;

  if (!postid) {
    return error.BadRequest(res, 'Missing postid');
  }

  if (!commentid) {
    return error.BadRequest(res, 'Missing commentid');
  }

  return module.exports.getOneComment(commentid, req)
    .then(comment => {
      if (comment === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      parent = comment;

      return Models.Comment.findByParent(postid, parent.get('id'), 'points', null);
    })
    .then(instances => {
      comments = instances;
      let promises = [];

      comments.forEach(instance => {
        const promise = module.exports.getOneComment(instance.get('id'), req)
          .then(comment => {
            // todo
            Object.keys(comment.dataValues).forEach(key => instance.set(key, comment.get(key)));
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
      // todo
      const data = parent.dataValues;
      const arr = comments.map(instance => instance.dataValues);
      data.comments = arr;
      return success.OK(res, data);
    })
    .catch(err => {
      console.error('Error fetching comments:', err);
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res);
    });
};

module.exports.getComments = (req, res) => {
  const {
    lastCommentId,
    // Get root comments by default.
    parentid: parentId = 'none',
    // Order comments by points by default.
    sort: sortBy = 'points',
  } = req.query;
  const { postid: postId } = req.params;
  let comments = [];
  let lastInstance = null;

  if (!postId) {
    return error.BadRequest(res, 'Missing postid');
  }

  return new Promise((resolve, reject) => {
    // Client wants only results that appear after this comment (pagination).
    if (lastCommentId) {
      return Models.Comment.findById(lastCommentId)
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'Comment does not exist.',
              status: 404,
            });
          }

          lastInstance = instance;
          return resolve();
        })
        .catch(err => reject(err));
    }

    // No last comment specified, continue...
    return resolve();
  })
    .then(() => Models.Comment.findByParent(postId, parentId, sortBy, lastInstance))
    .then(instances => {
      comments = instances;
      let promises = [];

      comments.forEach(instance => {
        const promise = module.exports.getOneComment(instance.get('id'), req)
          .then(comment => {
            // todo
            Object.keys(comment.dataValues).forEach(key => instance.set(key, comment.get(key)));
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
      // todo
      const arr = comments.map(instance => instance.dataValues);
      return success.OK(res, { comments: arr });
    })
    .catch(err => {
      console.error('Error fetching comments:', err);
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res);
    });
};

// todo Check the specfied comment actually belongs to this post.
module.exports.getOneComment = (id, req) => {
  const username = req && req.user ? req.user.get('username') : false;
  let comment;

  return Models.Comment.findById(id)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      comment = instance;
      return Models.CommentData.findById(id);
    })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      // todo
      const data = {};
      Object.keys(instance.dataValues).forEach(key => data[key] = instance.get(key));
      if (data.deleted) {
        delete data.text;
      }
      comment.set('data', data);
      return Promise.resolve();
    })
    // Extend the comment with information about user vote.
    .then(() => {
      if (username) {
        return Models.UserVote.findByUsernameAndItemId(username, `comment-${id}`)
          .then(instance => {
            if (instance !== null) {
              comment.set('userVoted', instance.get('direction'));
            }

            return Promise.resolve();
          })
          .catch(err => Promise.reject(err));
      }

      return Promise.resolve();
    })
    .then(() => Promise.resolve(comment))
    .catch(err => {
      console.error('Error fetching comment data:', err);
      return Promise.reject(err);
    });
};

module.exports.getOnePost = (id, req, branchid) => {
  let post;
  return Models.Post.findById(id)
    .then(instances => {
      if (!instances.length) {
        return Promise.reject({ status: 404 });
      }

      let idx = 0;

      for (let i = 0; i < instances.length; i++) {
        const postBranchId = instances[i].get('branchid');
        // We can request which instance of the post we want.
        // By default, the root instance will be returned.
        if ((branchid && postBranchId === branchid) ||
          (!branchid && postBranchId === 'root')) {
          idx = i;
          break;
        }
      }

      post = instances[idx];
      return Models.PostData.findById(id);
    })
    .then(instance => {
      post.set('creator', instance.get('creator'));
      post.set('id', instance.get('id'));
      post.set('original_branches', instance.get('original_branches'));
      post.set('text', instance.get('text'));
      post.set('title', instance.get('title'));
      return Promise.resolve();
    })
    // Attach post image url to the post.
    .then(() => {
      const p1 = module.exports.getPostPicture(id, false);
      const p2 = module.exports.getPostPicture(id, true);
      return Promise.all([p1, p2]);
    })
    .then(values => {
      post.set('profileUrl', values[0]);
      post.set('profileUrlThumb', values[1]);
      return Promise.resolve();
    })
    // Extend the posts with information about user vote.
    .then(() => {
      if (req && req.user) {
        const username = req.user.get('username');
        const postId = post.get('id');
        const userVoteItemId = createUserVoteItemId(postId, 'post');
        return Models.UserVote.findByUsernameAndItemId(username, userVoteItemId);
      }

      return Promise.resolve(null);
    })
    .then(instance => {
      if (instance !== null) {
        post.set('userVoted', instance.get('direction'));
      }

      return Promise.resolve(post);
    })
    .catch(err => {
      console.error('Error fetching post data:', err);
      return Promise.reject(err);
    });
};

module.exports.getPicture = (req, res, thumbnail) => {
  const { postid } = req.params;
  const size = thumbnail ? 200 : 640;

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  return Models.PostImage.findById(postid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 404,
        });
      }

      const ext = instance.get('extension');
      const id = instance.get('id');

      return new Promise((resolve, reject) => Models.Dynamite.aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.PostImagesResized,
        Key: `${id}-${size}.${ext}`,
      }, (err, url) => {
        if (err) {
          return reject(err);
        }
        return resolve(url);
      }));
    })
    .then(url => success.OK(res, url))
    .catch(err => {
      console.error('Error fetching post image:', err);
      return error.InternalServerError(res, err);
    });
};

module.exports.getPictureUploadUrl = (req, res) => {
  const { postid } = req.params;
  const username = req.user.get('username');

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  // ensure this user is the creator of the specified post
  return Models.PostData.findById(postid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 404,
        });
      }

      if (instance.get('creator') !== username) {
        // user did not create this post
        return Promise.reject({
          message: 'You are not the author of the post.',
          status: 403,
        });
      }

      const filename = `${postid}-picture-orig.jpg`;
      const params = {
        Bucket: fs.Bucket.PostImages,
        Key: filename,
        ContentType: 'image/*',
      };

      return new Promise((resolve, reject) => Models.Dynamite.aws.s3Client.getSignedUrl('putObject', params, (err, url) => {
        if (err) {
          return reject(err);
        }
        return resolve(url);
      }));
    })
    .then(url => success.OK(res, url))
    .catch(err => {
      console.error('Error fetching post data:', err);
      return error.InternalServerError(res, err);
    });
};

module.exports.getPictureUrlSuggestion = (req, res) => {
  const { url } = req.query;
  let result = '';

  if (!url) {
    return error.BadRequest(res, 'Missing url.');
  }

  const path = url.includes('http') ? url : `https://${url}`;

  if (path.length <= 'http://'.length) {
    return error.BadRequest(res, 'Invalid url.');
  }

  return new Promise((resolve, reject) => request(path, (err, res, body) => {
    if (err) {
      if (err.code === 'ENOTFOUND') {
        return resolve(result);
      }
      console.log(err);
      return reject(err);
    }

    const handler = new htmlparser.DefaultHandler((error, dom) => {
      let foundImagesArr = [];

      if (error) {
        console.log(error);
      }

      for (let i = 0; i < dom.length; i += 1) {
        foundImagesArr = [
          ...foundImagesArr,
          ...searchImages(dom[i]),
        ];
      }

      let highWeight = 0;
      foundImagesArr.forEach(img => {
        if (img.weight > highWeight) {
          result = ensureHost(img.src, res.request.originalHost);
          highWeight = img.weight;
        }
      });
    });

    const parser = new htmlparser.Parser(handler);
    parser.parseComplete(body);
    console.log(`Found suggested image at ${result}`);
    return resolve(result);
  }))
    .then(data => success.OK(res, data))
    .catch(err => error.InternalServerError(res, err));
};

module.exports.getPostPicture = (postid, thumbnail = false) => {
  const size = thumbnail ? 200 : 640;
  return Models.PostImage.findById(createPostImageId(postid))
    .then(instance => {
      if (instance === null) {
        return Promise.resolve('');
      }

      const extension = instance.get('extension');
      const id = instance.get('id');

      const Bucket = fs.Bucket.PostImagesResized;
      const Key = `${id}-${size}.${extension}`;
      return Promise.resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}`);
    })
    .catch(err => {
      console.error('Error fetching post image:', err);
      return Promise.reject(err);
    });
};

module.exports.post = (req, res) => {
  let {
    branchids,
    locked,
    nsfw,
  } = req.body;
  const {
    captcha,
    text,
    title,
    type,
  } = req.body;
  const username = req.user.get('username');
  const date = new Date().getTime();
  const id = createPostId(username, date);
  // fetch the tags of each specfied branch. The union of these is the list of
  // the branches the post should be tagged to.
  let branchidsArr = [];
  let searchIndexData = {};

  locked = !!locked;
  nsfw = !!nsfw;

  if (captcha !== '') {
    Models.Logger.record('HoneyPot', JSON.stringify({
      branchids,
      captcha,
      id,
      locked,
      nsfw,
      text,
      title,
      type,
    }))
      .catch(err => console.log(err));
    return error.Forbidden(res);
  }

  if (!title || title.length > postTitle) {
    return error.BadRequest(res, 'Invalid title.');
  }

  try {
    branchids = JSON.parse(branchids);
  }
  catch (err) {
    return error.BadRequest(res, 'Malformed branchids.');
  }

  if (!branchids) {
    return error.BadRequest(res, 'Invalid branchids.');
  }
  else if (!branchids.length) {
    branchids = [
      ...branchids,
      'root',
    ];
  }
  else if (branchids.length > 5) {
    return error.BadRequest(res, 'Max 5 tags allowed.');
  }

  let promises = [];

  for (let i = 0; i < branchids.length; i += 1) {
    const promise = Models.Tag.findByBranch(branchids[i])
      .then(tags => {
        // All tags are collected, these are the branchids to tag the post to.
        for (let j = 0; j < tags.length; j += 1) {
          const tag = tags[j].get('tag');
          if (!branchidsArr.includes(tag)) {
            branchidsArr = [
              ...branchidsArr,
              tag,
            ];
          }
        }

        return Promise.resolve();
      })
      .catch(err => Promise.reject(err));

    promises = [
      ...promises,
      promise,
    ];
  }

  return Promise.all(promises)
    // Validate the post data first, so this method doesn't fail halfway through.
    .then(() => {
      const data = {
        creator: username,
        id,
        original_branches: JSON.stringify(branchids),
        text,
        title,
        type,
      };

      searchIndexData = data;
      return Models.PostData.create(data);
    })
    // Now create the branch ids.
    .then(() => {
      let promises = [];

      for (let i = 0; i < branchidsArr.length; i += 1) {
        const branchid = branchidsArr[i];
        const promise = Models.Post.create({
          branchid,
          comment_count: 0,
          date,
          down: 0,
          global: 1,
          id,
          individual: branchid === 'root' ? 1 : 0,
          local: branchid === 'root' ? 1 : 0,
          locked,
          nsfw,
          type,
          up: branchid === 'root' ? 1 : 0,
        });

        searchIndexData.global = 0;

        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Add new post to the search index.
    .then(() => algolia.addObjects(searchIndexData, 'post'))
    // Increment the post counters on the branch objects
    .then(() => {
      let promises = [];

      for (let i = 0; i < branchidsArr.length; i += 1) {
        const promise = Models.Branch.findById(branchidsArr[i])
          .then(instance => {
            if (instance === null) {
              return Promise.reject({
                message: 'Branch does not exist.',
                status: 404,
              });
            }

            instance.set('post_count', instance.get('post_count') + 1);
            instance.set('post_points', instance.get('post_points') + 1);
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
    // Increment user's post count.
    .then(() => {
      req.user.set('num_posts', req.user.get('num_posts') + 1);
      return req.user.update();
    })
    // update the SendGrid contact list with the new user data
    // todo
    .then(() => mailer.addContact(req.user.dataValues, true))
    // Self-upvote the post.
    .then(() => Models.UserVote.create({
      direction: 'up',
      itemid: createUserVoteItemId(id, 'post'),
      username,
    }))
    .then(() => success.OK(res, id))
    .catch(err => {
      console.error('Error creating post:', err);

      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res);
    });
};

module.exports.postComment = (req, res) => {
  const {
    parentid,
    text,
  } = req.body;
  const { postid } = req.params;
  const date = new Date().getTime();
  const username = req.user.get('username');
  const id = createCommentId(username, date);
  let parent;
  let posts = [];

  if (!parentid) {
    return error.BadRequest(res, 'Invalid parentid.');
  }

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  // Post must exist.
  return Models.Post.findById(postid)
    .then(instances => {
      if (!instances.length || instances[0] === null) {
        return Promise.reject({
          message: 'Post does not exist.',
          status: 404,
        });
      }

      posts = instances;

      // if this is a root comment, continue
      if (parentid === 'none') {
        return Promise.resolve();
      }

      // otherwise, ensure the specified parent comment exists
      return Models.Comment.findById(parentid);
    })
    .then(instance => {
      if (parentid !== 'none') {
        if (instance === null) {
          return Promise.reject({
            message: 'Parent comment does not exist.',
            status: 400,
          });
        }

        parent = instance;

        // Parent comment must belong to this post.
        if (instance.get('postid') !== postid) {
          return Promise.reject({
            message: 'Parent comment does not belong to the same post.',
            status: 400,
          });
        }
      }

      return Models.CommentData.create({
        creator: username,
        date,
        edited: false,
        id,
        text,
      });
    })
    .then(() => Models.Comment.create({
      date,
      down: 0,
      id,
      individual: 1,
      parentid,
      postid,
      rank: 0,
      replies: 0,
      up: 1,
    }))
    .then(() => {
      if (parentid === 'none') {
        return Promise.resolve();
      }

      parent.set('replies', parent.get('replies') + 1);
      return parent.update();
    })
    // increment the number of comments on the post
    .then(() => {
      let promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const post = posts[i];
        post.set('comment_count', post.get('comment_count') + 1);
        const promise = post.update();

        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // increment the post comments count on each branch object
    // the post appears in
    .then(() => {
      let promises = [];

      for (let i = 0; i < posts.length; i += 1) {
        const promise = Models.Branch.findById(posts[i].get('branchid'))
          .then(instance => {
            if (instance === null) {
              return Promise.reject({
                message: 'Branch does not exist',
                status: 404,
              });
            }

            instance.set('post_comments', instance.get('post_comments') + 1);
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
    // Notify the post or comment author that a comment has been posted
    // on their content. If the comment is a reply to someone, we will
    // notify the comment author. Otherwise, the comment is a root comment
    // and we will notify the post author.
    .then(() => {
      const model = parentid === 'none' ? Models.PostData : Models.CommentData;
      return model.findById(parentid === 'none' ? postid : parentid);
    })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: `${parentid === 'none' ? 'Post' : 'Comment'} does not exist.`,
          status: 404,
        });
      }

      // Get the id of a branch where the post appears. Take the first branch
      // this post appears in (there are many) for the purposes of viewing the
      // notification. (todo WHY?)
      return Promise.resolve({
        author: instance.get('creator'),
        branchid: posts[0].get('branchid'),
      });
    })
    // Notify the author that their content has been interacted with.
    .then(data => {
      // Skip if interacting with our own content or if we are replying
      // to a deleted comment.
      if (username === data.author || (parentid !== 'none' && data.author === 'N/A')) {
        return Promise.resolve();
      }

      return Models.Notification.create({
        data: {
          branchid: data.branchid,
          commentid: id,
          parentid,
          postid,
          username,
        },
        date,
        id: createNotificationId(data.author, date),
        type: NotificationTypes.COMMENT,
        unread: true,
        user: data.author,
      });
    })
    .then(() => {
      req.user.set('num_comments', req.user.get('num_comments') + 1);
      return req.user.update();
    })
    // update the SendGrid contact list with the new user data
    // todo
    .then(() => mailer.addContact(req.user.dataValues, true))
    // Self-upvote the comment.
    .then(() => Models.UserVote.create({
      direction: 'up',
      itemid: createUserVoteItemId(id, 'comment'),
      username,
    }))
    .then(() => success.OK(res, id))
    .catch(err => {
      if (err) {
        console.error('Error posting comment:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.voteComment = (req, res) => {
  const {
    commentid,
    postid,
  } = req.params;
  const { vote } = req.body;
  const username = req.user.get('username');
  const itemid = createUserVoteItemId(commentid, 'comment');

  let comment;
  let resData = { delta: 0 };
  let voteInstance;

  if (!postid) {
    return error.BadRequest(res, 'Invalid postid.');
  }

  if (!commentid) {
    return error.BadRequest(res, 'Invalid commentid.');
  }

  if (!VoteDirections.includes(vote)) {
    return error.BadRequest(res, 'Invalid vote parameter.');
  }

  return Models.Comment.findById(commentid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      comment = instance;
      return Models.CommentData.findById(commentid);
    })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      if (instance.get('creator') === 'N/A') {
        return Promise.reject({
          message: 'You cannot vote on deleted comments.',
          status: 403,
        });
      }

      return Models.UserVote.findByUsernameAndItemId(username, itemid);
    })
    .then(instance => {
      if (instance) {
        voteInstance = instance;
      }

      return Promise.resolve();
    })
    // Update the comment 'up' attribute.
    .then(() => {
      // Check the specfied comment actually belongs to this post.
      if (comment.get('postid') !== postid) {
        return Promise.reject({
          message: 'Comment does not exist.',
          status: 404,
        });
      }

      resData.delta = voteInstance ? -1 : 1;
      comment.set(vote, comment.get(vote) + resData.delta);
      return comment.update();
    })
    // Create, update, or delete the vote record in the database.
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
      console.error('Error updating comment:', err);

      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res, err);
    });
};
