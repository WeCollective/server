'use strict';

var LocalStrategy = require('passport-local').Strategy;
var db = require('./database.js');
var User = require('../models/user.model.js');
var mailer = require('./mailer.js');
var auth = require('./auth.js');

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
  var newUser;
  passport.use('local-signup', new LocalStrategy({
      passReqToCallback : true
  }, function(req, username, password, done) {
    process.nextTick(function() {
      // check whether a user with this username already exists in the database
      var user = new User();
      username = username.toLowerCase();
      user.findByUsername(username).then(function() {
        return done(null, false, { status: 400, message: 'Username already exists' });
      }, function(err) {
        if(err) {
          console.error("Error signing up:", err);
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }

        new User().findByEmail(req.body.email).then(function() {
          return done(null, false, { status: 400, message: 'Email already exists' });
        }, function(err) {
          if(err) {
            console.error("Error signing up:", err);
            return done(err, false, { status: 500, message: 'Something went wrong' });
          }

          var token = auth.generateToken();
          // create a new user object
          newUser = new User({
            'username': username,
            'password': password,
            'email': req.body.email,
            'firstname': req.body.firstname,
            'lastname': req.body.lastname,
            'datejoined': new Date().getTime(),
            'verified': false,
            'token': token,
            'num_posts': 0,
            'num_comments': 0,
            'num_branches': 0,
            'num_mod_positions': 0
          });

          // validate user properties
          var propertiesToCheck = ['username', 'password', 'email', 'firstname', 'lastname', 'datejoined', 'verified', 'num_posts', 'num_comments', 'num_branches', 'num_mod_positions'];
          var invalids = newUser.validate(propertiesToCheck);
          if(invalids.length > 0) {
            return done(null, false, { status: 400, message: 'Invalid ' + invalids[0] });
          }

          mailer.sendVerification(newUser.data, token).then(function() {
            return auth.generateSalt(10);
          }).then(function(salt) {
            return auth.hash(password, salt);
          }).then(function(hash) {
            // save new user to database, using hashed password
            newUser.set('password', hash);
            newUser.save().then(function() {
              return done(null, { username: username });
            }, function(err) {
              console.error("Error signing up:", err);
              return done(err, false, { status: 500, message: 'Something went wrong' });
            });
          }).catch(function(err) {
            console.error("Error signing up:", err);
            return done(err, false, { status: 500, message: 'Something went wrong' });
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
        // check user has verified their account
        if(!user.data.verified) {
          return done(null, false, { status: 403, message: 'Your account has not been verified' });
        }

        // compare password with stored hash from database using bcrypt
        auth.compare(password, user.data.password).then(function() {
          return done(null, user.data);
        }).catch(function(err) {
          console.error("Error logging in:", err);
          return done(null, false, err);
        });
      }, function(err) {
        if(err) {
          console.error("Error logging in:", err);
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }
        return done(null, false, { status: 400, message: 'User doesn\'t exist' });
      });
    });
  }));

  return passport;
};
