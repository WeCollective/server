'use strict';

// REQUIRE MODULES
var express    = require("express");          // call express
var app        = express();                   // define our app using express
var bodyParser = require("body-parser");      // reading request bodies
var AWS = require("aws-sdk");                 // interfacing with AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
  region: "eu-west-1",
  sslEnabled: true,
  logger: process.stdout
});
var db = require("./config/database.js");
var docClient = new AWS.DynamoDB.DocumentClient();

// SET ENVIRONMENT AND PORT
var env = (process.env.NODE_ENV || "development");
var port = process.env.PORT || 8081;

// MIDDLEWARE
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Test putting an object in the DB
var table = "Users";
var params = {
  TableName: db.Table.Users,
  Item: {
    "id": 1,
    "username": "TestUser1"
  }
};
docClient.put(params, function(err, data) {
  if (err) {
    console.error("Unable to add item. Error JSON:", JSON.stringify(err));
  } else {
    console.log("Success!");
  }
});

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
