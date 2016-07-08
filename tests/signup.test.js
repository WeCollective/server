module.exports = function(server) {
  it('username should be too long', function(done) {
    server.post('/user')
      .send('username=thisusernameiswaytoolong')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('username should be invalid (banned word: \'orig\')', function(done) {
    server.post('/user')
      .send('username=orig')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('username should be invalid (banned word: \'me\')', function(done) {
    server.post('/user')
      .send('username=me')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('username should be invalid (banned word: \'picture\')', function(done) {
    server.post('/user')
      .send('username=picture')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('username should be invalid (banned word: \'cover\')', function(done) {
    server.post('/user')
      .send('username=cover')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('username should be invalid (numeric)', function(done) {
    server.post('/user')
      .send('username=123')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('password should be invalid (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=pass word')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('password should be invalid (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=pass')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('password should be invalid (too long)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=thispasswordiswaywaywaywaytoolong')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('email should be invalid (incorrect format)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid email' }, done);
  });
  it('first name should be invalid (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=a')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid firstname' }, done);
  });
  it('first name should be invalid (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=white space')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid firstname' }, done);
  });
  it('last name should be invalid (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=a')
      .expect(400)
      .expect({ message: 'Invalid lastname' }, done);
  });
  it('last name should be invalid (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=white space')
      .expect(400)
      .expect({ message: 'Invalid lastname' }, done);
  });
  it('should sign up successfully', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('user should already exist', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Username already exists' }, done);
  });
};
