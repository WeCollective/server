process.env.NODE_ENV = 'test';

var app = require('../server.js');
var supertest = require("supertest");
var should = require("should");
var server = supertest.agent(app);
var port = process.env.PORT || 8081;


describe('Basic API test', function() {
  it('should return welcome message', function(done) {
    server.get('/')
      .expect(200)
      .expect({ message: 'Welcome to the WECO API!' }, done);
  });
});

describe('Sign up test', function() {
  it('should return invalid username (too long)', function(done) {
    server.post('/user')
      .send('username=thisusernameiswaytoolong')
      .send('password=password')
      .send('email=test@email.com')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid password (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=pass word')
      .send('email=test@email.com')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('should return invalid password (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=pass')
      .send('email=test@email.com')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('should return invalid password (too long)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=thispasswordiswaywaywaywaytoolong')
      .send('email=test@email.com')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('should return invalid email (incorrect format)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email')
      .expect(400)
      .expect({ message: 'Invalid email' }, done);
  });
  it('should return successful sign up', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email@test.com')
      .expect(200, done);
  });
  it('should return username already exists', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email@test.com')
      .expect(400)
      .expect({ message: 'Username already exists' }, done);
  });
});

describe('Login test', function() {
  it('should return user doesn\'t exist', function(done) {
    server.post('/user/login')
      .send('username=unknownuser')
      .send('password=password')
      .expect(400)
      .expect({ message: 'User doesn\'t exist' }, done);
  });
  it('should return password mismatch', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=wrongpassword')
      .expect(400)
      .expect({ message: 'Password mismatch' }, done);
  });
  it('should return successful login', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should return successful logout', function(done) {
    server.get('/user/logout')
      .expect(200, done);
  });
});

describe('User test', function() {
  it('should return not authenticated', function(done) {
    server.get('/user/me')
      .expect(403)
      .expect({ message: 'Access denied' }, done);
  });
  it('should return successful login', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should return user object (me)', function(done) {
    server.get('/user/me')
      .expect(200)
      .expect({ username: 'username' }, done);
  });
});
