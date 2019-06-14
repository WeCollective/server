module.exports = (Dynamite, validate) => {
  const PostData = Dynamite.define('PostData', {
    creator: {
      defaultValue: null,
      validate: validate.username,
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.postid,
    },
    original_branches: {
      defaultValue: null,
      validate: validate.originalBranches,
    },
    text: {
      allowNull: true,
      defaultValue: null,
      validate: validate.postText,
    },
    title: {
      defaultValue: null,
      validate: {
        params: [1, validate.Constants.EntityLimits.postTitle],
        test: validate.range,
      },
    },
    type: {
      defaultValue: null,
      validate: validate.postType,
    },
    url: {
      allowNull: true,
      defaultValue: null,
      validate: validate.url,
    },
  });



  PostData.findPostLooselyByTitle = (query, lastPostInstance) => {

    var params = {};

    params.ExpressionAttributeNames = { '#title': 'title' };
    params.ExpressionAttributeValues = {
      ':title': query,
    };

    params.FilterExpression = 'contains(#title, :title)';

    if (lastPostInstance) {
      console.log(lastPostInstance.id + '\n\n\n\n\n\n');

      lastPostInstance = {
        id: lastPostInstance.id,
      };
    }
    //scan goes through a certain number of items and returns a result in it there is a last eval
    //use that for subsequent searches to pagnate results
    //1 2 3 4| 5 6 7
    //2 and 3 are chosen 4 is eval key
    //replace the lastpost instance in the future with the last eval key

    params.ExclusiveStartKey = lastPostInstance || null; //fetch from the last post
    params.ScanIndexForward = false;   // return results highest first
    params.Select = 'ALL_ATTRIBUTES';

    return Dynamite.scan(params, PostData, 'slice');

  };



  return PostData;
};
