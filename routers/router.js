'use strict';

var express = require('express');
var router = express.Router();

var error = require('../responses/errors.js');
var success = require('../responses/successes.js');

var ACL = require('../config/acl.js');

var url = require('url');
var http = require('http');
var https = require('https');

module.exports = function(app, passport) {
  var version = '/v1';

  // Route used to proxy resources on secure endpoints through
  // this secure server to ensure all content is served over https.
  // URL of resource should be supplied as a query argument.
  app.get(version + '/proxy', function(req, res) {
    if(!req.query.url) return error.NotFound(res);

    var url_parts = url.parse(req.query.url, true);
    if(url_parts.protocol !== 'http:') return error.BadRequest(res, 'Only http resources can be proxied');
    http.get(req.query.url, function(response) {
      if (response.statusCode === 200) {
        res.writeHead(200, {
          'Content-Type': response.headers['content-type']
        });
        response.pipe(res);
      } else {
        return error.NotFound(res);
      }
    }).on('error', function() {
      return error.BadRequest(res, 'Invalid URL parameter');
    });
  });

  // USER ROUTER
  var userRouter = require('./user/user.router.js')(app, passport);
  app.use(version + '/user', userRouter);

  // BRANCH ROUTER
  var branchRouter = require('./branch/branch.router.js')(app, passport);
  app.use(version + '/branch', branchRouter);

  // MODS ROUTER
  var modsRouter = require('./mods/mods.router.js')(app, passport);
  app.use(version + '/branch/:branchid/mods', modsRouter);

  // BRANCH POSTS ROUTER
  var branchPostsRouter = require('./branch-posts/branch-posts.router.js')(app, passport);
  app.use(version + '/branch/:branchid/posts', branchPostsRouter);

  // SUBBRANCH REQUESTS ROUTER
  var requestsRouter = require('./requests/subbranches.router.js')(app, passport);
  app.use(version + '/branch/:branchid/requests/subbranches', requestsRouter);

  // POST ROUTER
  var postRouter = require('./post/post.router.js')(app, passport);
  app.use(version + '/post', postRouter);

  return router;
};
