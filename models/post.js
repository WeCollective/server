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
            switch (stat) {
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
        } else if (sortBy === 'date') {
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
        } else if (sortBy === 'comments') {
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

        params.ExclusiveStartKey = lastPostInstance || null; // fetch results which come _after_ this
        // date is a reserved dynamodb keyword so must use this alias:
        params.ExpressionAttributeNames = { '#date': 'date' };
        params.ExpressionAttributeValues = {
            ':branchid': String(branchid),
            ':timeafter': Number(timeafter),
        };
        params.IndexName = indexName;
        params.ScanIndexForward = false; // return results highest first
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



	Post.cloudSearchSuggestions = ((title,func) => {
		 if(!title) return;
      var params = {//future deep paging research
		  query: title,// text to suggest
		  suggester: "title_suggest", //query language
		  size: 7, //max results  
		};
		
	return Dynamite.getPostSuggestions(params,func);
		
	});
	
	
	//finish me
  Post.searchForPosts = (branchid, timeafter,nsfw, sortBy,stat,type, cursor, query, func) => {
	  	if(!branchid || !query) return;
		if (nsfw === undefined) nsfw = true;
        if (type === undefined) type = 'all';
        if (sortBy === undefined) sortBy = 'date';
        if (stat === undefined) stat = 'global';
        if (timeafter === undefined) timeafter = 0;
	  
	  
	  let sort = 'comments';
	  
	  if (sortBy === 'points') {
            switch (stat) {
                case 'individual':
                    sort = 'individual';
                    break;

                case 'local':
                    sort = 'local';
                    break;

                case 'global':
                default:
                    sort = 'global';
                    break;
            }

        }
		else if(sortBy === "date"){
			sort = "date";
		}		
	  sort = sort + " desc";
	  let qur = '';
	  if(type=="all")//(and (range field=date {"+timeafter+",})) not working with this ?
		qur = "(and (phrase field='title' '"+query+"') (and ( term field='branchid' '"+branchid+"'))   )" //search query
	  else//not all
		qur = "(and (phrase field='title' '"+query+"') (and ( term field='branchid' '"+branchid+"'))" + 
	" (and ( term field='type' '"+type+"'))  (and (range field=date ({"+timeafter+",}) )) )" //search query

      const params = {
		  query: qur, //add in time after
		  queryParser: "structured", //query language
		  size: 20, //max results  should be limits in the future 
		  cursor:cursor,//pagnation, cursor is passed with request needs to be passed back and forth with the webapp (already do something like this)
		  sort:sort
		};

	return Dynamite.getPostSearch(params,func);
  };
	  /*let qur = "(and (phrase field='title' '"+query+"') (and ( term field='branchid' '"+branchid+"')))" //search query
      const params = {
		  query: qur, //add in time after
		  queryParser: "structured", //query language
		  size: 20, //max results  should be limits in the future 
		  cursor:cursor,//pagnation, cursor is passed with request needs to be passed back and forth with the webapp (already do something like this)
		  sort:'date desc'
		};*/




    // Apply Filters to Posts
    //use batch get item
    Post.ScanForPosts = ((branchid, posts, timeafter, nsfw, sortBy, stat, postType, lastPostInstance) => {

        if (posts.length === 0)
            return [];

        if (nsfw === undefined) nsfw = true;
        if (postType === undefined) postType = 'all';
        if (sortBy === undefined) sortBy = 'date';
        if (stat === undefined) stat = 'global';
        if (timeafter === undefined) timeafter = 0;

        const { TableIndexes } = Post.config.keys;

        let indexName = TableIndexes[0];
        let params = {};

        if (sortBy === 'points') {
            switch (stat) {
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
                FilterExpression: '#date >= :timeafter AND branchid = :branchid',
            };
        } else if (sortBy === 'date') {
            indexName = TableIndexes[2];
            params = {
                FilterExpression: 'branchid = :branchid AND #date >= :timeafter',
            };

            if (lastPostInstance) {
                lastPostInstance = {
                    branchid: lastPostInstance.get('branchid'),
                    date: lastPostInstance.get('date'),
                    id: lastPostInstance.get('id'),
                };
            }

        } else if (sortBy === 'comments') {
            indexName = TableIndexes[3];

            if (lastPostInstance) {
                lastPostInstance = {
                    branchid: lastPostInstance.get('branchid'),
                    comment_count: lastPostInstance.get('comment_count'),
                    id: lastPostInstance.get('id'),
                };
            }

            params = {
                FilterExpression: '#date >= :timeafter AND branchid = :branchid',
            };
        }

        params.ExpressionAttributeNames = { '#date': 'date' };
        params.ExpressionAttributeValues = {
            ':branchid': String(branchid),
            ':timeafter': Number(timeafter),
        };
        params.IndexName = indexName; //sort by
        params.ScanIndexForward = false; // return results highest first
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
        //add key expr to expr att values
        //exec this for each of the posts given above

        posts.forEach((instance, index) => {
            if (index === 0) {
                params.FilterExpression = params.FilterExpression + ' AND (id = :postid' + index;
                params.ExpressionAttributeValues[':postid' + index] = posts[index].get('id');
            } else if (index != posts.length - 1) {
                params.FilterExpression = params.FilterExpression + ' OR id = :postid' + index;
                params.ExpressionAttributeValues[':postid' + index] = posts[index].get('id');
            } else {
                params.FilterExpression = params.FilterExpression + ' OR id = :postid' + index;
                params.ExpressionAttributeValues[':postid' + index] = posts[index].get('id');
            }
        });
        params.FilterExpression = params.FilterExpression + ' )';

        params.ExclusiveStartKey = lastPostInstance || null; // fetch results which come _after_ this


        return Dynamite.scan(params, Post, 'slice');
    });




    //not finished not working
    //needs experimenting
    // Post.batchGetItems = ((branchid, posts, timeafter, nsfw, sortBy, stat, postType) => {
    /* keys = [];
     posts.forEach((instance) =>{
       keys.push({
         id:instance.get('id'),
         branchid:branchid
       });
     });

     attributestoGet = ['id'];
     var params = {
     RequestItems: {
       Post: {
         Keys: keys,
         AttributesToGet: attributestoGet,
         ConsistentRead: false, // optional (true | false)
       },
     },
     ReturnConsumedCapacity: 'NONE', // optional (NONE | TOTAL | INDEXES)
 };


     return Dynamite.batchGetItems(params, Post, 'slice');
   */
    // });

    return Post;

};