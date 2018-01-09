module.exports = (Dynamite, validate) => {
  const Comment = Dynamite.define('Comment', {
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    down: {
      defaultValue: null,
      validate: validate.number,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.commentid,
    },
    individual: {
      defaultValue: null,
      validate: validate.number,
    },
    parentid: {
      defaultValue: null,
      validate: validate.commentid,
    },
    postid: {
      defaultValue: null,
      validate: validate.postid,
    },
    rank: {
      defaultValue: null,
      validate: validate.number,
    },
    replies: {
      defaultValue: null,
      validate: validate.number,
    },
    up: {
      defaultValue: null,
      validate: validate.number,
    },
  }, {
    TableIndexes: [
      'postid-individual-index',
      'postid-date-index',
      'postid-replies-index',
    ],
  });

  Comment.findByParent = (postid, parentid, sortBy, lastInstance) => {
    const { TableIndexes } = Comment.config.keys;
    let IndexName;

    switch(sortBy) {
      case 'date':
        IndexName = TableIndexes[1];
        break;

      case 'replies':
        IndexName = TableIndexes[2];
        break;

      case 'points':
      default:
        IndexName = TableIndexes[0];
        break;
    }

    if (lastInstance) {
      const tmp = {
        id: lastInstance.get('id'),
        postid: lastInstance.get('postid'),
      };

      if (sortBy === 'points') {
        tmp.individual = lastInstance.get('individual');
      }
      else {
        tmp[sortBy] = lastInstance.get(sortBy);
      }

      lastInstance = tmp;
    }

    return Dynamite.query({
      ExclusiveStartKey: lastInstance || null, // fetch results which come _after_ this
      ExpressionAttributeValues: {
        ':parentid': parentid,
        ':postid': postid,
      },
      FilterExpression: 'parentid = :parentid',
      IndexName,
      KeyConditionExpression: 'postid = :postid',
      ScanIndexForward: false, // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
    }, Comment, 'slice');
  };

  return Comment;
};
