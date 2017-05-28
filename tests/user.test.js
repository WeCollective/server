module.exports = function(server) {
  it('should not be authenticated', function(done) {
    server.get('/user/me')
      .expect(403)
      .expect({ message: 'Access denied' }, done);
  });
  it('should login successfully', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should successfully get user (me)', function(done) {
    server.get('/user/me')
      .expect(200)
      .expect(function(res) {
        // if valid datejoined, set to 0 for the next expect statement
        if(Number(res.body.data.datejoined)) {
          res.body.data.datejoined = 0;
        }
        // if valid dob, set to 0 for the next expect statement
        if(Number(res.body.data.dob) || res.body.data.dob == null) {
          res.body.data.dob = 0;
        }
      })
      .expect({
        message: 'Success',
        data: {
          datejoined: 0,
          dob: 0,
          email: 'test@email.com',
          name: 'John',
          username: 'username'
        }
      })
      .end(done);
  });
  it('should sign up successfully', function(done) {
    server.post('/user')
      .send('username=username2')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=John')
      .expect(200, done);
  });
  it('should successfully get user (someone else)', function(done) {
    server.get('/user/username')
      .expect(200)
      .expect(function(res) {
        // if valid datejoined, set to 0 for the next expect statement
        if(Number(res.body.data.datejoined)) {
          res.body.data.datejoined = 0;
        }
        // if valid dob, set to 0 for the next expect statement
        if(Number(res.body.data.dob) || res.body.data.dob == null) {
          res.body.data.dob = 0;
        }
      })
      .expect({
        message: 'Success',
        data: {
          datejoined: 0,
          dob: 0,
          name: 'John',
          username: 'username'
        }
      })
      .end(done);
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
  it('should successfully get user when logged out', function(done) {
    server.get('/user/username')
      .expect(200)
      .expect(function(res) {
        // if valid datejoined, set to 0 for the next expect statement
        if(Number(res.body.data.datejoined)) {
          res.body.data.datejoined = 0;
        }
        // if valid dob, set to 0 for the next expect statement
        if(Number(res.body.data.dob) || res.body.data.dob == null) {
          res.body.data.dob = 0;
        }
      })
      .expect({
        message: 'Success',
        data: {
          datejoined: 0,
          dob: 0,
          name: 'John',
          username: 'username'
        }
      })
      .end(done);
  });
  it('should login successfully', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should fail to update user (me) invalid name', function(done) {
    server.put('/user/me')
      .send('name=a')
      .expect(400)
      .expect({
        message: 'Invalid name'
      }, done);
  });
  it('should fail to update user (me) invalid lastname', function(done) {
    server.put('/user/me')
      .send('lastname=a')
      .expect(400)
      .expect({
        message: 'Invalid lastname'
      }, done);
  });
  it('should fail to update user (me) invalid email', function(done) {
    server.put('/user/me')
      .send('email=email')
      .expect(400)
      .expect({
        message: 'Invalid email'
      }, done);
  });
  it('should update user (me)', function(done) {
    server.put('/user/me')
      .send('name=Joe')
      .send('email=new@email.com')
      .expect(200)
      .expect({
        message: 'Success'
      }, done);
  });
  it('should get profile picture upload url', function(done) {
    server.get('/user/me/picture-upload-url')
      .expect(200, done);
  });
  it('should get cover picture upload url', function(done) {
    server.get('/user/me/cover-upload-url')
      .expect(200, done);
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
  it('should fail to get non-existent user', function(done) {
    server.get('/user/doesntexist')
      .expect(404, done);
  });
};
