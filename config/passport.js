var LocalStrategy = require('passport-local').Strategy;
var bcrypt = require('bcryptjs');
var db = require('./database.js');

// Check whether a string is an email using regex and the RFC822 spec
function isEmail(email) {
  return /^([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x22([^\x0d\x22\x5c\x80-\xff]|\x5c[\x00-\x7f])*\x22))*\x40([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d)(\x2e([^\x00-\x20\x22\x28\x29\x2c\x2e\x3a-\x3c\x3e\x40\x5b-\x5d\x7f-\xff]+|\x5b([^\x0d\x5b-\x5d\x80-\xff]|\x5c[\x00-\x7f])*\x5d))*$/.test( email );
}

module.exports = function(passport, dbClient) {
  passport.serializeUser(function(user, done) {
    done(null, user.username);
  });
  passport.deserializeUser(function(username, done) {
    dbClient.get({
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
      // ensure username length is over 1 char and less than 20
      username = username.trim();
      if(!username || username.length < 1 || username.length > 20) {
        console.error('Invalid username.');
        return done(null, false, { status: 400, message: 'Invalid username' });
      }

      // ensure password contains no whitespace
      if(/\s/g.test(password)) {
        console.error('Password contains whitespace.');
        return done(null, false, { status: 400, message: 'Invalid password' });
      }

      // ensure password length is at least 6 characters and at most 30
      if(!password || password.length < 6 || password.length > 30) {
        console.error('Password must be at least 6 characters and at most 30 characters long.');
        return done(null, false, { status: 400, message: 'Invalid password' });
      }

      // check whether a user with this username already exists in the database
      dbClient.get({
        TableName: db.Table.Users,
        Key: {
          'username': username
        }
      }, function(err, data) {
        // database error
        if(err) {
          console.error('Error fetching user.\n' + JSON.stringify(err));
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }

        // a user with this username already exists
        if(data.Item) {
          console.error('Username already exists.');
          return done(null, false, { status: 400, message: 'Username already exists' });
        }

        // check for a valid email address
        if(!req.body.email || !isEmail(req.body.email)) {
          console.error('Invalid email.');
          return done(null, false, { status: 400, message: 'Invalid email' });
        }

        // check for a valid first name
        if(!req.body.firstname || req.body.firstname.length < 2 || req.body.firstname.length > 30) {
          console.error('Invalid first name.');
          return done(null, false, { status: 400, message: 'Invalid first name' });
        }

        // check for a valid last name
        if(!req.body.lastname || req.body.lastname.length < 2 || req.body.lastname.length > 30) {
          console.error('Invalid last name.');
          return done(null, false, { status: 400, message: 'Invalid last name' });
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
            dbClient.put({
              TableName: db.Table.Users,
              Item: user
            }, function(err, data) {
              // database error
              if(err) {
                console.error('Error creating user.\n' + JSON.stringify(err));
                return done(err, false, { status: 500, message: 'Something went wrong' });
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
      dbClient.get({
        TableName: db.Table.Users,
        Key: {
          'username': username
        }
      }, function(err, data) {
        // database error
        if(err) {
          console.error('Error fetching user.\n' + JSON.stringify(err));
          return done(err, false, { status: 500, message: 'Something went wrong' });
        }

        // user doesn't exist
        if(!data.Item) {
          console.error('User doesn\'t exist.');
          return done(null, false, { status: 400, message: 'User doesn\'t exist' });
        }

        // compare password with stored hash from database using bcrypt
        bcrypt.compare(password, data.Item.password, function(err, res) {
          // bcrypt error
          if(err) {
            console.error('Error comparing passwords.\n' + JSON.stringify(err));
            return done(err, false, { status: 500, message: 'Something went wrong' });
          }
          // correct match, successfully logged in
          if(res) {
            return done(null, data.Item);
          }
          // password mismatch
          return done(null, false, { status: 400, message: 'Password mismatch' });
        });
      });
    });
  }));

  return passport;
};
