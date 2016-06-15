'use strict';

// REQUIRE MODULES
var express    = require('express');          // call express
var app        = express();                   // define our app using express
var bodyParser = require('body-parser');      // reading request bodies

// SET ENVIRONMENT AND PORT
var env = (process.env.NODE_ENV || "development");
var port = process.env.PORT || 8081;

// MIDDLEWARE
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// URL TO LOG IN WITH FACEBOOK
app.get('/', function(req, res) {
  res.send("Welcome to the WECO API!");
});

// START THE SERVER
app.listen(port);
console.log('Magic happens on port ' + port);
