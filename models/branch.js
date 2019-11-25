
module.exports = (Dynamite, validate) => {
  const Branch = Dynamite.define('Branch', {
    creator: {
      defaultValue: null,
      validate: validate.username,
    },
    date: {
      defaultValue: null,
      validate: validate.date,
    },
    description: {
      allowNull: true,
      defaultValue: null,
      validate: {
        params: [1, validate.Constants.EntityLimits.branchDescription],
        test: validate.range,
      },
    },
    id: {
      defaultValue: null,
      primary: true,
      validate: validate.branchid,
    },
    name: {
      defaultValue: null,
      validate: {
        params: [1, validate.Constants.EntityLimits.branchName],
        test: validate.range,
      },
    },
    parentid: {
      defaultValue: null,
      validate: {
        params: ['$$id'],
        test: validate.branchid,
      },
    },
    post_comments: {
      defaultValue: null,
      validate: validate.number,
    },
    post_count: {
      defaultValue: null,
      validate: validate.number,
    },
    post_points: {
      defaultValue: null,
      validate: validate.number,
    },
    rules: {
      allowNull: true,
      defaultValue: null,
      validate: {
        params: [null, validate.Constants.EntityLimits.branchRules],
        test: validate.range,
      },
    },
  }, {
    TableIndexes: [
      'parentid-date-index',
      'parentid-post_count-index',
      'parentid-post_points-index',
      'parentid-post_comments-index',
    ],
  });

  // Get root branches using the GSI 'parentid', which will be set to 'root'.
  // TODO: this has an upper limit on the number of results; if so, a LastEvaluatedKey
  // will be supplied to indicate where to continue the search from
  // (see: http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB.html#query-property)
  Branch.findSubbranches = (parentid, timeafter, sortBy, lastBranchInstance, returnAll) => {

    const { TableIndexes } = Branch.config.keys;
    let IndexName;

    switch (sortBy) {
      case 'post_count':
        IndexName = TableIndexes[1];
        break;

      case 'post_points':
        IndexName = TableIndexes[2];
        break;

      case 'post_comments':
        IndexName = TableIndexes[3];
        break;

      case 'date':
      default:
        IndexName = TableIndexes[0];
        break;
    }

    if (lastBranchInstance) {
      const tmp = {
        id: lastBranchInstance.get('id'),
        parentid: lastBranchInstance.get('parentid'),
        [sortBy]: lastBranchInstance.get(sortBy),
      };

      lastBranchInstance = tmp;
    }

    const queryParams = {
      ExclusiveStartKey: lastBranchInstance || null, // fetch results which come _after_ this
      // date is a reserved dynamodb keyword so must use this alias:
      ExpressionAttributeNames: {
        '#date': 'date',
      },
      ExpressionAttributeValues: {
        ':parentid': String(parentid),
        ':timeafter': Number(timeafter),
      },
      IndexName,
      // return results highest first
      ScanIndexForward: false,
      Select: 'ALL_PROJECTED_ATTRIBUTES',
    };

    if (sortBy === 'date') {
      queryParams.KeyConditionExpression = 'parentid = :parentid AND #date >= :timeafter';
    }
    else {
      queryParams.FilterExpression = '#date >= :timeafter';
      queryParams.KeyConditionExpression = 'parentid = :parentid';
    }


    return Dynamite.query(queryParams, Branch, returnAll ? 'all' : 'slice');
  };




  Branch.findLooselyByNameAndParent = (name, rootId) => {
    if (rootId) {
      const { TableIndexes } = Branch.config.keys;
      let IndexName = TableIndexes[1];

      const params = {
        KeyConditionExpression: 'parentid = :parentid',
        FilterExpression: 'contains(#name, :name)',
        ExpressionAttributeNames: {
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':name': name, ':parentid': rootId,
        },
        IndexName,
        ScanIndexForward: false,
        Select: 'ALL_PROJECTED_ATTRIBUTES',
      };




      return Dynamite.query(params, Branch, 'all');
    }
    else {
      const { TableIndexes } = Branch.config.keys;
      let IndexName = TableIndexes[0];

      const params = {
        FilterExpression: 'contains(#name, :name)',
        ExpressionAttributeNames: {
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':name': name,
        },
        IndexName,
        ScanIndexForward: false,
        Select: 'ALL_PROJECTED_ATTRIBUTES',
      };




      return Dynamite.scan(params, Branch, 'all');
    }
  };
  
  
  
   Branch.cloudSearchSuggestions = (name, func) => {
	   if(!name) return;
      var params = {//future deep paging research
		  query: name,// text to suggest
		  suggester: "branch_name", //query language
		  size: 7, //max results  
		};
		
	return Dynamite.getBranchSuggestions(params,func);
		
  };


//finish me
  Branch.searchForSubbranches = (parentid, timeafter, sortBy, cursor, query, func) => {
	  
	  if(!parentid) return;
	  //add in sorts

	  let sort = 'date';
	  switch (sortBy) {
      case 'post_count':
		sort = 'post_count';
        break;

      case 'post_points':
		sort = 'post_points';
        break;

      case 'post_comments':
	  	sort = 'post_comments';
        break;

      case 'date':
		sort = 'date';
		break;
		
      default:
        break;
    }
	sort = sort + " desc";
		
	  let qur = "(and (phrase field='name' '"+query+"') (and ( term field='parentid' '"+parentid+"')) (and (range field=date {"+timeafter+",})) )" //search query
      const params = {
		  query: qur, //add in time after
		  queryParser: "structured", //query language
		  size: 20, //max results  should be limits in the future 
		  cursor:cursor,//pagnation, cursor is passed with request needs to be passed back and forth with the webapp (already do something like this)
		  sort:sort
		};
		
	return Dynamite.getBranchSearch(params,func);
  };



  return Branch;
};
