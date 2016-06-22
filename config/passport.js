var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');
var db = require('./database.js');

// TODO: sanitize input!

module.exports = function(passport, db) {
  passport.serializeUser(function(user, done) {
    done(null, user.username);
  });
  passport.deserializeUser(function(username, done) {
    db.client.get({
      TableName: db.Table.Users,
      Key: {
        'username': username
      }
    }, function(err, data) {
      return done(err, data.Item);
    });
  });

  // SIGN UP STRATEGY
  passport.use('local-signup', new LocalStrategy({
      passReqToCallback : true
  }, function(req, username, password, done) {
    process.nextTick(function() {
      // check whether a user with this username already exists in the database
      db.client.get({
        TableName: db.Table.Users,
        Key: {
          'username': username
        }
      }, function(err, data) {
        // database error
        if(err) {
          console.error('Error fetching user.\n' + JSON.stringify(err));
          return done(err);
        }

        // a user with this username already exists
        if(data.Item) {
          console.error('Username already exists.');
          return done(null, false);
        }

        // TODO check valid password using regex
        
        if(!req.body.email) {
          console.error('Missing email.');
          return done(null, false);
        }

        // salt and hash the password, storing hash in the db
        bcrypt.genSalt(10, function(err, salt) {
          bcrypt.hash(password, salt, function(err, hash) {
            // save new user to database, using hashed password
            var user = {
              'username': username,
              'password': hash,
              'email': req.body.email
            };
            db.client.put({
              TableName: db.Table.Users,
              Item: user
            }, function(err, data) {
              // database error
              if(err) {
                console.error('Error creating user.\n' + JSON.stringify(err));
                return done(err);
              }
              // successfully saved new user
              done(null, { username: username });
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
      db.client.get({
        TableName: db.Table.Users,
        Key: {
          'username': username
        }
      }, function(err, data) {
        // database error
        if(err) {
          console.error('Error fetching user.\n' + JSON.stringify(err));
          return done(err);
        }

        // user doesn't exist
        if(!data.Item) {
          console.error('User doesn\'t exist.');
          return done(null, false);
        }

        // compare password with stored hash from database using bcrypt
        bcrypt.compare(password, data.Item.password, function(err, res) {
          // bcrypt error
          if(err) {
            console.error('Error comparing passwords.\n' + JSON.stringify(err));
            return done(err);
          }
          // correct match, successfully logged in
          if(res) {
            return done(null, data.Item);
          }
          // password mismatch
          return done(null, false);
        });
      });
    });
  }));

  return passport;
};
