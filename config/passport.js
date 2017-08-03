'use strict';

/**
 * Uses Passport.js
 * 
 * Visit http://passportjs.org/docs to learn how the Strategies work.
 */
const auth = require('./auth');
const LocalStrategy = require('passport-local').Strategy;
const mailer = require('./mailer');
const User = require('../models/user.model');

module.exports = passport => {
  passport.serializeUser((user, done) => done(null, user.username));

  passport.deserializeUser((username, done) => {
    const user = new User();
    
    return user.findByUsername(username)
      .then(() => done(null, user.data))
      .catch(() => done(true));
  });

  passport.use('LocalSignIn', new LocalStrategy({
    passReqToCallback: true,
  }, (req, username, password, done) => process.nextTick(() => {
    const user = new User();

    return user.findByUsername(username)
      .then(() => {
        if (!user.data.verified) {
          return Promise.reject(null, 'Your account has not been verified', 403);
        }

        return auth.compare(password, user.data.password);
      })
      .then(() => done(null, user.data))
      .catch((err, message, status) => {
        if (err) {
          console.error('Error logging in:', err);
          return done(null, false, err);
        }

        return done(null, false, {
          status: status || 400,
          message: message || `User doesn't exist`,
        });
      });
  })));

  passport.use('LocalSignUp', new LocalStrategy({
    passReqToCallback: true,
  }, (req, username, password, done) => process.nextTick(() => {
    const user = new User();
    username = username.toLowerCase();

    let newUser;
    let token;

    return user.findByUsername(username)
      .then(() => done(null, false, {
        message: 'Username already exists',
        status: 400,
      }))
      .catch(err => {
        if (err) {
          console.error('Error signing up:', err);
          
          return done(err, false, {
            status: 500,
            message: 'Something went wrong',
          });
        }

        return Promise.resolve();
      })
      .then(() => new User().findByEmail(req.body.email))
      .then(() => done(null, false, {
        message: 'Email already exists',
        status: 400,
      }))
      .catch(err => {
        if (err) {
          console.error('Error signing up:', err);
          return done(err, false, {
            message: 'Something went wrong',
            status: 500,
          });
        }

        return Promise.resolve();
      })
      .then(() => {
        token = auth.generateToken();

        newUser = new User({
          datejoined: new Date().getTime(),
          email: req.body.email,
          name: req.body.name,
          num_branches: 0,
          num_comments: 0,
          num_mod_positions: 0,
          num_posts: 0,
          password,
          show_nsfw: false,
          token,
          username,
          verified: false,
        });

        const propertiesToCheck = [
          'datejoined',
          'email',
          'name',
          'num_branches',
          'num_comments',
          'num_mod_positions',
          'num_posts',
          'password',
          'username',
          'verified',
        ];

        const invalids = newUser.validate(propertiesToCheck);
        
        if (invalids.length) {
          return done(null, false, {
            message: invalids[0],
            status: 400,
          });
        }

        return Promise.resolve();
      })
      .then(() => mailer.sendVerification(newUser.data, token))
      .then(() => auth.generateSalt(10))
      .then(salt => auth.hash(password, salt))
      // Save new user to database using hashed password
      .then(hash => {
        newUser.set('password', hash);
        return newUser.save();
      })
      .then(() => done(null, { username }))
      .catch(err => {
        console.error('Error signing up:', err);
        return done(null, false, err);
      });
  })));

  // Alias the strategies for legacy API using hyphens.
  passport._strategies['local-login']  = passport._strategies.LocalSignIn;
  passport._strategies['local-signup'] = passport._strategies.LocalSignUp;

  return passport;
};
