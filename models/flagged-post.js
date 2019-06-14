module.exports = (Dynamite, validate) => {
  const FlaggedPost = Dynamite.define('FlaggedPost', {
    branch_rules_count: {
      defaultValue: null,
      validate: validate.number,
    },
    branchid: {
      defaultValue: null,
      sort: true,
      validate: validate.branchid,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.postid,
    },
    nsfw_count: {
      defaultValue: null,
      validate: validate.number,
    },
    site_rules_count: {
      defaultValue: null,
      validate: validate.number,
    },
    type: {
      defaultValue: null,
      validate: validate.postType,
    },
    wrong_type_count: {
      defaultValue: null,
      validate: validate.number,
    },
  }, {
    TableIndexes: [
      'branchid-date-index',
      'branchid-branch_rules_count-index',
      'branchid-site_rules_count-index',
      'branchid-wrong_type_count-index',
      'branchid-nsfw_count-index',
    ],
  });

  // Fetch the flagged posts on a specific branch
  FlaggedPost.findByBranch = (branchid, timeafter, nsfw, sortBy, stat, postType, lastInstance) => {
    const { TableIndexes } = FlaggedPost.config.keys;
    let index;

    switch (sortBy) {
      case 'branch_rules':
        index = TableIndexes[1];
        break;

      case 'nsfw':
        index = TableIndexes[4];
        break;

      case 'site_rules':
        index = TableIndexes[2];
        break;

      case 'wrong_type':
        index = TableIndexes[3];
        break;

      case 'date':
      default:
        index = TableIndexes[0];
        break;
    }

    if (lastInstance) {
      const tmp = {
        branchid: lastInstance.get('branchid'),
        date: lastInstance.get('date'),
        id: lastInstance.get('id'),
      };

      if (sortBy === 'date') {
        tmp.date = lastInstance.get('date');
      }
      else {
        tmp[`${sortBy}_count`] = lastInstance.get(`${sortBy}_count`);
      }

      lastInstance = tmp;
    }

    const params = {
      ExclusiveStartKey: lastInstance || null, // fetch results which come _after_ this
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':branchid': String(branchid),
        ':timeafter': Number(timeafter),
      },
      IndexName: index,
      KeyConditionExpression: 'branchid = :branchid AND #date >= :timeafter',
      ScanIndexForward: false, // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
    };

    if (sortBy !== 'date') {
      params.FilterExpression = '#date >= :timeafter';
      params.KeyConditionExpression = 'branchid = :branchid';
    }

    if (postType !== 'all') {
      params.ExpressionAttributeNames['#type'] = 'type';
      params.ExpressionAttributeValues[':postType'] = String(postType);

      if (sortBy === 'date') {
        params.FilterExpression = '#type = :postType';
      }
      else {
        params.FilterExpression += ' AND #type = :postType';
      }
    }

    return Dynamite.query(params, FlaggedPost, 'slice');
  };




  FlaggedPost.findById = id => Dynamite.query({
    ExpressionAttributeValues: {
      ':id': id,
    },
    KeyConditionExpression: 'id = :id',
  }, FlaggedPost, 'all');







  FlaggedPost.findByPostAndBranchIds = (postid, branchid) => Dynamite.query({
    ExpressionAttributeValues: {
      ':branchid': branchid,
      ':postid': postid,
    },
    KeyConditionExpression: 'id = :postid AND branchid = :branchid',
  }, FlaggedPost, 'first');








  //TODO finish like models.Post with pagnation
  // Fetch the flagged posts on a specific branch
  FlaggedPost.ScanForPosts = (branchid, posts, timeafter, nsfw, sortBy, stat, postType) => {

    if (posts.length === 0)
      return [];

    const { TableIndexes } = FlaggedPost.config.keys;
    let index;

    switch (sortBy) {
      case 'branch_rules':
        index = TableIndexes[1];
        break;

      case 'nsfw':
        index = TableIndexes[4];
        break;

      case 'site_rules':
        index = TableIndexes[2];
        break;

      case 'wrong_type':
        index = TableIndexes[3];
        break;

      case 'date':
      default:
        index = TableIndexes[0];
        break;
    }



    const params = {
      ExclusiveStartKey: null, // fetch results which come _after_ this
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':branchid': String(branchid),
        ':timeafter': Number(timeafter),
      },
      IndexName: index,
      FilterExpression: 'branchid = :branchid AND #date >= :timeafter',
      ScanIndexForward: false, // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
    };


    if (postType !== 'all') {
      params.ExpressionAttributeNames['#type'] = 'type';
      params.ExpressionAttributeValues[':postType'] = String(postType);

      if (sortBy === 'date') {
        params.FilterExpression += 'AND #type = :postType';
      }
      else {
        params.FilterExpression += ' AND #type = :postType';
      }
    }


    posts.forEach((instance, index) => {
      if (index === 0) {
        params.FilterExpression = params.FilterExpression + ' AND (id = :postid' + index;
        params.ExpressionAttributeValues[':postid' + index] = posts[index].get('id');
      }
      else if (index != posts.length - 1) {
        params.FilterExpression = params.FilterExpression + ' OR id = :postid' + index;
        params.ExpressionAttributeValues[':postid' + index] = posts[index].get('id');
      }
      else {
        params.FilterExpression = params.FilterExpression + ' OR id = :postid' + index + ' )';
        params.ExpressionAttributeValues[':postid' + index] = posts[index].get('id');
      }
    });

    return Dynamite.query(params, FlaggedPost, 'slice');
  };





  return FlaggedPost;
};
