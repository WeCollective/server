process.env.NODE_ENV = 'test';

const app = require('../server.js');
const supertest = require('supertest');
const server = supertest.agent(app);
// const port = process.env.PORT || 8081;
// const should = require('should');

const importTest = (name, path) => {
  describe(name, function () {
    require(path)(server);
  });
};

describe('API test', function() {
  importTest('Sign up test', './signup.test.js');
  importTest('Login test', './login.test.js');
  // importTest('User test', './user.test.js');
  // importTest('Branch test', './branch.test.js');
  // importTest('SubBranch test', './subbranch.test.js');
  // importTest('Post test', './post.test.js');
});
