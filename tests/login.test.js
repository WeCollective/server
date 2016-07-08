module.exports = function(server) {
  it('user should not exist', function(done) {
    server.post('/user/login')
      .send('username=unknownuser')
      .send('password=password')
      .expect(400)
      .expect({ message: 'User doesn\'t exist' }, done);
  });
  it('password should not match', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=wrongpassword')
      .expect(400)
      .expect({ message: 'Password mismatch' }, done);
  });
  it('should login successfully', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should logout successfully', function(done) {
    server.get('/user/logout')
      .expect(200, done);
  });
};
