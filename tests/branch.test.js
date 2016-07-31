module.exports = function(server) {
  it('should not be authenticated', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=root')
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
      .send('parentid=root')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid id' }, done);
  });
  it('id should be invalid (contains whitespace)', function(done) {
    server.post('/branch')
      .send('id=branch id')
      .send('parentid=root')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid id' }, done);
  });
  it('name should be invalid (too long)', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=root')
      .send('name=thisbranchparamiswaytoolongforthis')
      .expect(400)
      .expect({ message: 'Invalid name' }, done);
  });
  it('parentid should be reserved word', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=none')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid parentid' }, done);
  });
  it('parentid should not be found', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=unknown')
      .send('name=branch')
      .expect(404, done);
  });
  it('missing parentid', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=branch')
      .expect(400, done);
  });
  it('branch should be successfully created', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=root')
      .send('name=Branch Name')
      .expect(200, done);
  });
  it('id should be invalid (already taken)', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=root')
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
  it('should successfully fetch mods', function(done) {
    server.get('/branch/branch/mods')
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data[0].date)) {
          res.body.data[0].date = 0;
        }
      })
      .expect({
        message: 'Success',
        data: [{
          branchid: 'branch',
          date: 0,
          username: 'username'
        }]
      })
      .end(done);
  });
  it('should fail add new mod (not mod)', function(done) {
    server.post('/branch/branch/mods')
      .send('username=username2')
      .expect(403, done);
  });
  it('should login successfully as mod', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should fail to add non-existent user as mod', function(done) {
    server.post('/branch/branch/mods')
      .send('username=nobody')
      .expect(404, done);
  });
  it('should fail to add existing mod to mod list', function(done) {
    server.post('/branch/branch/mods')
      .send('username=username')
      .expect(400, done);
  });
  it('should successfully add new mod', function(done) {
    server.post('/branch/branch/mods')
      .send('username=username2')
      .expect(200, done);
  });
  it('should login successfully as new mod', function(done) {
    server.post('/user/login')
      .send('username=username2')
      .send('password=password')
      .expect(200, done);
  });
  it('should fail to delete mod added before self', function(done) {
    server.delete('/branch/branch/mods/username')
      .expect(403, done);
  });
  it('should login successfully as original mod', function(done) {
    server.post('/user/login')
      .send('username=username')
      .send('password=password')
      .expect(200, done);
  });
  it('should successfully delete mod added after self', function(done) {
    server.delete('/branch/branch/mods/username2')
      .expect(200, done);
  });
  it('mod log should reflect these recent operations', function(done) {
    server.get('/branch/branch/modlog')
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data[0].date)) {
          res.body.data[0].date = 0;
        }
        if(Number(res.body.data[1].date)) {
          res.body.data[1].date = 0;
        }
      })
      .expect({
        message: 'Success',
        data: [{
          branchid: 'branch',
          date: 0,
          action: 'removemod',
          username: 'username',
          data: 'username2'
        }, {
          branchid: 'branch',
          date: 0,
          action: 'addmod',
          username: 'username',
          data: 'username2'
        }]
      })
      .end(done);
  });

  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
  it('should login successfully', function(done) {
    server.post('/user/login')
      .send('username=username2')
      .send('password=password')
      .expect(200, done);
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
  it('should login successfully as admin', function(done) {
    server.post('/user/login')
      .send('username=mikechristensen')
      .send('password=password')
      .expect(200, done);
  });
  it('should successfully delete branch', function(done) {
    server.delete('/branch/branch')
      .expect(200, done);
  });
  it('should successfully logout', function(done) {
    server.get('/user/logout')
      .expect(200, done);
  });
};
