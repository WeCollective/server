'use strict';

/**
 * Uses Passport.js
 * 
 * Visit http://passportjs.org/docs to learn how the Strategies work.
 */
const auth = require('./auth');
const error = require('../responses/errors');
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jwt-simple');
const JwtConfig = require('./jwt');
const LocalStrategy = require('passport-local').Strategy;
const mailer = require('./mailer');
const JwtStrategy = require('passport-jwt').Strategy;
const passport = require('passport');
const User = require('../models/user.model');

module.exports = () => {
  /* Potentially legacy */
  passport.serializeUser((user, done) => done(null, user.username));

  passport.deserializeUser((username, done) => {
    const user = new User();
    
    return user.findByUsername(username)
      .then(() => done(null, user.data))
      .catch(() => done(true));
  });
  /* END Potentially legacy */

  // audience
  // issuer
  passport.use(new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    passReqToCallback: true,
    secretOrKey: JwtConfig.jwtSecret,
  }, (req, payload, done) => {
    let isAuthenticated = false;

    req.isAuthenticated = () => isAuthenticated;

    if (typeof payload === 'object' && payload.username) {
      const user = new User();

      return user.findByUsername(payload.username)
        .then(() => {
          if (!user.data.verified) {
            return Promise.reject({
              message: 'User account not verified',
              status: 403,
            });
          }

          if (user.data.banned === true) {
            return Promise.reject({
              message: 'Your account has been permanently banned from Weco.',
              status: 401,
            });
          }

          isAuthenticated = true;
          req.user = user.data;

          return done(null, user.data);
        })
        .catch(err => {
          return done(null, false, err);
        });
    }

    if (req.token) {
      return done(null, false, {
        message: 'Invalid token',
        status: 403,
      });
    }

    return done(null, false);
  }));

  passport.use('LocalSignIn', new LocalStrategy((username, password, done) => process.nextTick(() => {
    const user = new User();

    return user.findByUsername(username)
      .then(() => {
        if (!user.data.verified) {
          return Promise.reject(null, 'Your account has not been verified', 403);
        }

        if (user.data.banned === true) {
          return Promise.reject({
            message: 'Your account has been permanently banned from Weco.',
            status: 401,
          });
        }

        return auth.compare(password, user.data.password);
      })
      .then(() => {
        const payload = {
          username: user.data.username,
        };
        user.data.jwt = jwt.encode(payload, JwtConfig.jwtSecret);
        return done(null, user.data);
      })
      .catch((err, message, status) => {
        if (err) {
          console.error('Error logging in:', err);
          return done(null, false, err);
        }

        return done(null, false, {
          message: message || 'User doesn\'t exist',
          status: status || 400,
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
      .then(() => Promise.reject({
        message: 'Username already exists',
        status: 400,
      }))
      .catch(err => {
        if (err) {
          return Promise.reject(err);
        }

        return Promise.resolve();
      })
      .then(() => new User().findByEmail(req.body.email))
      .then(() => Promise.reject({
        message: 'Email already exists',
        status: 400,
      }))
      .catch(err => {
        if (err) {
          return Promise.reject(err);
        }

        return Promise.resolve();
      })
      .then(() => {
        token = auth.generateToken();

        newUser = new User({
          banned: false,
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
          return Promise.reject({
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
        return done(err, false, err);
      });
  })));

  return {
    authenticate: (strategy, callback) => (req, res, next) => {
      if (strategy === 'jwt') {
        // Allow guests to pass the token check, the req.user simply won't be defined.
        return passport.authenticate('jwt', JwtConfig.jwtSession, (err, user, info) => {
          if (!user && info && typeof info === 'object') {
            return error.code(res, info.status, info.message);
          }
          return next();
        })(req, res, next);
      }
      return passport.authenticate(strategy, callback || JwtConfig.jwtSession)(req, res, next);
    },
    initialize: () => passport.initialize(),
  };
};
