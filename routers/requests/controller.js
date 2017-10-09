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
  createNotification(type, creator, data, date) {
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

    return notification.save();
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

  post(req, res) {
    const childBranch = new Branch();
    const childBranchId = req.params.childid;
    const date = new Date().getTime();
    const parentBranch = new Branch();
    const parentBranchId = req.params.branchid;
    const username = req.user.username;

    if (!username) {
      console.error('No username found in session.');
      return error.InternalServerError(res);
    }

    const request = new SubBranchRequest({
      childid: childBranchId,
      creator: username,
      date,
      parentid: parentBranchId,
    });

    const invalids = request.validate();
    if (invalids.length > 0) {
      return error.BadRequest(res, invalids[0]);
    }

    return parentBranch
      // Grab data for both branches. If it fails, we return not found error.
      .findById(parentBranchId)
      .then(() => childBranch.findById(childBranchId))
      // Exit if there already exists parent - child relationship between branches.
      .then(() => {
        if (parentBranch.data.id === childBranch.data.parentid) {
          return Promise.reject({
            code: 400,
            message: `${parentBranch.data.id} is already a parent of ${childBranch.data.id}`,
          });
        }

        return new Tag().findByBranch(parentBranchId);
      })
      // Check if the child branch we are asking to move is not a parent branch
      // of the requested parent branch.
      //
      // Example: root - a - b - child - c - parent
      //
      // In this case, moving the child branch would discontinue the chain, hence
      // it is forbidden.
      .then(tagsParentBranch => {
        tagsParentBranch = tagsParentBranch.map(obj => obj.tag);

        if (tagsParentBranch.includes(childBranchId)) {
          return Promise.reject({
            code: 400,
            message: `Cannot submit request: ${parentBranchId} is a child branch of ${childBranchId}`,
          });
        }

        return Promise.resolve();
      })
      // Don't create a duplicate request.
      .then(() => new SubBranchRequest().find(parentBranchId, childBranchId))
      .then(existingRequests => {
        if (existingRequests.length > 0) {
          return Promise.reject({
            code: 400,
            message: 'This request already exists',
          });
        }

        return request.save();;
      })
      // Create a mod log entry about the event.
      .then(() => {
        const modLogEntry = new ModLogEntry({
          action: 'make-subbranch-request',
          branchid: childBranchId,
          data: parentBranchId,
          date,
          username,
        });

        const invalids = modLogEntry.validate();
        if (invalids.length > 0) {
          console.error('Error saving mod log entry.');
          return Promise.reject({
            code: 500,
            message: invalids[0],
          });
        }

        return modLogEntry.save();
      })
      // If we are moving to root, we don't need anyone to approve
      // our request - move the branch immediately.
      .then(() => {
        if (parentBranchId === 'root') {
          // Inject the action parameter to the request so it doesn't
          // fail while accepting the branch request.
          req.body.action = 'accept';
          return module.exports.put(req, res);
        }

        return success.OK(res);
      })
      .catch(err => {
        if (err) {
          console.error('Error creating subbranch request:', err);
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
    const post = new Post();
    const request = new SubBranchRequest();
    const tag = new Tag();

    const action = req.body.action;
    const childBranchId = req.params.childid;
    const parentBranchId = req.params.branchid;
    const username = req.user.username;

    let modLogEntryChildBranch;
    let modLogEntryParentBranch;
    let modsParentBranch;
    let requestData;
    let tagsChildBranch;
    let tagsParentBranch;
    let treeBranchIds;

    const createModBranchMovedNotifications = mods => {
      const data = {
        childid: childBranchId,
        parentid: parentBranchId,
      };
      const type = NotificationTypes.BRANCH_MOVED;

      const promises = [];

      for (let i = 0; i < mods.length; i += 1) {
        const creator = mods[i].username;
        promises.push(put.createNotification(type, creator, data, date));
      }

      return Promise.all(promises);
    };

    const createSubbranchRequestCreatorNotification = () => {
      const creator = requestData.creator;
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
      .then(() => request.find(parentBranchId, childBranchId))
      .then(data => {
        if (!data || data.length === 0) {
          return Promise.reject({
            code: 404,
            message: 'The subbranch request does not exist.',
          });
        }

        requestData = data[0];

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
              childmod: requestData.creator,
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
                message: `Cannot accept request: ${parentBranchId} is a child branch of ${childBranchId}`,
              });
            }

            return Promise.resolve();
          })
          // Get all child branch tags.
          // 
          // Example: root - a - b - child
          // 
          // This will return [root, a, b, child]
          .then(() => tag.findByBranch(childBranchId))
          .then(tags => {
            tagsChildBranch = tags.map(obj => obj.tag);
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

            return Promise.resolve();
          })
          // Get the tree that will be relocated to the new parent branch.
          //
          // Example: root - a - b - child - c - d
          //                               - e - f
          //               - parent
          //
          // We will be moving [child, c, d, e, f] under parent. That's our tree.
          .then(() => tag.findByTag(childBranchId))
          .then(tags => {
            treeBranchIds = tags.map(obj => obj.branchid);
            return Promise.resolve();
          })
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
                  // Delete row in either case. We cannot update the tag directly because it is a
                  // part of the primary key. See http://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValueUpdate.html.
                  // Instead, we delete it and then insert a new tag with the updated attributes.
                  branchOperationsArr.push(operationTag.findByBranchAndTag(branchId, tagsChildBranch[i])
                    .then(() => operationTag.delete())
                    .then(() => {
                      if (i < TPBLength) {
                        return new Tag({
                          branchid: branchId,
                          tag: tagsParentBranch[i],
                        })
                          .save();
                      }

                      return Promise.resolve();
                    })
                  );
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
          })
          .catch(err => {
            console.log(err);
            return Promise.reject(err);
          });
      })
      // Remove the subbranch request.
      .then(() => request.delete({
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
};
