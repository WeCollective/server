'use strict';

const express = require('express');
const router = express.Router();

const error = require('../responses/errors');

const http = require('http');
const url = require('url');

module.exports = app => {
  const version = '/v1';

  // Route used to proxy resources on insecure endpoints through
  // this secure server to ensure all content is served over https.
  // URL of resource should be supplied as a query argument.

  /**
   * @api {get} /proxy Proxy insecure resource
   * @apiName Proxy insecure resource
   * @apiDescription Proxy a resource on an insecure endpoint over https
   * @apiGroup Misc
   * @apiPermission guest
   * @apiVersion 1.0.0
   *
   * @apiParam (URL Parameters) {String} url The url of the resource to proxy
   *
   * @apiUse OK
   * @apiUse Forbidden
   * @apiUse InternalServerError
   */
  app.get(`${version}/proxy`, (req, res) => {
    if (!req.query.url) {
      return error.NotFound(res);
    }

    const url_parts = url.parse(req.query.url, true);

    if (url_parts.protocol !== 'http:') {
      return error.BadRequest(res, 'Only http resources can be proxied');
    }
    
    http.get(req.query.url, response => {
      if (response.statusCode === 200) {
        res.writeHead(200, {
          'Content-Type': response.headers['content-type']
        });
        response.pipe(res);
      }
      else {
        return error.NotFound(res);
      }
    })
      .on('error', () => {
        return error.BadRequest(res, 'Invalid URL parameter');
      });
  });

  const branchModsRouter = require('./mods/router')(app);
  const branchPostsRouter = require('./branch-posts/router')(app);
  const branchRouter = require('./branch/router')(app);
  const branchSubbranchesRouter = require('./requests/router')(app);
  const constantRouter = require('./constant/router')(app);
  const pollRouter = require('./poll/router')(app);
  const postRouter = require('./post/router')(app);
  const userRouter = require('./user/router')(app);

  app.use(`${version}/branch`, branchRouter);
  app.use(`${version}/branch/:branchid/mods`, branchModsRouter);
  app.use(`${version}/branch/:branchid/posts`, branchPostsRouter);
  app.use(`${version}/branch/:branchid/requests/subbranches`, branchSubbranchesRouter);
  app.use(`${version}/constant`, constantRouter);
  app.use(`${version}/poll`, pollRouter);
  app.use(`${version}/post`, postRouter);
  app.use(`${version}/user`, userRouter);

  return router;
};
