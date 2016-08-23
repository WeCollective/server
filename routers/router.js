'use strict';

var express = require('express');
var router = express.Router();

var error = require('../responses/errors.js');
var success = require('../responses/successes.js');

var ACL = require('../config/acl.js');

module.exports = function(app, passport) {  
  // USER ROUTER
  var userRouter = require('./user/user.router.js')(app, passport);
  app.use('/user', userRouter);

  // BRANCH ROUTER
  var branchRouter = require('./branch/branch.router.js')(app, passport);
  app.use('/branch', branchRouter);

  // MODS ROUTER
  var modsRouter = require('./mods/mods.router.js')(app, passport);
  app.use('/branch/:branchid/mods', modsRouter);

  // BRANCH POSTS ROUTER
  var branchPostsRouter = require('./branch-posts/branch-posts.router.js')(app, passport);
  app.use('/branch/:branchid/posts', branchPostsRouter);

  // SUBBRANCH REQUESTS ROUTER
  var requestsRouter = require('./requests/subbranches.router.js')(app, passport);
  app.use('/branch/:branchid/requests/subbranches', requestsRouter);

  // POST ROUTER
  var postRouter = require('./post/post.router.js')(app, passport);
  app.use('/post', postRouter);

  return router;
};
