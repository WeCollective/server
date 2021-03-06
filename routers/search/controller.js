const reqlib = require('app-root-path').require

const Models = reqlib('models/')

//TODO remove tags from query


module.exports.getposts = (req, res, next) => {

  const q = req.query.q;

  if (!q) {
    return [];
  }


  //create a promise
  //return after it's resolved

  var results = [];

  //search posts
  var postsToAppend = [];

  var promisesSearch = [];



  //search posts
  promisesSearch.push(
    Models.PostData.findPostLooselyByTitle(q)
      .then(instances => {


        let results = [];
        let titles = [];
        instances.forEach(instance => {
          let title = instance.get('title');
          if (!titles.includes(title)) {
            titles = [...titles, title];
            results = [
              ...results,
              Object.assign({}, { id: instance.get('id'), type: 'post', text: title }),
            ];
          }

        });
        postsToAppend = results;
      })
  );

  //promises resolve all then do all below
  Promise.all(promisesSearch).then(() => {
    results = results.concat(postsToAppend);
    res.locals.data = { results };
    return next();
  }).catch(() => {
    return Promise.reject({
      message: 'err searching',
      status: 404,
    });
  });



};


module.exports.getbranches = (req, res, next) => {

  const q = req.query.q;
  const rootId = req.query.rootId;
  if (!q) {
    return [];
  }


  //create a promise
  //return after it's resolved

  var results = [];

  //search branches
  var branches = [];


  var promisesSearch = [];



  //search branches
  promisesSearch.push(
    Models.Branch.findLooselyByNameAndParent(q, rootId)
      .then(instances => {


        let results = [];
        instances.forEach(instance => {

          results = [
            ...results,
            Object.assign({}, { id: instance.get('id'), type: 'branch', text: instance.get('name') }),
          ];

        });
        branches = results;
      })
  );

  //promises resolve all then do all below
  Promise.all(promisesSearch).then(() => {
    results = results.concat(branches);
    res.locals.data = { results };
    return next();
  }).catch(() => {
    return Promise.reject({
      message: 'err searching',
      status: 404,
    });
  });



};







module.exports.getusers = (req, res, next) => {

  const q = req.query.q;

  if (!q) {
    return [];
  }


  //create a promise
  //return after it's resolved

  var results = [];

  //search users
  var users = [];

  var promisesSearch = [];




  //search users
  promisesSearch.push(
    Models.User.findLooselyByUsername(q)
      .then(instances => {


        let results = [];
        instances.forEach(instance => {

          results = [
            ...results,
            Object.assign({}, { id: instance.get('username'), type: 'user', text: instance.get('username') }),
          ];

        });
        users = results;
      })

  );
  //promises resolve all then do all below
  Promise.all(promisesSearch).then(() => {
    results = results.concat(users);
    res.locals.data = { results };
    return next();
  }).catch(() => {
    return Promise.reject({
      message: 'err searching',
      status: 404,
    });
  });

}








//searches all
module.exports.getAll = (req, res, next) => {

  const q = req.query.q;

  if (!q) {
    return [];
  }


  //create a promise
  //return after it's resolved

  var results = [];

  //search users
  var users = [];
  //search branches
  var branches = [];

  //search posts
  var postsToAppend = [];

  var promisesSearch = [];



  //search posts
  promisesSearch.push(
    Models.PostData.findPostLooselyByTitle(q)
      .then(instances => {


        let results = [];
        let titles = [];
        instances.forEach(instance => {
          let title = instance.get('title');
          if (!titles.includes(title)) {
            titles = [...titles, title];
            results = [
              ...results,
              Object.assign({}, { id: instance.get('id'), type: 'post', text: title }),
            ];
          }

        });
        postsToAppend = results;
      })
  );


  //search branches
  promisesSearch.push(
    Models.Branch.findLooselyByName(q)
      .then(instances => {


        let results = [];
        instances.forEach(instance => {

          results = [
            ...results,
            Object.assign({}, { id: instance.get('id'), type: 'branch', text: instance.get('name') }),
          ];

        });
        branches = results;
      })

  );



  //search users
  promisesSearch.push(
    Models.User.findLooselyByUsername(q)
      .then(instances => {


        let results = [];
        instances.forEach(instance => {

          results = [
            ...results,
            Object.assign({}, { id: instance.get('username'), type: 'user', text: instance.get('username') }),
          ];

        });
        users = results;
      })

  );

  //promises resolve all then do all below
  Promise.all(promisesSearch).then(() => {
    results = results.concat(users);
    results = results.concat(branches);
    results = results.concat(postsToAppend);
    res.locals.data = { results };
    return next();
  }).catch(() => {
    return Promise.reject({
      message: 'err searching',
      status: 404,
    });
  });



};