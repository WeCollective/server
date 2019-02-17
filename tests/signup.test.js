module.exports = server => {
  it('username should be too long', done => {
    server.post('/v1/user')
      .send('username=thisusernameiswaytoolong')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Invalid username' }, done);
  });

  const bannedArr = [
    'orig',
    'me',
    'picture',
    'cover',
  ];

  bannedArr.forEach(banned => {
    it(`username should be invalid (banned word: '${banned}')`, done => {
      server.post('/v1/user')
        .send(`username=${banned}`)
        .send('password=password')
        .send('email=test@email.com')
        .send('name=John')
        .expect(400, done)
        // .expect({ message: 'Invalid username' }, done);
    });
  });

  it('username should be invalid (numeric)', done => {
    server.post('/v1/user')
      .send('username=123')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Invalid username' }, done);
  });

  it('password should be invalid (contains whitespace)', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=pass word')
      .send('email=test@email.com')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Invalid password' }, done);
  });

  it('password should be invalid (too short)', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=pass')
      .send('email=test@email.com')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Invalid password' }, done);
  });

  it('password should be invalid (too long)', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=thispasswordiswaywaywaywaytoolong')
      .send('email=test@email.com')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Invalid password' }, done);
  });

  it('email should be invalid (incorrect format)', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=password')
      .send('email=email')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Invalid email' }, done);
  });

  it('name should be invalid (too short)', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=a')
      .expect(400, done)
      // .expect({ message: 'Invalid name' }, done);
  });

  it('name should be invalid (contains whitespace)', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=white space')
      .expect(400, done)
      // .expect({ message: 'Invalid name' }, done);
  });

  it('should sign up successfully', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=John')
      .expect(200, done);
  });

  it('user should already exist', done => {
    server.post('/v1/user')
      .send('username=username')
      .send('password=password')
      .send('email=test@email.com')
      .send('name=John')
      .expect(400, done)
      // .expect({ message: 'Username already exists.' }, done);
  });

};
