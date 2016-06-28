'use strict';

var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');
var db = require('./database.js');
var User = require('../models/user.model.js');

module.exports = function(passport) {
  passport.serializeUser(function(user, done) {
    done(null, user.username);
  });
  passport.deserializeUser(function(username, done) {
    var user = new User();
    user.findByUsername(username).then(function() {
      return done(null, user.data);
    }, function() {
      return done(true);
    });
  });

  // SIGN UP STRATEGY
  passport.use('local-signup', new LocalStrategy({
      passReqToCallback : true
  }, function(req, username, password, done) {
    process.nextTick(function() {
      // check whether a user with this username already exists in the database
      var user = new User();
      user.findByUsername(username).then(function() {
        return done(null, false, { status: 400, message: 'Username already exists' });
      }, function(err) {
        if(err) {
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }

        // create a new user object
        var newUser = new User({
          'username': username,
          'password': password,
          'email': req.body.email,
          'firstname': req.body.firstname,
          'lastname': req.body.lastname,
          'datejoined': new Date().getTime()
        });

        // validate user properties
        var invalids = newUser.validate();
        if(invalids.length > 0) {
          return done(null, false, { status: 400, message: 'Invalid ' + invalids[0] });
        }

        // salt and hash the password, storing hash in the db
        bcrypt.genSalt(10, function(err, salt) {
          bcrypt.hash(password, salt, function(err, hash) {
            // save new user to database, using hashed password
            newUser.set('password', hash);
            newUser.save().then(function() {
              return done(null, { username: username });
            }, function() {
              return done(err, false, { status: 500, message: 'Something went wrong' });
            });
          });
        });
      });
    });
  }));

  // LOGIN STRATEGY
  passport.use('local-login', new LocalStrategy({
      passReqToCallback : true
  }, function(req, username, password, done) {
    process.nextTick(function() {
      // check whether a user with this username exists in the database
      var user = new User();
      user.findByUsername(username).then(function() {
        // compare password with stored hash from database using bcrypt
        bcrypt.compare(password, user.data.password, function(err, res) {
          // bcrypt error
          if(err) {
            return done(err, false, { status: 500, message: 'Something went wrong' });
          }
          // correct match, successfully logged in
          if(res) {
            return done(null, user.data);
          }
          // password mismatch
          return done(null, false, { status: 400, message: 'Password mismatch' });
        });
      }, function(err) {
        if(err) {
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }
        return done(null, false, { status: 400, message: 'User doesn\'t exist' });
      });
    });
  }));

  return passport;
};
