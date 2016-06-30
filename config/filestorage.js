'use strict';

// S3 config info.
var config = {
  // Bucket names
  Bucket: {
    UserImages: 'weco-user-images'
  }
}

// If in a development environment we should user the development tables.
// Iterate over config object and append the prefix 'dev' to all table names.
if(process.env.NODE_ENV != 'production') {
  for(var name in config.Bucket) {
    if(config.Bucket.hasOwnProperty(name)) {
      config.Bucket[name] = 'dev-' + config.Bucket[name];
    }
  }
}

module.exports = config;
