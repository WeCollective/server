module.exports = function(server) {
  it('should not be authenticated', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('parentid=root')
      .send('name=branch')
      .expect(403)
      .expect({ message: 'Access denied' }, done);
  });
  it('should successfully sign up as username1', function(done) {
    server.post('/user')
      .send('username=username1')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('branch A should be successfully created', function(done) {
    server.post('/branch')
      .send('id=a')
      .send('parentid=root')
      .send('name=A')
      .expect(200, done);
  });
  it('branch B should be successfully created', function(done) {
    server.post('/branch')
      .send('id=b')
      .send('parentid=a')
      .send('name=B')
      .expect(200, done);
  });
  it('should successfully get branch B, parent is root', function(done) {
    server.get('/branch/b')
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
          id: 'b',
          name: 'B',
          creator: 'username1',
          date: 0,
          parentid: 'root',
          rules: null,
          description: null
        }
      })
      .end(done);
  });
  it('should successfully sign up as username2', function(done) {
    server.post('/user')
      .send('username=username2')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('should fail to accept subbranch request on A', function(done) {
    server.put('/branch/a/requests/subbranches/b')
      .send('action=accept')
      .expect(403, done);
  });
  it('branch C should be successfully created', function(done) {
    server.post('/branch')
      .send('id=c')
      .send('parentid=b')
      .send('name=C')
      .expect(200, done);
  });
  it('should login successfully as username1', function(done) {
    server.post('/user/login')
      .send('username=username1')
      .send('password=password')
      .expect(200, done);
  });
  it('should successfully accept subbranch request on A', function(done) {
    server.put('/branch/a/requests/subbranches/b')
      .send('action=accept')
      .expect(200, done);
  });
  it('should successfully accept subbranch request on B', function(done) {
    server.put('/branch/b/requests/subbranches/c')
      .send('action=accept')
      .expect(200, done);
  });
  it('should successfully get branch B, parent is A', function(done) {
    server.get('/branch/b')
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
          id: 'b',
          name: 'B',
          creator: 'username1',
          date: 0,
          parentid: 'a',
          rules: null,
          description: null
        }
      })
      .end(done);
  });
  it('should successfully get branch C, parent is B', function(done) {
    server.get('/branch/c')
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
          id: 'c',
          name: 'C',
          creator: 'username2',
          date: 0,
          parentid: 'b',
          rules: null,
          description: null
        }
      })
      .end(done);
  });
  it('should fail to make subbranch request to C from A', function(done) {
    server.post('/branch/c/requests/subbranches/a')
      .expect(400, done);
  });
  it('branch D should be successfully created', function(done) {
    server.post('/branch')
      .send('id=d')
      .send('parentid=c')
      .send('name=D')
      .expect(200, done);
  });
  it('should login successfully as username2', function(done) {
    server.post('/user/login')
      .send('username=username2')
      .send('password=password')
      .expect(200, done);
  });
  it('should successfully reject subbranch request on C', function(done) {
    server.put('/branch/c/requests/subbranches/d')
      .send('action=reject')
      .expect(200, done);
  });
  it('should successfully get branch D, parent is root', function(done) {
    server.get('/branch/d')
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
          id: 'd',
          name: 'D',
          creator: 'username1',
          date: 0,
          parentid: 'root',
          rules: null,
          description: null
        }
      })
      .end(done);
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
  it('should login successfully as username1', function(done) {
    server.post('/user/login')
      .send('username=username1')
      .send('password=password')
      .expect(200, done);
  });
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
};
