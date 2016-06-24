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
      .expect({ message: 'Invalid first name' }, done);
  });
  it('should return invalid last name (too short)', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('firstname=John')
      .send('lastname=a')
      .expect(400)
      .expect({ message: 'Invalid last name' }, done);
  });
  it('should return successful sign up', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email@test.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(200, done);
  });
  it('should return username already exists', function(done) {
    server.post('/user')
      .send('username=username')
      .send('password=password')
      .send('email=email@test.com')
      .send('firstname=John')
      .send('lastname=Smith')
      .expect(400)
      .expect({ message: 'Username already exists' }, done);
  });
};
