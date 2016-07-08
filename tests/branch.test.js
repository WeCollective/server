module.exports = function(server) {
  it('should return not authenticated', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=branch')
      .expect(403)
      .expect({ message: 'Access denied' }, done);
  });
  it('should return successful sign up', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('should return invalid id (too long)', function(done) {
    server.post('/branch')
      .send('id=thisbranchparamiswaytoolongforthis')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid id' }, done);
  });
  it('should return invalid id (contains whitespace)', function(done) {
    server.post('/branch')
      .send('id=branch id')
      .send('name=branch')
      .expect(400)
      .expect({ message: 'Invalid id' }, done);
  });
  it('should return invalid name (too long)', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=thisbranchparamiswaytoolongforthis')
      .expect(400)
      .expect({ message: 'Invalid name' }, done);
  });
  it('should return successful branch creation', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=Branch Name')
      .expect(200, done);
  });
  it('should return invalid id (already taken)', function(done) {
    server.post('/branch')
      .send('id=branch')
      .send('name=Branch Name')
      .expect(400)
      .expect({ message: 'That Unique Name is already taken' }, done);
  });
  it('should return branch not found', function(done) {
    server.get('/branch/missingbranch')
      .expect(404, done);
  });
  it('should return succesfully fetched branch', function(done) {
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
  it('should return invalid name update (too long)', function(done) {
    server.put('/branch/branch')
      .send('name=thisbranchparamiswaytoolongforthis')
      .expect(400)
      .expect({ message: 'Invalid name' }, done);
  });
  it('should return valid update', function(done) {
    server.put('/branch/branch')
      .send('name=New Name')
      .send('rules=These are\nmultiline\n\nrules!')
      .send('description=This is a\nmultiline\n\ndescription!')
      .expect(200, done);
  });
  it('should return correct updated values', function(done) {
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
  it('should delete user (me)', function(done) {
    server.delete('/user/me')
      .expect(200)
      .expect({ message: 'Success' }, done);
  });
};
