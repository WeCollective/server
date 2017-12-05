module.exports = server => {
  it('user should not exist', done => {
    server.post('/v1/user/login')
      .send('username=unknownuser')
      .send('password=password')
      .expect(400)
      .expect({ message: 'User doesn\'t exist' }, done);
  });

  it('password should not match', done => {
    server.post('/v1/user/login')
      .send('username=username')
      .send('password=wrongpassword')
      .expect(400)
      .expect({ message: 'Password mismatch' }, done);
  });

  it('should login successfully', done => {
    server.post('/v1/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });

  it('should logout successfully', done => {
    server.get('/v1/user/logout')
      .expect(200, done);
  });
};
