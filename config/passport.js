'use strict';

var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');
var db = require('./database.js');
var User = require('../models/user.model.js');
var mailer = require('./mailer.js');

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
  function generateToken() {
    // create a random 16 character verification token for the new user
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var token = '';
    for(var i = 0; i < 16; i++) {
      token += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return token;
  }
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
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }

        var token = generateToken();
        // create a new user object
        newUser = new User({
          'username': username,
          'password': password,
          'email': req.body.email,
          'firstname': req.body.firstname,
          'lastname': req.body.lastname,
          'datejoined': new Date().getTime(),
          'verified': false,
          'token': token
        });

        // validate user properties
        var propertiesToCheck = ['username', 'password', 'email', 'firstname', 'lastname', 'datejoined', 'verified'];
        var invalids = newUser.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return done(null, false, { status: 400, message: 'Invalid ' + invalids[0] });
        }

        mailer.sendVerification(newUser.data, token).then(function() {
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
          return done(null, false, { status: 400, message: 'Your account has not been verified' });
        }

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
