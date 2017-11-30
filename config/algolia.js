const algoliasearch = require('algoliasearch');

const client = algoliasearch(process.env.ALGOLIA_APP_ID, process.env.ALGOLIA_WRITE_API_KEY);
const IS_DEV = process.env.NODE_ENV !== 'production';
const MAX_RESULTS = 5;
const params = {
  hitsPerPage: MAX_RESULTS,
};
const prefix = IS_DEV ? 'dev_' : '';

const INDEX_BRANCHES = `${prefix}branches`;
const INDEX_POSTS = `${prefix}posts`;
const INDEX_USERS = `${prefix}users`;

const INDEX_ATTRS_BRANCH = [
  ['id', 'objectID'],
  'name',
  'id',
  'description',
  'post_points',
];
const INDEX_ATTRS_POST = [
  ['id', 'objectID'],
  'title',
  'text',
  'global',
];
const INDEX_ATTRS_USER = [
  ['username', 'objectID'],
  'name',
  'username',
];

// Cast single object into an array.
const castToArray = objects => {
  let arr = [];
  if (!Array.isArray(objects)) {
    if (objects && typeof objects === 'object') {
      arr = [
        ...arr,
        objects,
      ];
    }
  }
  else {
    arr = [...objects];
  }
  return arr;
};

// Enrich the searchable index object only with allowed properties.
const cleanProps = (obj, props) => {
  const clean = {};

  if (obj && typeof obj === 'object') {
    props.forEach(prop => {
      let objProp = prop;
      let cleanProp = prop;

      // Allow casting props.
      // Example: ['propOnObject', 'propOnIndex']
      if (Array.isArray(prop)) {
        objProp = prop[0];
        cleanProp = prop[1];
      }

      if (obj[objProp] !== undefined) {
        clean[cleanProp] = obj[objProp];
      }
    });
  }

  if (!Object.keys(clean).length) {
    return undefined;
  }

  return clean;
};

// Return the name of the searchable index for the given data type.
const getIndexName = type => {
  switch (type) {
  case 'branch':
    return INDEX_BRANCHES;

  case 'post':
    return INDEX_POSTS;

  case 'user':
    return INDEX_USERS;

  default:
    return '';
  }
};

// Return clean objects that cna be used for search index operations.
const sanitizeArray = (objects, type) => {
  let cleanArr = [];
  objects.forEach(object => {
    switch (type) {
    case 'branch':
      cleanArr = [...cleanArr, cleanProps(object, INDEX_ATTRS_BRANCH)];
      break;

    case 'post':
      cleanArr = [...cleanArr, cleanProps(object, INDEX_ATTRS_POST)];
      break;

    case 'user':
      cleanArr = [...cleanArr, cleanProps(object, INDEX_ATTRS_USER)];
      break;

    default:
      // Do nothing.
      break;
    }
  });
  // Remove empty entries.
  cleanArr = cleanArr.filter(x => !!x);
  return cleanArr;
};

// EXPORTS.

// Adds new records to the index.
module.exports.addObjects = (objects, type) => {
  objects = sanitizeArray(castToArray(objects), type);

  const index = client.initIndex(getIndexName(type));

  return new Promise((resolve, reject) => {
    index.addObjects(objects, (err, content) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      return resolve(content);
    });
  });
};

// Queries all indices.
module.exports.search = query => {
  const queries = [{
    indexName: getIndexName('branch'),
    params,
    query,
  }, {
    indexName: getIndexName('post'),
    params,
    query,
  }, {
    indexName: getIndexName('user'),
    params,
    query,
  }];

  return new Promise((resolve, reject) => {
    client.search(queries, (err, content) => {
      if (err) {
        console.error(err);
        return reject(err);
      }

      const branches = content.results[0];
      const posts = content.results[1];
      const users = content.results[2];

      const bResults = branches.hits.map(x => ({
        id: x.objectID,
        text: x._highlightResult.name.value,
        type: 'branch',
      }));

      const pResults = posts.hits.map(x => ({
        id: x.objectID,
        text: x._highlightResult.title.value,
        type: 'post',
      }));

      const uResults = users.hits.map(x => ({
        id: x.objectID,
        text: x._highlightResult.name.value,
        type: 'user',
      }));

      const results = [...bResults, ...pResults, ...uResults];
      return resolve(results);
    });
  });
};

// Updates records in the index.
module.exports.updateObjects = (objects, type) => {
  objects = sanitizeArray(castToArray(objects), type);

  const index = client.initIndex(getIndexName(type));

  return new Promise((resolve, reject) => {
    index.partialUpdateObjects(objects, (err, content) => {
      if (err) {
        console.error(err);
        return reject(err);
      }
      return resolve(content);
    });
  });
};
