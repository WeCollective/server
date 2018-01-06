module.exports = (Dynamite, validate) => {
  const PollAnswer = Dynamite.define('PollAnswer', {
    creator: {
      defaultValue: null,
      validate: validate.username,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.pollanswerid,
    },
    postid: {
      defaultValue: null,
      validate: validate.postid,
    },
    text: {
      defaultValue: null,
      validate: {
        params: [1, validate.Constants.EntityLimits.pollAnswerText],
        test: validate.range,
      },
    },
    votes: {
      defaultValue: null,
      validate: validate.number,
    },
  }, {
    TableIndexes: [
      'creator-date-index',
      'postid-date-index',
      'postid-votes-index',
    ],
  });

  PollAnswer.findByPost = (postid, sortBy, lastInstance) => {
    const { TableIndexes } = PollAnswer.config.keys;
    const limit = 30;
    let IndexName;

    switch (sortBy) {
      case 'votes':
        IndexName = TableIndexes[2];
        break;

      case 'date':
      default:
        IndexName = TableIndexes[1];
        break;
    }

    if (lastInstance) {
      lastInstance = {
        id: lastInstance.get('id'),
        postid: lastInstance.get('postid'),
      };
    }

    return Dynamite.query({
      ExclusiveStartKey: lastInstance || null, // fetch results which come _after_ this
      ExpressionAttributeValues: { ':postid': String(postid) },
      IndexName,
      KeyConditionExpression: 'postid = :postid',
      ScanIndexForward: false, // return results highest first
      Select: 'ALL_PROJECTED_ATTRIBUTES',
    }, limit, PollAnswer, 'slice');
  };

  return PollAnswer;
};
