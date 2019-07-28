const AWS = require('aws-sdk');

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
  logger: process.env.NODE_ENV ? undefined : process.stdout === 'test',
  region: 'eu-west-1',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
  sslEnabled: true,
});

var local = !!process.env.NODE_ENV;
module.exports = {
  dbClient: local? new AWS.DynamoDB.DocumentClient({service:new AWS.DynamoDB({  endpoint: 'http://localhost:4569'})})
    : new AWS.DynamoDB.DocumentClient(),
  s3Client: local? new AWS.S3({   endpoint: 'http://localhost:4572', s3ForcePathStyle: true }) : new AWS.S3(),
  s3Path: local? 'localhost:4572/' :'.s3-eu-west-1.amazonaws.com/',
  s3Cert: local? 'http://' : 'https://',
  s3Local: local,
  getRootPath : (bucket) => {
    var pth = local? 'localhost:4572/' :'.s3-eu-west-1.amazonaws.com/';
    var cert = local? 'http://' : 'https://';
    if(local){
      //localpath
      return `${cert}${pth}${bucket}/`;
    }
    else
    {
      return `${cert}${bucket}${pth}`;
      //server path s3
    }
  },
};
