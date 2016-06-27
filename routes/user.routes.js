'use strict';

var aws = require('../config/aws.js');
var db = require('../config/database.js');
var success = require('./responses/successes.js');
var error = require('./responses/errors.js');

module.exports = {
  // TODO: access controls on what user info is sent back, inc. yourself vs other users
  getSelf: function(req, res) {
    if(!req.user.username) {
      console.error('No username found in session.');
      return error.InternalServerError(res);
    }

    aws.dbClient.get({
      TableName: db.Table.Users,
      Key: {
        'username': req.user.username
      }
    }, function(err, data) {
      if(err) {
        console.error('Error fetching user from database.');
        return error.InternalServerError(res);
      }

      if(!data || !data.Item) {
        console.error('No data received from database');
        return error.NotFound(res);
      }

      var user = {
        username: data.Item.username,
        name: {
          first: data.Item.firstname,
          last: data.Item.lastname
        },
        email: data.Item.email
      };
      return success.OK(res, user);
    });
  },
  get:  function(req, res) {

    if(!req.params.username) {
      console.error('No username parameter specified.');
      return error.BadRequest(res);
    }

    aws.dbClient.get({
      TableName: db.Table.Users,
      Key: {
        'username': req.params.username
      }
    }, function(err, data) {
      if(err) {
        console.error('Error fetching user from database.');
        return error.InternalServerError(res);
      }

      if(!data || !data.Item) {
        console.error('No data received from database');
        return error.NotFound(res);
      }

      var user = {
        username: data.Item.username,
        name: {
          first: data.Item.firstname,
          last: data.Item.lastname
        }
      };

      return success.OK(res, user);
    });
  },
  deleteSelf: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    aws.dbClient.delete({
      TableName: db.Table.Users,
      Key: {
        'username': req.user.username
      }
    }, function(err, data) {
      if(err) {
        console.error('Error deleting user from database.');
        return error.InternalServerError(res);
      }
      req.logout();
      return success.OK(res);
    });
  }
};
