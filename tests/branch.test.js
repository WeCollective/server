module.exports = function(server) {
  it('should not be authenticated', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=branch')
      .expect(403)
      .expect({ message: 'Access denied' }, done);
  });
  it('should successfully sign up', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('id should be invalid (too long)', function(done) {
    server.post('/branch')
      .send('id=thisbranchparamiswaytoolongforthis')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid id' }, done);
  });
  it('id should be invalid (contains whitespace)', function(done) {
    server.post('/branch')
      .send('id=branch id')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid id' }, done);
  });
  it('name should be invalid (too long)', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=thisbranchparamiswaytoolongforthis')
      .expect(400)
      .expect({ message: 'Invalid name' }, done);
  });
  it('branch should be succesfully created', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=Branch Name')
      .expect(200, done);
  });
  it('id should be invalid (already taken)', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=Branch Name')
      .expect(400)
      .expect({ message: 'That Unique Name is already taken' }, done);
  });
  it('branch should be not found', function(done) {
    server.get('/branch/missingbranch')
      .expect(404, done);
  });
  it('should successfully get branch', function(done) {
    server.get('/branch/branch')
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data.date)) {
          res.body.data.date = 0;
        }
      })
      .expect({
        message: 'Success',
        data: {
          id: 'branch',
          name: 'Branch Name',
          mods: ['username'],
          creator: 'username',
          date: 0,
          parentid: 'root',
          rules: null,
          description: null
        }
      })
      .end(done);
  });
  it('updated name should be invalid (too long)', function(done) {
    server.put('/branch/branch')
      .send('name=thisbranchparamiswaytoolongforthis')
      .expect(400)
      .expect({ message: 'Invalid name' }, done);
  });
  it('update should be successful', function(done) {
    server.put('/branch/branch')
      .send('name=New Name')
      .send('rules=These are\nmultiline\n\nrules!')
      .send('description=This is a\nmultiline\n\ndescription!')
      .expect(200, done);
  });
  it('updated values should be correct', function(done) {
    server.get('/branch/branch')
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data.date)) {
          res.body.data.date = 0;
        }
      })
      .expect({
        message: 'Success',
        data: {
          id: 'branch',
          name: 'New Name',
          mods: ['username'],
          creator: 'username',
          date: 0,
          parentid: 'root',
          rules: 'These are\nmultiline\n\nrules!',
          description: 'This is a\nmultiline\n\ndescription!'
        }
      })
      .end(done);
  });
  it('should logout successfully', function(done) {
    server.get('/user/logout')
      .expect(200, done);
  });
  it('fail to update branch (logged out)', function(done) {
    server.put('/branch/branch')
      .send('name=Branch Name')
      .expect(403, done)
  });
  it('fail to get branch picture upload url (logged out)', function(done) {
    server.get('/branch/branch/picture-upload-url')
      .expect(403, done)
  });
  it('fail to get branch cover upload url (logged out)', function(done) {
    server.get('/branch/branch/cover-upload-url')
      .expect(403, done)
  });
  it('should sign up successfully', function(done) {
    server.post('/user')
      .send('username=username2')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('fail to update branch (not mod)', function(done) {
    server.put('/branch/branch')
      .send('name=Branch Name')
      .expect(403, done)
  });
  it('fail to get branch picture upload url (not mod)', function(done) {
    server.get('/branch/branch/picture-upload-url')
      .expect(403, done)
  });
  it('fail to get branch cover upload url (not mod)', function(done) {
    server.get('/branch/branch/cover-upload-url')
      .expect(403, done)
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
  it('should login successfully', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
};
