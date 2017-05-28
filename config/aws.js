const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
  logger: 'test' === process.env.NODE_ENV ? undefined : process.stdout,
  region: 'eu-west-1',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
  sslEnabled: true
});

module.exports = {
  dbClient: new AWS.DynamoDB.DocumentClient(),
  s3Client: new AWS.S3()
};