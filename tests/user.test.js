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
          username: 'username'
        }
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
