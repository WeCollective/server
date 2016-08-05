'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var Branch = require('../../models/branch.model.js');
var Post = require('../../models/post.model.js');
var PostData = require('../../models/post-data.model.js');
var PostImage = require('../../models/post-image.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

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

    var date = new Date().getTime();
    var id = req.user.username + '-' + date;

    var propertiesToCheck, invalids;
    var posts = [];
    for(var i = 0; i < req.body.branchids.length; i++) {
      var post = new Post({
        id: id,
        branchid: req.body.branchids[i],
        type: req.body.type,
        local: 0,
        individual: 0,
        up: 0,
        down: 0
      });

      // validate post properties
      propertiesToCheck = ['id', 'branchid', 'type', 'local', 'individual', 'up', 'down'];
      invalids = post.validate(propertiesToCheck);
      if(invalids.length > 0) {
        return error.BadRequest(res, 'Invalid ' + invalids[0]);
      }
      posts.push(post);
    }

    var postdata = new PostData({
      id: id,
      creator: req.user.username,
      date: date,
      title: req.body.title,
      text: req.body.text
    });

    // validate postdata properties
    propertiesToCheck = ['id', 'creator', 'date', 'title', 'text'];
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
  },
  get: function(req, res) {
    if(!req.params.postid) {
      return error.BadRequest(res, 'Missing postid');
    }

    var post;
    var postdata = new PostData();
    new Post().findById(req.params.postid).then(function(posts) {
      if(!posts || posts.length == 0) {
        return error.NotFound(res);
      }
      post = posts[0];
      return postdata.findById(req.params.postid);
    }).then(function() {
      post.data = postdata.data;
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
  }
};
