'use strict';

/**
 * Uses Passport.js
 * 
 * Visit http://passportjs.org/docs to learn how the Strategies work.
 */

const auth = require('./auth.js');
const LocalStrategy = require('passport-local').Strategy;
const mailer = require('./mailer.js');
const User = require('../models/user.model.js');

module.exports = passport => {
  passport.serializeUser( (user, done) => {
    done(null, user.username);
  });

  passport.deserializeUser( (username, done) => {
    const user = new User();
    
    user.findByUsername(username)
      .then( () => {
        return done(null, user.data);
      }, () => {
        return done(true);
      });
  });

  // SIGN UP STRATEGY
  passport.use('local-signup', new LocalStrategy({ passReqToCallback: true }, (req, username, password, done) => {
    process.nextTick( () => {
      // check whether a user with this username already exists in the database
      const user = new User();
      username = username.toLowerCase();
      
      user.findByUsername(username)
        .then( () => {
          return done(null, false, {
            status: 400,
            message: 'Username already exists'
          });
        }, err => {
          if (err) {
            console.error('Error signing up:', err);
            
            return done(err, false, {
              status: 500,
              message: 'Something went wrong'
            });
          }

          new User().findByEmail(req.body.email)
            .then( () => {
              return done(null, false, {
                status: 400,
                message: 'Email already exists'
              });
            }, err => {
              if (err) {
                console.error('Error signing up:', err);
                return done(err, false, {
                  status: 500,
                  message: 'Something went wrong'
                });
              }

              const token = auth.generateToken();

              // Create a new user object
              const newUser = new User({
                datejoined: new Date().getTime(),
                email: req.body.email,
                firstname: req.body.firstname,
                lastname: req.body.lastname,
                num_branches: 0,
                num_comments: 0,
                num_mod_positions: 0,
                num_posts: 0,
                password,
                show_nsfw: false,
                token,
                username,
                verified: false
              });

              // validate user properties
              const propertiesToCheck = [
                'datejoined',
                'email',
                'firstname',
                'lastname',
                'num_branches',
                'num_comments',
                'num_mod_positions',
                'num_posts',
                'password',
                'username',
                'verified'
              ];
              const invalids = newUser.validate(propertiesToCheck);
              
              if (invalids.length) {
                return done(null, false, {
                  status: 400,
                  message: `Invalid ${invalids[0]}`
                });
              }

              mailer.sendVerification(newUser.data, token)
                .then( () => {
                  return auth.generateSalt(10);
                })
                .then( salt => {
                  return auth.hash(password, salt);
                })
                .then( hash => {
                  // Save new user to database using hashed password
                  newUser.set('password', hash);
                  newUser.save()
                    .then( () => {
                      return done(null, { username });
                    }, err => {
                      console.error('Error signing up:', err);
                      return done(err, false, {
                        status: 500,
                        message: 'Something went wrong'
                      });
                    });
                })
                .catch( err => {
                  console.error('Error signing up:', err);
                  return done(err, false, {
                    status: 500,
                    message: 'Something went wrong'
                  });
                });
            });
        });
    });
  }));

  // LOGIN STRATEGY
  passport.use('local-login', new LocalStrategy({ passReqToCallback: true }, (req, username, password, done) => {
    process.nextTick( () => {
      // check whether a user with this username exists in the database
      const user = new User();
      user.findByUsername(username)
        .then( () => {
          // check user has verified their account
          if(!user.data.verified) {
            return done(null, false, {
              status: 403,
              message: 'Your account has not been verified'
            });
          }

          // compare password with stored hash from database using bcrypt
          auth.compare(password, user.data.password)
            .then( () => {
              return done(null, user.data);
            })
            .catch( err => {
              console.error('Error logging in:', err);
              return done(null, false, err);
            });
        }, err => {
          if (err) {
            console.error('Error logging in:', err);
            return done(err, false, {
              status: 500,
              message: 'Something went wrong'
            });
          }
          return done(null, false, {
            status: 400,
            message: `User doesn't exist`
          });
        });
    });
  }));

  // Alias the strategies for future API using camelcase.
  passport._strategies.LocalSignIn = passport._strategies['local-login'];
  passport._strategies.LocalSignUp = passport._strategies['local-signup'];

  return passport;
};