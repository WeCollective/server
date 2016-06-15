'use strict';

// REQUIRE MODULES
var express    = require('express');          // call express
var app        = express();                   // define our app using express
var bodyParser = require('body-parser');      // reading request bodies
var AWS = require("aws-sdk");                 // interfacing with AWS
console.log("Keys:");
console.log(process.env.AWS_ACCESS_KEY_ID_WECO_API);
console.log(process.env.AWS_SECRET_ACCESS_KEY_WECO_API);
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
  region: "eu-west-1",
  sslEnabled: true,
  logger: process.stdout
});

var docClient = new AWS.DynamoDB.DocumentClient();
var table = "Users";
var year = 2015;
var title = "The Big New Movie";

var params = {
  TableName: "Users",
  Item: {
    "id": 1,
    "username": "TestUser1"
  }
};

console.log("Adding a new item...");
docClient.put(params, function(err, data) {
    if (err) {
      console.error("Unable to add item. Error JSON:", JSON.stringify(err));
    } else {
      console.log("Success!");
    }
});

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
