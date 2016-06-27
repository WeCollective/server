var AWS = require("aws-sdk");

// CONFIGURE AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
  region: "eu-west-1",
  sslEnabled: true,
  logger: process.env.NODE_ENV == "test" ? undefined : process.stdout
});

module.exports = {
  dbClient: new AWS.DynamoDB.DocumentClient()
};
