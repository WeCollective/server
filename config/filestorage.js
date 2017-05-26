'use strict';

const S3Config = {
  Bucket: {
    BranchImages: 'weco-branch-images',
    BranchImagesResized: 'weco-branch-images-resized',
    PostImages: 'weco-post-images',
    PostImagesResized: 'weco-post-images-resized',
    UserImages: 'weco-user-images',
    UserImagesResized: 'weco-user-images-resized'
  }
};

// If in a development environment we should use the development tables.
// Iterate over S3Config object and append the prefix 'dev-' to all table names.
if ('production' !== process.env.NODE_ENV) {
  for (const name in S3Config.Bucket) {
    if (S3Config.Bucket.hasOwnProperty(name)) {
      S3Config.Bucket[name] = `dev-${S3Config.Bucket[name]}`;
    }
  }
}

module.exports = config;