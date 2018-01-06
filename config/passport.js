/**
 * Uses Passport.js
 * 
 * Visit http://passportjs.org/docs to learn how the Strategies work.
 */
const ExtractJwt = require('passport-jwt').ExtractJwt;
const jwt = require('jwt-simple');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const passport = require('passport');
const reqlib = require('app-root-path').require;

const algolia = reqlib('config/algolia');
const auth = reqlib('config/auth');
const error = reqlib('responses/errors');
const JwtConfig = reqlib('config/jwt');
const mailer = reqlib('config/mailer');
const Models = reqlib('models/');

module.exports = () => {
  /* Potentially legacy */
  passport.serializeUser((user, done) => done(null, user.username));

  passport.deserializeUser((username, done) => Models.User.findOne({
    where: {
      username,
    },
  })
    .then(instance => {
      if (instance === null) {
        return Promise.reject();
      }

      const data = {};
      // todo
      Object.keys(instance.dataValues).forEach(key => {
        data[key] = instance.get(key);
      });

      return done(null, data);
    })
    .catch(() => done(true)));
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
      return Models.User.findOne({
        where: {
          username: payload.username,
        },
      })
        .then(instance => {
          if (instance === null) {
            return Promise.reject({
              message: 'The user does not exist.',
              status: 404,
            });
          }

          if (!instance.get('verified')) {
            return Promise.reject({
              message: 'User account not verified',
              status: 403,
            });
          }

          if (instance.get('banned')) {
            return Promise.reject({
              message: 'Your account has been permanently banned from Weco.',
              status: 401,
            });
          }

          isAuthenticated = true;

          // todo pass the instance from here to the done method too
          req.user = instance;

          const data = {};
          // todo
          Object.keys(instance.dataValues).forEach(key => {
            data[key] = instance.get(key);
          });

          return done(null, data);
        })
        .catch(err => done(null, false, err));
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
    let user;
    return Models.User.findOne({
      where: {
        username,
      },
    })
      .then(instance => {
        if (instance === null) {
          return Promise.reject({
            message: 'The username does not exist.',
            status: 404,
          });
        }

        user = instance;

        if (!user.get('verified')) {
          return Promise.reject({
            message: 'Your account has not been verified',
            status: 403,
          });
        }

        if (user.get('banned')) {
          return Promise.reject({
            message: 'Your account has been permanently banned from Weco.',
            status: 401,
          });
        }

        return auth.compare(password, user.get('password'));
      })
      .then(() => {
        const payload = {
          username,
        };
        user.set('jwt', jwt.encode(payload, JwtConfig.jwtSecret));
        // todo
        return done(null, user.dataValues);
      })
      .catch(err => {
        console.error('Error logging in:', err);
        return done(null, false, err);
      });
  })));

  passport.use('LocalSignUp', new LocalStrategy({
    passReqToCallback: true,
  }, (req, username, password, done) => process.nextTick(() => {
    username = username.toLowerCase();

    const {
      email,
      name,
    } = req.body;

    let token;
    let user;

    return Models.User.findOne({
      where: {
        username,
      },
    })
      .then(instance => {
        if (instance !== null) {
          return Promise.reject({
            message: 'Username already exists.',
            status: 400,
          });
        }

        return Models.User.findByEmail(email);
      })
      .then(instance => {
        if (instance !== null) {
          return Promise.reject({
            message: 'Email already exists.',
            status: 400,
          });
        }

        const isValidPassword = Models.Dynamite.validator.password(password);

        if (!isValidPassword) {
          return Promise.reject({
            message: 'Invalid password.',
            status: 400,
          });
        }

        token = auth.generateToken();

        return auth.generateSalt();
      })
      .then(salt => auth.hash(password, salt))
      .then(hash => {
        try {
          return Models.User.create({
            banned: false,
            datejoined: new Date().getTime(),
            email,
            name,
            num_branches: 0,
            num_comments: 0,
            num_mod_positions: 0,
            num_posts: 0,
            password: hash,
            show_nsfw: false,
            token,
            username,
            verified: false,
          });
        }
        catch (err) {
          console.log(err);
          return Promise.reject(err);
        }
      })
      .then(instance => {
        user = instance;
        // todo
        return mailer.sendVerification(user.dataValues, token);
      })
      // Add new user to the search index.
      // todo
      .then(() => algolia.addObjects(user.dataValues, 'user'))
      .then(() => done(null, { username }))
      .catch(err => {
        console.error('Error signing up:', err);
        return done(err, false, err);
      });
  })));

  return {
    authenticate: (strategy, callbackOrOptional) => (req, res, next) => {
      if (strategy === 'jwt') {
        // Allow guests to pass the token check, the req.user simply won't be defined.
        return passport.authenticate('jwt', JwtConfig.jwtSession, (err, user, info) => {
          // callbackOrOptional
          if (!user && info && typeof info === 'object' && req.headers.authorization) {
            return error.code(res, info.status, info.message);
          }
          return next();
        })(req, res, next);
      }
      return passport.authenticate(strategy, callbackOrOptional || JwtConfig.jwtSession)(req, res, next);
    },
    initialize: () => passport.initialize(),
  };
};
