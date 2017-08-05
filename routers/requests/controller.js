'use strict';

const aws = require('../../config/aws');
const fs = require('../../config/filestorage');

const Branch = require('../../models/branch.model');
const Mod = require('../../models/mod.model');
const ModLogEntry = require('../../models/mod-log-entry.model');
const Notification = require('../../models/notification.model');
const NotificationTypes = require('../../config/notification-types');
const Post = require('../../models/post.model');
const SubBranchRequest = require('../../models/subbranch-request.model');
const Tag = require('../../models/tag.model');

const error = require('../../responses/errors');
const success = require('../../responses/successes');

const _ = require('lodash');

const put = {
  createNotification(type, creator, data, date, sessionId) {
    const notification = new Notification({
      data,
      date,
      id: `${creator}-${date}`,
      type,
      unread: true,
      user: creator,
    });

    const invalids = notification.validate();

    if (invalids.length > 0) {
      console.error('Error creating notification.');
      return Promise.reject({ code: 500 });
    }

    return notification.save(sessionId);
  },

  verifyParams(req) {
    const allowedActions = [
      'accept',
      'reject',
    ];

    if (!req.user.username) {
      console.error('No username found in session.');
      return Promise.reject({ code: 500 });
    }

    if (!req.body.action) {
      return Promise.reject({
        code: 400,
        message: 'Missing action parameter.',
      });
    }

    if (!allowedActions.includes(req.body.action)) {
      return Promise.reject({
        code: 400,
        message: 'Invalid action parameter.',
      });
    }

    return Promise.resolve(req);
  },
};

module.exports = {
  get(req, res) {
    if (!req.user.username) {
      console.error('No username found in session.');
      return error.InternalServerError(res);
    }

    return new SubBranchRequest()
      .findByBranch(req.params.branchid)
      .then(data => success.OK(res, data))
      .catch(err => {
        if (err) {
          if (typeof err === 'object' && err.code) {
            return error.code(res, err.code, err.message);
          }

          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  put(req, res) {
    const date = new Date().getTime();
    const subbranchRequest = new SubBranchRequest();
    const post = new Post();
    const tag = new Tag();

    const action = req.body.action;
    const childBranchId = req.params.childid;
    const parentBranchId = req.params.branchid;
    const username = req.user.username;

    let modLogEntryChildBranch;
    let modLogEntryParentBranch;
    let modsParentBranch;
    let subbranchRequestData;
    let tagsChildBranch;
    let tagsParentBranch;
    let treeBranchIds;
    let treePostsIds;

    const createModBranchMovedNotifications = mods => {
      const data = {
        childid: childBranchId,
        parentid: parentBranchId,
      };
      const type = NotificationTypes.BRANCH_MOVED;

      const promises = [];

      for (let i = 0; i < mods.length; i += 1) {
        const creator = mods[i].username;
        promises.push(put.createNotification(type, creator, data, date, req.sessionID));
      }

      return Promise.all(promises);
    };

    const createSubbranchRequestCreatorNotification = () => {
      const creator = subbranchRequestData.creator;
      const data = {
        action,
        childid: childBranchId,
        parentid: parentBranchId,
        username,
      };
      const type = NotificationTypes.CHILD_BRANCH_REQUEST_ANSWERED;

      return put.createNotification(type, creator, data, date, req.sessionID);
    };

    return put.verifyParams(req)
      // The request must exist.
      .then(() => subbranchRequest.find(parentBranchId, childBranchId))
      .then(data => {
        if (!data || data.length === 0) {
          return Promise.reject({
            code: 404,
            message: 'The subbranch request does not exist.',
          });
        }

        subbranchRequestData = data[0];

        return Promise.resolve();
      })
      // Create mod log entries.
      .then(() => {
        const createModLogEntry = branchid => {
          const modLogEntry = new ModLogEntry({
            action: 'answer-subbranch-request',
            branchid,
            data: JSON.stringify({
              childid: childBranchId,
              childmod: subbranchRequestData.creator,
              parentid: parentBranchId,
              response: action,
            }),
            date,
            username,
          });

          const invalids = modLogEntry.validate();
          return invalids.length === 0 ? modLogEntry : false;
        };

        modLogEntryParentBranch = createModLogEntry(parentBranchId);
        modLogEntryChildBranch = createModLogEntry(childBranchId);

        if (!modLogEntryParentBranch || !modLogEntryChildBranch) {
          return Promise.reject({
            code: 500,
            message: 'Error creating mod log entry.',
          });
        }

        return Promise.resolve();
      })
      // Accept the request.
      .then(() => {
        if (action !== 'accept') {
          return Promise.resolve();
        }

        return tag
          // Get all parent branch tags.
          // 
          // Example: root - a - b - parent
          // 
          // This will return [root, a, b, parent]
          .findByBranch(parentBranchId)
          // Check if the child branch we are asking to move is not a parent branch
          // of the requested parent branch.
          //
          // Example: root - a - b - child - c - parent
          //
          // In this case, moving the child branch would discontinue the chain, hence
          // it is forbidden.
          .then(tags => {
            tagsParentBranch = tags.map(obj => obj.tag);

            if (tagsParentBranch.includes(childBranchId)) {
              return Promise.reject({
                code: 400,
                message: 'The requested parent is a subbranch.',
              });
            }

            return Promise.resolve();
          })
          // Get all child branch tags.
          // 
          // Example: root - a - b - child
          // 
          // This will return [root, a, b, child]
          .then(() => tag.findByBranch(childBranchId)
            .then(tags => {
              tagsChildBranch = tags.map(obj => obj.tag);
              return Promise.resolve();
            })
          )
          // Sanitise both tag arrays before we perform the move.
          .then(() => {
            // This will always have at least root.
            const mutualTagsToExclude = _.intersection(tagsChildBranch, tagsParentBranch);

            // Strip the tags that do not change = mutual tags.
            tagsChildBranch = _.difference(tagsChildBranch, mutualTagsToExclude);
            tagsParentBranch = _.difference(tagsParentBranch, mutualTagsToExclude);

            // Remove child branch id from the child tags as we will not mutate it.
            // Child branch id stays the same, so it is not needed here.
            tagsChildBranch.splice(tagsChildBranch.indexOf(childBranchId, 1));
          })
          // Get the tree that will be relocated to the new parent branch.
          //
          // Example: root - a - b - child - c - d
          //                               - e - f
          //               - parent
          //
          // We will be moving [child, c, d, e, f] under parent. That's our tree.
          .then(() => tag.findByTag(childBranchId)
            .then(tags => {
              treeBranchIds = tags.map(obj => obj.branchid);
              return Promise.resolve();
            })
          )
          /*
          .then(() => post.findByBranch(childBranchId)
            .then(posts => {
              treePostsIds = posts;
              return Promise.resolve();
            })
          )
          */
          // Figure out how many operations we will have to carry out.
          // If we are about to delete 4 tags and add 2 tags, we will
          // be performing only 4 operations to be efficient - we will
          // update 2 rows and delete the other 2.
          .then(() => {
            const TCBLength = tagsChildBranch.length;
            const TPBLength = tagsParentBranch.length;
            const branchOperationsLength = TCBLength > TPBLength ? TCBLength : TPBLength;
            const branchOperationsArr = [];

            for (let i = 0; i < branchOperationsLength; i += 1) {
              treeBranchIds.forEach(branchId => {
                const operationTag = new Tag();

                if (i < TCBLength) {
                  // Update row.
                  if (i < TPBLength) {
                    branchOperationsArr.push(operationTag.findByBranchAndTag({
                      branchid: branchId,
                      tag: tagsChildBranch[i],
                    })
                      .then(() => {
                        operationTag.set('tag', tagsParentBranch[i]);
                        return operationTag.update();
                      })
                    );
                  }
                  // Delete row.
                  else {
                    branchOperationsArr.push(operationTag.findByBranchAndTag({
                      branchid: branchId,
                      tag: tagsChildBranch[i],
                    })
                      .then(() => operationTag.delete())
                    );
                  }
                }
                // Insert row.
                else {
                  branchOperationsArr.push(new Tag({
                    branchid: branchId,
                    tag: tagsParentBranch[i],
                  })
                    .save()
                  );
                }
              });
            }

            return Promise.all(branchOperationsArr);
          })
          // Update child branch parentid.
          .then(() => {
            const updatedBranch = new Branch({ id: childBranchId });
            updatedBranch.set('parentid', parentBranchId);
            return updatedBranch.update();
          })
          // Send notifications to both branch mods that the child branch has moved.
          .then(() => new Mod().findByBranch(parentBranchId))
          .then(mods => {
            modsParentBranch = mods;
            return new Mod().findByBranch(childBranchId);
          })
          // Remove all duplicates i.e. users who are mods of both branches.
          // Send notifications.
          .then(modsChildBranch => {
            const modsChildAndParentBranch = _.uniqBy(modsParentBranch.concat(modsChildBranch), 'username');
            return createModBranchMovedNotifications(modsChildAndParentBranch);
          });
            /*
            console.log('++++++++++++++++++++++++++++++++++++++++++');
            console.log('Child branch id:', childBranchId);
            console.log('Parent branch id:', parentBranchId);
            console.log('Child branch tags:', tagsChildBranch);
            console.log('Parent branch tags:', tagsParentBranch);
            console.log(treeBranchIds);
            console.log(branchOperations);
            // console.log(treePostsIds);
            console.log('++++++++++++++++++++++++++++++++++++++++++');

            return Promise.reject({
              code: 400,
              message: 'Just messing around',
            });
            */
      })
      // Remove the subbranch request.
      .then(() => subbranchRequest.delete({
        childid: childBranchId,
        parentid: parentBranchId,
      }))
      // Add records to both branches about the decision.
      .then(() => modLogEntryChildBranch.save())
      .then(() => modLogEntryParentBranch.save())
      // Inform the request creator about the decision.
      .then(() => createSubbranchRequestCreatorNotification())
      .then(() => success.OK(res))
      .catch(err => {
        if (err) {
          if (typeof err === 'object' && err.code) {
            return error.code(res, err.code, err.message);
          }

          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  post: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    // create new subbranch request
    var subbranchRequest = new SubBranchRequest({
      parentid: req.params.branchid,
      childid: req.params.childid,
      date: new Date().getTime(),
      creator: req.user.username,
    });

    const invalids = subbranchRequest.validate();
    if (invalids.length > 0) {
      return error.BadRequest(res, invalids[0]);
    }

    // ensure the specified branches exist
    var parent = new Branch();
    var child = new Branch();
    parent.findById(req.params.branchid).then(function() {
      return child.findById(req.params.childid);
    }).catch(function() {
      // one of the specified branches doesnt exist
      return error.NotFound(res);
    }).then(function() {
      // ensure the requested parent isn't already a parent
      if(parent.data.id == child.data.parentid) {
        return error.BadRequest(res, 'The requested branch is already a parent.');
      }
      // ensure the requested parent is not a child branch
      var tag = new Tag();
      return tag.findByBranch(req.params.branchid);
    }).then(function(parentTags) {
      for(var i = 0; i < parentTags.length; i++) {
        if(parentTags[i].tag == req.params.childid) {
          return error.BadRequest(res, 'The requested parent is a subbranch.');
        }
      }
      // requested parent is not child; continue

      // check this request does not already exist
      return subbranchRequest.find(subbranchRequest.data.parentid, subbranchRequest.data.childid);
    }).then(function(response) {
      if(!response || response.length == 0) {
        // save the request to the database
        return subbranchRequest.save(req.sessionID);
      } else {
        return error.BadRequest(res, 'Request already exists');
      }
    }).then(function () {
      // save a mod log entry describing the filing of the request
      var entry = new ModLogEntry({
        branchid: req.params.childid,     // child branch
        username: req.user.username,      // child mod
        date: new Date().getTime(),
        action: 'make-subbranch-request',
        data: req.params.branchid         // parent branch
      });

      var propertiesToCheck = ['branchid', 'username', 'date', 'action', 'data'];
      var invalids = entry.validate(propertiesToCheck);
      if(invalids.length > 0) {
        console.error('Error saving mod log entry.');
        return error.InternalServerError(res);
      }
      return entry.save();
    }).then(function() {
      return success.OK(res);
    }).catch(function(err) {
      if(err) {
        console.error("Error creating subbranch request: ", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
};
