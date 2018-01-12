module.exports = (Dynamite, validate) => {
  const Post = Dynamite.define('Post', {
    branchid: {
      defaultValue: null,
      sort: true,
      validate: validate.branchid,
    },
    comment_count: {
      defaultValue: null,
      validate: validate.number,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    down: {
      defaultValue: null,
      validate: validate.number,
    },
    global: {
      defaultValue: null,
      validate: validate.number,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.postid,
    },
    individual: {
      defaultValue: null,
      validate: validate.number,
    },
    local: {
      defaultValue: null,
      validate: validate.number,
    },
    locked: {
      allowNull: true,
      defaultValue: null,
      validate: validate.boolean,
    },
    nsfw: {
      defaultValue: null,
      validate: validate.boolean,
    },
    type: {
      defaultValue: null,
      validate: validate.postType,
    },
    up: {
      defaultValue: null,
      validate: validate.number,
    },
  }, {
    TableIndexes: [
      'branchid-individual-index',
      'branchid-local-index',
      'branchid-date-index',
      'branchid-comment_count-index',
      'branchid-global-index',
    ],
  });

  Post.findByBranch = (branchid, timeafter, nsfw, sortBy, stat, postType, lastPostInstance) => {
    if (nsfw === undefined) nsfw = true;
    if (postType === undefined) postType = 'all';
    if (sortBy === undefined) sortBy = 'date';
    if (stat === undefined) stat = 'global';
    if (timeafter === undefined) timeafter = 0;

    const { TableIndexes } = Post.config.keys;

    let indexName = TableIndexes[0];
    let params = {};

    if (sortBy === 'points') {
      switch(stat) {
        case 'individual':
          indexName = TableIndexes[0];
          break;

        case 'local':
          indexName = TableIndexes[1];
          break;

        case 'global':
        default:
          indexName = TableIndexes[4];
          break;
      }

      if (lastPostInstance) {
        let tmp = {
          branchid: lastPostInstance.get('branchid'),
          id: lastPostInstance.get('id'),
        };
        tmp[stat] = lastPostInstance.get(stat);
        lastPostInstance = tmp;
      }

      params = {
        FilterExpression: '#date >= :timeafter',
        KeyConditionExpression: 'branchid = :branchid',
      };
    }
    else if (sortBy === 'date') {
      indexName = TableIndexes[2];

      if (lastPostInstance) {
        lastPostInstance = {
          branchid: lastPostInstance.get('branchid'),
          date: lastPostInstance.get('date'),
          id: lastPostInstance.get('id'),
        };
      }

      params = {
        KeyConditionExpression: 'branchid = :branchid AND #date >= :timeafter',
      };
    }
    else if (sortBy === 'comment_count') {
      indexName = TableIndexes[3];

      if (lastPostInstance) {
        lastPostInstance = {
          branchid: lastPostInstance.get('branchid'),
          comment_count: lastPostInstance.get('comment_count'),
          id: lastPostInstance.get('id'),
        };
      }

      params = {
        FilterExpression: '#date >= :timeafter',
        KeyConditionExpression: 'branchid = :branchid',
      };
    }

    params.ExclusiveStartKey = lastPostInstance || null;  // fetch results which come _after_ this
    // date is a reserved dynamodb keyword so must use this alias:
    params.ExpressionAttributeNames = { '#date': 'date' };
    params.ExpressionAttributeValues = {
      ':branchid': String(branchid),
      ':timeafter': Number(timeafter),
    };
    params.IndexName = indexName;
    params.ScanIndexForward = false;   // return results highest first
    params.Select = 'ALL_PROJECTED_ATTRIBUTES';

    if (postType !== 'all') {
      params.FilterExpression = params.FilterExpression ? (params.FilterExpression + ' AND #type = :postType') : '#type = :postType';
      params.ExpressionAttributeNames['#type'] = 'type';
      params.ExpressionAttributeValues[':postType'] = String(postType);
    }

    if (!nsfw) {
      params.FilterExpression = params.FilterExpression ? (params.FilterExpression + ' AND nsfw = :nsfw') : 'nsfw = :nsfw';
      params.ExpressionAttributeValues[':nsfw'] = false;
    }

    return Dynamite.query(params, Post, 'slice');
  };

  Post.findById = id => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': id,
    },
    KeyConditionExpression: 'id = :id',
  }, Post, 'all');

  // Used to ensure a post exists on a given branch.
  Post.findByPostAndBranchIds = (postid, branchid) => Dynamite.query({
    ExpressionAttributeValues: {
      ':branchid': branchid,
      ':postid': postid,
    },
    KeyConditionExpression: 'id = :postid AND branchid = :branchid',
  }, Post, 'first');

  return Post;
};
