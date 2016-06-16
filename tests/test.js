var supertest = require("supertest");
var should = require("should");

var port = process.env.PORT || 8081;
var server = supertest.agent("http://localhost:" + port);

describe("Example unit test", function() {
  it("should return welcome message", function(done) {
    server.get("/")
      .end(function(err, res) {
        if(err) throw err;
        res.body.message.should.equal('Welcome to the WECO API! env: development');
        done();
      });
  });
});
