'use strict';

// REQUIRE MODULES
var express    = require("express");              // call express
var app        = express();                       // define our app using express
var helmet = require('helmet');                   // protect against common web vulnerabilities
var bodyParser = require("body-parser");          // reading request bodies
var cookieParser = require('cookie-parser');      // reading cookies
var passport = require('passport');               // authentication
var session      = require('express-session');    // session middleware
var DynamoDBStore = require('connect-dynamodb')({ // dynamodb session store
  session: session
});
var AWS = require("aws-sdk");                     // interfacing with AWS

// CONFIGURE AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
  region: "eu-west-1",
  sslEnabled: true,
  logger: process.stdout
});
var db = require("./config/database.js")(AWS);

// SET ENVIRONMENT AND PORT
var env = (process.env.NODE_ENV || "development");
var port = process.env.PORT || 8081;

// MIDDLEWARE
app.use(helmet());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// CROSS ORIGIN RESOURCE SHARING
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// AUTHENTICATION AND SESSION MANAGEMENT
var options = {
    table: db.Table.Sessions,
    AWSConfigJSON: {
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API
      },
      region: 'eu-west-1',
      sslEnabled: true,
      logger: process.stdout
    },
    reapInterval: 600000  // clean up expired sessions every 10 mins
};
app.use(session({
  store: new DynamoDBStore(options),
  secret: 'secret',
  resave: true,
  saveUninitialized: true
}));
passport = require('./config/passport')(passport, db);
app.use(passport.initialize());
app.use(passport.session());

var apiRouter = require('./router.js')(app, passport);
app.use('/', apiRouter);

// DUMMY API ROUTE
app.get('/', function(req, res) {
  res.statusCode = 200;
  var success = {
    message: "Welcome to the WECO API! env: " + env
  };
  res.send(success);
});

// START THE SERVER
app.listen(port);
console.log('Magic happens on port ' + port);
