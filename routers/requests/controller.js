const _ = require('lodash');
const reqlib = require('app-root-path').require;

const Models = reqlib('models/');
const NotificationTypes = reqlib('config/notification-types');

const save = (parentBranchId, childBranchId, creator) => {
  const date = new Date().getTime();
  let uniqueMods;

  return Models.Mod.findByBranch(parentBranchId)
    .then(instances => {
      uniqueMods = instances;
      return Models.Mod.findByBranch(childBranchId);
    })
    .then(instances => {
      let alreadyInsertedUsernames = uniqueMods.map(instance => instance.get('username'));
      let promises = [];

      instances.forEach(instance => {
        const username = instance.get('username');
        if (!alreadyInsertedUsernames.includes(username)) {
          alreadyInsertedUsernames = [
            ...alreadyInsertedUsernames,
            username,
          ];
          uniqueMods = [
            ...uniqueMods,
            instance,
          ];
        }
      });

      // send notification of the new child branch request to these mods
      for (let i = 0; i < uniqueMods.length; i += 1) {
        const username = uniqueMods[i].get('username');

        promises = [
          ...promises,
          Models.Notification.create({
            data: {
              childid: childBranchId,
              parentid: parentBranchId,
              username: creator,
            },
            date,
            id: `${username}-${date}`,
            unread: true,
            user: username,
            type: NotificationTypes.NEW_CHILD_BRANCH_REQUEST,
          }),
        ];
      }

      return Promise.all(promises);
    })
    .catch(err => Promise.reject(err));
};

const put = {
  createNotification(type, creator, data, date) {
    return Models.Notification.create({
      data,
      date,
      id: `${creator}-${date}`,
      type,
      unread: true,
      user: creator,
    });
  },

  verifyParams(req) {
    const allowedActions = [
      'accept',
      'reject',
    ];

    if (!req.user.get('username')) {
      console.error('No username found in session.');
      return Promise.reject({ status: 500 });
    }

    if (!req.body.action) {
      return Promise.reject({
        status: 400,
        message: 'Missing action parameter.',
      });
    }

    if (!allowedActions.includes(req.body.action)) {
      return Promise.reject({
        status: 400,
        message: 'Invalid action parameter.',
      });
    }

    return Promise.resolve(req);
  },
};

module.exports.get = (req, res, next) => {
  const { branchid } = req.params;
  return Models.SubBranchRequest.findByParent(branchid)
    // todo
    .then(requests => {
      res.locals.data = requests.map(instance => instance.dataValues);
      return next();
    })
    .catch(err => {
      console.log(err);
      if (typeof err === 'object' && err.status) {
        req.error = err;
        return next(JSON.stringify(req.error));
      }

      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.post = (req, res, next) => {
  const {
    childid: childBranchId,
    branchid: parentBranchId,
  } = req.params;
  const date = new Date().getTime();
  const username = req.user.get('username');
  let childBranch;
  let parentBranch;

  // Grab data for both branches. If it fails, we return not found error.
  return Models.Branch.findById(parentBranchId)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          status: 400,
          message: `Branch ${parentBranchId} does not exist.`,
        });
      }

      parentBranch = instance;
      return Models.Branch.findById(childBranchId);
    })
    // Exit if there already exists parent - child relationship between branches.
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          status: 400,
          message: `Branch ${childBranchId} does not exist.`,
        });
      }

      childBranch = instance;

      if (parentBranch.get('id') === childBranch.get('parentid')) {
        return Promise.reject({
          status: 400,
          message: `${parentBranch.get('id')} is already a parent of ${childBranch.get('id')}`,
        });
      }

      return Models.Tag.findByBranch(parentBranchId);
    })
    // Check if the child branch we are asking to move is not a parent branch
    // of the requested parent branch.
    //
    // Example: root - a - b - child - c - parent
    //
    // In this case, moving the child branch would discontinue the chain, hence
    // it is forbidden.
    .then(instances => {
      const tagsParentBranch = instances.map(instance => instance.get('tag'));

      if (tagsParentBranch.includes(childBranchId)) {
        return Promise.reject({
          status: 400,
          message: `Cannot submit request: ${parentBranchId} is a child branch of ${childBranchId}`,
        });
      }

      return Promise.resolve();
    })
    // Don't create a duplicate request.
    .then(() => Models.SubBranchRequest.find(parentBranchId, childBranchId))
    .then(instances => {
      if (instances.length) {
        return Promise.reject({
          status: 400,
          message: 'This request already exists',
        });
      }

      return Models.SubBranchRequest.create({
        childid: childBranchId,
        creator: username,
        date,
        parentid: parentBranchId,
      });
    })
    // todo
    .then(() => save(parentBranchId, childBranchId, username))
    // Create a mod log entry about the event.
    .then(() => Models.ModLog.create({
      action: 'make-subbranch-request',
      branchid: childBranchId,
      data: parentBranchId,
      date,
      username,
    }))
    // If we are moving to root, we don't need anyone to approve
    // our request - move the branch immediately.
    .then(() => {
      if (parentBranchId === 'root') {
        // Inject the action parameter to the request so it doesn't
        // fail while accepting the branch request.
        req.body.action = 'accept';
        return module.exports.put(req, res);
      }

      return next();
    })
    .catch(err => {
      console.error('Error creating subbranch request:', err);
      if (typeof err === 'object' && err.status) {
        req.error = err;
        return next(JSON.stringify(req.error));
      }

      req.error = {
        message: err,
      };
      return next(JSON.stringify(req.error));
    });
};

module.exports.put = (req, res, next) => {
  const {
    branchid: parentBranchId,
    childid: childBranchId,
  } = req.params;
  const { action } = req.body;
  const date = new Date().getTime();
  const username = req.user.get('username');
  let requestInstance;

  let modsParentBranch;
  let tagsChildBranch;
  let tagsParentBranch;
  let treeBranchIds;

  const createModBranchMovedNotifications = mods => {
    const data = {
      childid: childBranchId,
      parentid: parentBranchId,
    };
    const type = NotificationTypes.BRANCH_MOVED;
    let promises = [];

    for (let i = 0; i < mods.length; i += 1) {
      const creator = mods[i].get('username');
      promises = [
        ...promises,
        put.createNotification(type, creator, data, date),
      ];
    }

    return Promise.all(promises);
  };

  const createSubbranchRequestCreatorNotification = () => {
    const creator = requestInstance.get('creator');
    const data = {
      action,
      childid: childBranchId,
      parentid: parentBranchId,
      username,
    };
    const type = NotificationTypes.CHILD_BRANCH_REQUEST_ANSWERED;
    return put.createNotification(type, creator, data, date);
  };

  return put.verifyParams(req)
    // The request must exist.
    .then(() => Models.SubBranchRequest.find(parentBranchId, childBranchId))
    .then(instances => {
      if (!instances.length) {
        return Promise.reject({
          status: 404,
          message: 'The subbranch request does not exist.',
        });
      }

      requestInstance = instances[0];
      return Promise.resolve();
    })
    // Accept the request.
    .then(() => {
      if (action !== 'accept') {
        return Promise.resolve();
      }

      // Get all parent branch tags.
      //
      // Example: root - a - b - parent
      //
      // This will return [root, a, b, parent]
      return Models.Tag.findByBranch(parentBranchId)
        // Check if the child branch we are asking to move is not a parent branch
        // of the requested parent branch.
        //
        // Example: root - a - b - child - c - parent
        //
        // In this case, moving the child branch would discontinue the chain, hence
        // it is forbidden.
        .then(tags => {
          tagsParentBranch = tags.map(instance => instance.get('tag'));

          if (tagsParentBranch.includes(childBranchId)) {
            return Promise.reject({
              status: 400,
              message: `Cannot accept request: ${parentBranchId} is a child branch of ${childBranchId}`,
            });
          }

          // Get all child branch tags.
          //
          // Example: root - a - b - child
          //
          // This will return [root, a, b, child]
          return Models.Tag.findByBranch(childBranchId);
        })
        .then(tags => {
          tagsChildBranch = tags.map(instance => instance.get('tag'));
          return Promise.resolve();
        })
        // Sanitise both tag arrays before we perform the move.
        .then(() => {
          // This will always have at least root.
          const mutualTagsToExclude = _.intersection(tagsChildBranch, tagsParentBranch);

          // Strip the tags that do not change = mutual tags.
          tagsChildBranch = _.difference(tagsChildBranch, mutualTagsToExclude);
          tagsParentBranch = _.difference(tagsParentBranch, mutualTagsToExclude);

          // Remove child branch id from the child tags as we will not mutate it.
          // Child branch id stays the same, so it is not needed here.
          tagsChildBranch.splice(tagsChildBranch.indexOf(childBranchId), 1);

          // Get the tree that will be relocated to the new parent branch.
          //
          // Example: root - a - b - child - c - d
          //                               - e - f
          //               - parent
          //
          // We will be moving [child, c, d, e, f] under parent. That's our tree.
          return Models.Tag.findByTag(childBranchId);
        })
        .then(tags => {
          treeBranchIds = tags.map(instance => instance.get('branchid'));

          // Figure out how many operations we will have to carry out.
          // If we are about to delete 4 tags and add 2 tags, we will
          // be performing only 4 operations to be efficient - we will
          // update 2 rows and delete the other 2.
          const TCBLength = tagsChildBranch.length;
          const TPBLength = tagsParentBranch.length;
          const branchOperationsLength = TCBLength > TPBLength ? TCBLength : TPBLength;
          let branchOperationsArr = [];

          for (let i = 0; i < branchOperationsLength; i += 1) {
            treeBranchIds.forEach(branchId => {
              // const operationTag = new Tag();
              if (i < TCBLength) {
                // Delete row in either case. We cannot update the tag directly because it is a
                // part of the primary key. See http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValueUpdate.html.
                // Instead, we delete it and then insert a new tag with the updated attributes.
                branchOperationsArr = [
                  ...branchOperationsArr,
                  Models.Tag.findByBranchAndTag(branchId, tagsChildBranch[i])
                    .then(instance => {
                      if (instance === null) {
                        return Promise.reject('Tag does not exist.');
                      }
                      return instance.destroy();
                    })
                    .then(() => {
                      if (i < TPBLength) {
                        return Models.Tag.create({
                          branchid: branchId,
                          tag: tagsParentBranch[i],
                        });
                      }

                      return Promise.resolve();
                    })
                    .catch(err => Promise.reject(err)),
                ];
              }
              // Insert row.
              else {
                branchOperationsArr = [
                  ...branchOperationsArr,
                  Models.Tag.create({
                    branchid: branchId,
                    tag: tagsParentBranch[i],
                  }),
                ];
              }
            });
          }

          return Promise.all(branchOperationsArr);
        })
        // Update child branch parentid.
        .then(() => Models.Branch.update({
          where: {
            id: childBranchId,
          },
        }, {
          parentid: parentBranchId,
        }))
        // Send notifications to both branch mods that the child branch has moved.
        .then(() => Models.Mod.findByBranch(parentBranchId))
        .then(mods => {
          modsParentBranch = mods.filter(x => {
            if (req.synthetic && x.get('username') === username) {
              return false;
            }
            return true;
          });
          return Models.Mod.findByBranch(childBranchId);
        })
        // Remove all duplicates i.e. users who are mods of both branches.
        // Send notifications.
        .then(instances => {
          let uniqueMods = modsParentBranch;
          let alreadyInsertedUsernames = uniqueMods.map(instance => instance.get('username'));

          instances.forEach(instance => {
            const modUsername = instance.get('username');
            const canInsert = req.synthetic ? modUsername !== username : true;
            if (!alreadyInsertedUsernames.includes(modUsername) && canInsert) {
              alreadyInsertedUsernames = [
                ...alreadyInsertedUsernames,
                modUsername,
              ];
              uniqueMods = [
                ...uniqueMods,
                instance,
              ];
            }
          });

          return createModBranchMovedNotifications(uniqueMods);
        })
        .catch(err => {
          console.log(err);
          return Promise.reject(err);
        });
    })
    // Remove the subbranch request.
    .then(() => Models.SubBranchRequest.destroy({
      childid: childBranchId,
      parentid: parentBranchId,
    }))
    // Add records to both branches about the decision.
    .then(() => Models.ModLog.create({
      action: 'answer-subbranch-request',
      branchid: parentBranchId,
      data: JSON.stringify({
        childid: childBranchId,
        childmod: requestInstance.get('creator'),
        parentid: parentBranchId,
        response: action,
      }),
      date,
      username,
    }))
    .then(() => Models.ModLog.create({
      action: 'answer-subbranch-request',
      branchid: childBranchId,
      data: JSON.stringify({
        childid: childBranchId,
        childmod: requestInstance.get('creator'),
        parentid: parentBranchId,
        response: action,
      }),
      date,
      username,
    }))
    // Inform the request creator about the decision.
    .then(() => {
      if (!req.synthetic) {
        return createSubbranchRequestCreatorNotification();
      }

      return Promise.resolve();
    })
    .then(() => next())
    .catch(err => {
      if (err) {
        if (typeof err === 'object' && err.status) {
          req.error = err;
          return next(JSON.stringify(req.error));
        }

        req.error = {
          message: err,
        };
        return next(JSON.stringify(req.error));
      }

      req.error = {
        status: 404,
      };
      return next(JSON.stringify(req.error));
    });
};
