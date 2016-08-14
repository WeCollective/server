module.exports = function(server) {
  it('should not be authenticated', function(done) {
    server.post('/post')
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
  it('branch 1 should be successfully created', function(done) {
    server.post('/branch')
      .send('id=branch1')
      .send('parentid=root')
      .send('name=Branch 1')
      .expect(200, done);
  });
  it('branch 2 should be successfully created', function(done) {
    server.post('/branch')
      .send('id=branch2')
      .send('parentid=branch1')
      .send('name=Branch 2')
      .expect(200, done);
  });
  it('should successfully accept subbranch request on branch 1', function(done) {
    server.put('/branch/branch1/requests/subbranches/branch2')
      .send('action=accept')
      .expect(200, done);
  });
  it('post should have invalid title', function(done) {
    server.post('/post')
      .send('title=')
      .send('branchids=["branch2"]')
      .send('type=text')
      .send('text=This is the post text!')
      .expect(400, done);
  });
  it('post should have invalid branchids (empty)', function(done) {
    server.post('/post')
      .send('title=Post Title')
      .send('branchids=[]')
      .send('type=text')
      .send('text=This is the post text!')
      .expect(400, done);
  });
  it('post should have invalid branchids (post to root)', function(done) {
    server.post('/post')
      .send('title=Post Title')
      .send('branchids=["root"]')
      .send('type=text')
      .send('text=This is the post text!')
      .expect(400, done);
  });
  it('post should have invalid type', function(done) {
    server.post('/post')
      .send('title=Post Title')
      .send('branchids=["branch2"]')
      .send('type=unknown')
      .send('text=This is the post text!')
      .expect(400, done);
  });
  it('post should be successfully created', function(done) {
    server.post('/post')
      .send('title=Post Title')
      .send('branchids=["branch2"]')
      .send('type=text')
      .send('text=This is the post text!')
      .expect(200, done);
  });
  var postid;
  it('should fetch posts on branch1', function(done) {
    server.get('/branch/branch1/posts')
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data[0].date)) {
          res.body.data[0].date = 0;
        }
        // store the id in an auxillary var,
        // but set it on the object to a known value for the next expect
        postid = res.body.data[0].id;
        res.body.data[0].id = 'postid';
      })
      .expect({
        message: 'Success',
        data: [{
          id: 'postid',
          date: 0,
          individual: 0,
          branchid: 'branch1',
          type: 'text'
        }]
      })
      .end(done);
  });
  it('should fetch specific post from branch1', function(done) {
    server.get('/branch/branch1/posts/' + postid)
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data[0].date)) {
          res.body.data[0].date = 0;
        }
        // store the id in an auxillary var,
        // but set it on the object to a known value for the next expect
        res.body.data[0].id = 'postid';
      })
      .expect({
        message: 'Success',
        data: [{
          id: 'postid',
          down: 0,
          up: 0,
          individual: 0,
          local: 0,
          rank: 0,
          date: 0,
          branchid: 'branch1',
          type: 'text'
        }]
      })
      .end(done);
  });
  it('should fetch specific post data', function(done) {
    server.get('/post/' + postid)
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data.date)) {
          res.body.data.date = 0;
        }
        // store the id in an auxillary var,
        // but set it on the object to a known value for the next expect
        res.body.data.id = 'postid';
      })
      .expect({
        message: 'Success',
        data: {
          id: 'postid',
          text: 'This is the post text!',
          creator: 'username',
          title: 'Post Title',
          type: 'text',
          date: 0
        }
      })
      .end(done);
  });
  it('should fail to vote on post on branch1', function(done) {
    server.put('/branch/branch1/posts/' + postid)
      .send('vote=unknown')
      .expect(400, done);
  });
  it('should up vote post on branch1', function(done) {
    server.put('/branch/branch1/posts/' + postid)
      .send('vote=up')
      .expect(200, done);
  });
  it('should up vote post on branch2', function(done) {
    server.put('/branch/branch2/posts/' + postid)
      .send('vote=up')
      .expect(200, done);
  });
  it('should up vote post on branch2 again', function(done) {
    server.put('/branch/branch2/posts/' + postid)
      .send('vote=up')
      .expect(200, done);
  });
  it('should fetch post with correct stats from branch1', function(done) {
    server.get('/branch/branch1/posts/' + postid)
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data[0].date)) {
          res.body.data[0].date = 0;
        }
        // store the id in an auxillary var,
        // but set it on the object to a known value for the next expect
        res.body.data[0].id = 'postid';
        // ignore actual stats: lambda may not have had time to update
        res.body.data[0].local = 0;
        res.body.data[0].individual = 0;
      })
      .expect({
        message: 'Success',
        data: [{
          id: 'postid',
          down: 0,
          up: 1,
          individual: 0,
          local: 0,
          rank: 0,
          date: 0,
          branchid: 'branch1',
          type: 'text'
        }]
      })
      .end(done);
  });
  it('should fetch post with correct stats from branch2', function(done) {
    server.get('/branch/branch2/posts/' + postid)
      .expect(200)
      .expect(function(res) {
        // if valid date, set to 0 for the next expect statement
        if(Number(res.body.data[0].date)) {
          res.body.data[0].date = 0;
        }
        // store the id in an auxillary var,
        // but set it on the object to a known value for the next expect
        res.body.data[0].id = 'postid';
        // ignore actual stats: lambda may not have had time to update
        res.body.data[0].local = 0;
        res.body.data[0].individual = 0;
      })
      .expect({
        message: 'Success',
        data: [{
          id: 'postid',
          down: 0,
          up: 2,
          individual: 0,
          local: 0,
          rank: 0,
          date: 0,
          branchid: 'branch2',
          type: 'text'
        }]
      })
      .end(done);
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
  it('should successfully delete branch1', function(done) {
    server.delete('/branch/branch1')
      .expect(200, done);
  });
  it('should successfully delete branch2', function(done) {
    server.delete('/branch/branch2')
      .expect(200, done);
  });
};
