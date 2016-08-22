'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var Branch = require('../../models/branch.model.js');
var Post = require('../../models/post.model.js');
var PostData = require('../../models/post-data.model.js');
var PostImage = require('../../models/post-image.model.js');
var Tag = require('../../models/tag.model.js');
var Comment = require('../../models/comment.model.js');
var CommentData = require('../../models/comment-data.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

var _ = require('lodash');

module.exports = {
  post: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    if(!req.body.title || req.body.title.length == 0) {
      return error.BadRequest(res, 'Invalid title');
    }

    try {
      req.body.branchids = JSON.parse(req.body.branchids);
    } catch(err) {
      return error.BadRequest(res, 'Malformed branchids.');
    }
    if(!req.body.branchids || req.body.branchids.length == 0 || req.body.branchids.length > 5) {
      return error.BadRequest(res, 'Invalid branchids');
    }
    if(req.body.branchids.indexOf('root') > -1) {
      return error.BadRequest(res, 'Invalid branchid');
    }

    // fetch the tags of each specfied branch. The union of these is the list of
    // the branches the post should be tagged to.
    var allTags = [];
    var tagCollectionPromises = [];
    for(var i = 0; i < req.body.branchids.length; i++) {
      tagCollectionPromises.push(new Promise(function(resolve, reject) {
        new Tag().findByBranch(req.body.branchids[i]).then(function(tags) {
          for(var j = 0; j < tags.length; j++) {
            allTags.push(tags[j].tag);
          }
          resolve();
        }, function(err) {
          if(err) {
            reject();
          }
          resolve();
        });
      }));
    }

    Promise.all(tagCollectionPromises).then(function () {
      // all tags are collected, these are the branchids to tag the post to
      req.body.branchids = _.union(allTags);

      var date = new Date().getTime();
      var id = req.user.username + '-' + date;

      var propertiesToCheck, invalids;
      var posts = [];
      for(var i = 0; i < req.body.branchids.length; i++) {
        var post = new Post({
          id: id,
          branchid: req.body.branchids[i],
          date: date,
          type: req.body.type,
          local: 0,
          individual: 0,
          up: 0,
          down: 0,
          rank: 0
        });

        // validate post properties
        propertiesToCheck = ['id', 'branchid', 'date', 'type', 'local', 'individual', 'up', 'down', 'rank'];
        invalids = post.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }
        posts.push(post);
      }

      var postdata = new PostData({
        id: id,
        creator: req.user.username,
        title: req.body.title,
        text: req.body.text
      });

      // validate postdata properties
      propertiesToCheck = ['id', 'creator', 'title', 'text'];
      invalids = postdata.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }

      // Check all the specified branches exist
      var promises = [];
      for(var i = 0; i < posts.length; i++) {
        promises.push(new Branch().findById(posts[i].data.branchid));
      }

      Promise.all(promises).then(function () {
        // save a post entry for each specified branch
        promises = [];
        for(var i = 0; i < posts.length; i++) {
          promises.push(posts[i].save());
        }

        Promise.all(promises).then(function() {
          return postdata.save();
        }).then(function() {
          // successfully create post, send back its id
          return success.OK(res, id);
        }).catch(function() {
          return error.InternalServerError(res);
        });
      }, function(err) {
        if(err) {
          return error.InternalServerError(res);
        }
        return error.NotFound(res, 'One of the specified branches doesn\'t exist.');
      });
    }, function() {
      console.error("Error fetching branch tags.");
      return error.InternalServerError(res);
    });
  },
  get: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var post, date, type;
    var postdata = new PostData();
    new Post().findById(req.params.postid, 0).then(function(posts) {
      if(!posts || posts.length == 0) {
        return error.NotFound(res);
      }
      date = posts[0].date;
      type = posts[0].type;
      return postdata.findById(req.params.postid);
    }).then(function() {
      post = postdata.data;
      post.type = type;
      post.date = date;
      return success.OK(res, post);
    }).catch(function(err) {
      if(err) {
        console.error("Error fetching post data");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getPictureUploadUrl: function(req, res) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    // ensure this user is the creator of the specified post
    var post = new PostData();
    post.findById(req.params.postid).then(function() {
      if(post.data.creator != req.user.username) {
        // user did not create this post
        return error.Forbidden(res);
      }

      var filename = req.params.postid + '-picture-orig.jpg';
      var params = {
        Bucket: fs.Bucket.PostImages,
        Key: filename,
        ContentType: 'image/*'
      }
      var url = aws.s3Client.getSignedUrl('putObject', params, function(err, url) {
        return success.OK(res, url);
      });
    }, function(err) {
      if(err) {
        console.error("Error fetching post data");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getPicture: function(req, res, thumbnail) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var size = thumbnail ? 200 : 640;

    var image = new PostImage();
    image.findById(req.params.postid).then(function() {
      aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.PostImagesResized,
        Key: image.data.id + '-' + size + '.' + image.data.extension
      }, function(err, url) {
        if(err) {
          console.error("Error getting signed url.");
          return error.InternalServerError(res);
        }
        return success.OK(res, url);
      });
    }, function(err) {
      if(err) {
        console.error("Error fetching post image.");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  postComment: function(req, res) {
    if(!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var date = new Date().getTime();
    var id = req.user.username + '-' + date;
    var comment = new Comment({
      id: id,
      postid: req.params.postid,    // ensure exists
      parentid: req.body.parentid,  // ensure exists and in this post
      individual: 0,
      replies: 0,
      up: 0,
      down: 0,
      date: date,
      rank: 0
    });

    // validate comment properties
    var propertiesToCheck = ['id', 'postid', 'parentid', 'individual', 'replies', 'up', 'down', 'date', 'rank'];
    var invalids = comment.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    var commentdata = new CommentData({
      id: id,
      creator: req.user.username,
      date: date,
      text: req.body.text
    });

    // validate comment data properties
    propertiesToCheck = ['id', 'creator', 'date', 'text'];
    invalids = commentdata.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // ensure the specified post exists
    var parent = new Comment();
    new Post().findById(req.params.postid, 0).then(function(posts) {
      if(!posts || posts.length == 0) {
        return error.NotFound(res);
      }

      // if this is a root comment, continue
      if(req.body.parentid == 'none') {
        return new Promise(function(resolve, reject) {
          resolve();
        });
      } else {
        // otherwise, ensure the specified parent comment exists
        return parent.findById(req.body.parentid);
      }
    }).then(function() {
      // ensure the parent comment belongs to this post
      if(req.body.parentid != 'none' && parent.data.postid != req.params.postid) {
        return error.BadRequest(res, 'Parent comment does not belong to the same post');
      }

      // all is well - save the new comment
      return comment.save();
    }).then(function() {
      // save the comment data
      return commentdata.save();
    }).then(function() {
      // if this is a root comment, continue
      if(req.body.parentid == 'none') {
        return new Promise(function(resolve, reject) {
          resolve();
        });
      } else {
        // otherwise, increment the number of replies on the parent
        parent.set('replies', parent.data.replies + 1);
        return parent.update();
      }
    }).then(function() {
      // return the comment id to the client
      return success.OK(res, id);
    }).catch(function(err) {
      if(err) {
        console.error("Error posting comment");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getComments: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    // if parentid not specified, get root comments
    if(!req.query.parentid) {
      req.query.parentid = 'none';
    }

    // ascertain how to sort the comments (points, replies, date). Default points
    var sort = req.query.sort;
    if(!req.query.sort) {
      sort = 'points';
    }

    new Comment().findByParent(req.params.postid, req.query.parentid, sort).then(function(comments) {
      if(!comments || comments.length == 0) {
        return error.NotFound(res);
      }
      return success.OK(res, comments);
    }, function(err) {
      if(err) {
        console.error("Error fetching comments");
        console.log(err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  getComment: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }
    if(!req.params.commentid) {
      return error.BadRequest(res, 'Missing commentid');
    }

    // TODO check the specfied comment actually belongs to this post

    var commentdata = new CommentData();
    commentdata.findById(req.params.commentid).then(function() {
      return success.OK(res, commentdata.data);
    }, function(err) {
      if(err) {
        console.error("Error fetching comment data");
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  voteComment: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }
    if(!req.params.commentid) {
      return error.BadRequest(res, 'Missing commentid');
    }
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // if this action is voting on the comment, ensure its valid
    if(!req.body.vote || (req.body.vote != 'up' && req.body.vote != 'down')) {
      return error.BadRequest(res, 'Missing or malformed vote parameter');
    }
    var updatedComment = new Comment({
      id: req.params.commentid,
      postid: req.params.postid
    });
    var propertiesToCheck = ['id', 'postid'];
    var invalids = updatedComment.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    // TODO check the specfied comment actually belongs to this post

    var comment = new Comment();
    comment.findById(req.params.commentid).then(function() {
      if(!comment.data || comment.data.length == 0) {
        return error.NotFound(res);
      }

      // check the specfied comment actually belongs to this post
      if(comment.data.postid != req.params.postid) {
        return error.NotFound(res);
      }

      // increment either the up or down vote for the comment if specified
      updatedComment.set(req.body.vote, comment.data[req.body.vote] + 1);
      return updatedComment.update();
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error('Error updating comment.');
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  putComment: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }
    if(!req.params.commentid) {
      return error.BadRequest(res, 'Missing commentid');
    }
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // ensure new comment text is valid
    if(!req.body.text) {
      return error.BadRequest(res, 'Missing text');
    }
    var updatedCommentData = new CommentData({
      id: req.params.commentid
    });
    updatedCommentData.set('text', req.body.text);
    updatedCommentData.set('edited', true);
    // validate comment properties
    var propertiesToCheck = ['id', 'text'];
    var invalids = updatedCommentData.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }

    var comment = new Comment();
    // check the specfied comment actually belongs to this post
    comment.findById(req.params.commentid).then(function() {
      if(comment.data.postid != req.params.postid) {
        return error.NotFound(res);
      }

      // update the comment
      return updatedCommentData.update();
    }).then(function() {
      return success.OK(res);
    }).catch(function() {
      console.error('Error updating comment.');
      return error.InternalServerError(res);
    });
  }
};
