module.exports = function(server) {
  it('should return invalid username (too long)', function(done) {
    server.post('/user')
      .send('username=thisusernameiswaytoolong')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid username (banned word: \'orig\')', function(done) {
    server.post('/user')
      .send('username=orig')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid username (banned word: \'me\')', function(done) {
    server.post('/user')
      .send('username=me')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid username (banned word: \'picture\')', function(done) {
    server.post('/user')
      .send('username=picture')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid username (banned word: \'cover\')', function(done) {
    server.post('/user')
      .send('username=cover')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid username (numeric)', function(done) {
    server.post('/user')
      .send('username=123')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid username' }, done);
  });
  it('should return invalid password (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=pass word')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('should return invalid password (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=pass')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('should return invalid password (too long)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=thispasswordiswaywaywaywaytoolong')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid password' }, done);
  });
  it('should return invalid email (incorrect format)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid email' }, done);
  });
  it('should return invalid first name (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=a')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid firstname' }, done);
  });
  it('should return invalid first name (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=white space')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Invalid firstname' }, done);
  });
  it('should return invalid last name (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=a')
      .expect(400)
      .expect({ message: 'Invalid lastname' }, done);
  });
  it('should return invalid last name (contains whitespace)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=white space')
      .expect(400)
      .expect({ message: 'Invalid lastname' }, done);
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
  it('should return username already exists', function(done) {
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
