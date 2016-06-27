module.exports = function(server) {
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
      .expect({
        message: 'Success',
        data: {
          username: 'username',
          name: {
            first: 'John',
            last: 'Smith'
          },
          email: 'test@email.com'
        }
      }, done);
  });
  it('should fail to update user (me) invalid firstname', function(done) {
    server.put('/user/me')
      .send('firstname=a')
      .expect(400)
      .expect({
        message: 'The server could not process the request'
      }, done);
  });
  it('should fail to update user (me) invalid lastname', function(done) {
    server.put('/user/me')
      .send('lastname=a')
      .expect(400)
      .expect({
        message: 'The server could not process the request'
      }, done);
  });
  it('should fail to update user (me) invalid email', function(done) {
    server.put('/user/me')
      .send('email=email')
      .expect(400)
      .expect({
        message: 'The server could not process the request'
      }, done);
  });
  it('should update user (me)', function(done) {
    server.put('/user/me')
      .send('firstname=Joe')
      .send('lastname=Bloggs')
      .send('email=new@email.com')
      .expect(200)
      .expect({
        message: 'Success'
      }, done);
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
  it('should fail to fetch user (me)', function(done) {
    server.get('/user/me')
      .expect(403)
      .expect({ message: 'Access denied' }, done);
  });
  it('should fail login as deleted user', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(400)
      .expect({ message: 'User doesn\'t exist' }, done);
  });
};
