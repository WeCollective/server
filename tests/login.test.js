module.exports = function(server) {
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
};
