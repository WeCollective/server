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
    const limit = 30;
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

    return Dynamite.query(params, limit, FlaggedPost, 'slice');
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

  return FlaggedPost;
};
