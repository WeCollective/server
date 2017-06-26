'use strict';

const S3Config = {
  Bucket: {
    BranchImages:        'weco-branch-images',
    BranchImagesResized: 'weco-branch-images-resized',
    PostImages:          'weco-post-images',
    PostImagesResized:   'weco-post-images-resized',
    UserImages:          'weco-user-images',
    UserImagesResized:   'weco-user-images-resized'
  }
};

// Use development tables in the development environment.
if ('production' !== process.env.NODE_ENV) {
  for (const name in S3Config.Bucket) {
    if (S3Config.Bucket.hasOwnProperty(name)) {
      S3Config.Bucket[name] = `dev-${S3Config.Bucket[name]}`;
    }
  }
}

module.exports = S3Config;
