process.env.NODE_ENV = 'test';

var app = require('../server.js');
var supertest = require("supertest");
var should = require("should");
var server = supertest.agent(app);
var port = process.env.PORT || 8081;

function importTest(name, path) {
  describe(name, function () {
    require(path)(server);
  });
}

describe('API test', function() {
  it('should return welcome message', function(done) {
    server.get('/')
      .expect(200)
      .expect({ message: 'Welcome to the WECO API!' }, done);
  });

  importTest('Sign up test', './signup.test.js');
  importTest('Login test', './login.test.js');
  importTest('User test', './user.test.js');
});
