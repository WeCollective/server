'use strict';

var aws = require('../../config/aws.js');
var fs = require('../../config/filestorage.js');

var NotificationTypes = require('../../config/notification-types.js');
var SubBranchRequest = require('../../models/subbranch-request.model.js');
var Branch = require('../../models/branch.model.js');
var ModLogEntry = require('../../models/mod-log-entry.model.js');
var Tag = require('../../models/tag.model.js');
var Notification = require('../../models/notification.model.js');
var Mod = require('../../models/mod.model.js');

var success = require('../../responses/successes.js');
var error = require('../../responses/errors.js');

var _ = require('lodash');

module.exports = {
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
      creator: req.user.username
    });

    // validate request properties
    var propertiesToCheck = ['parentid', 'childid', 'date', 'creator'];
    var invalids = subbranchRequest.validate(propertiesToCheck);
    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
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
  get: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    var subbranchRequest = new SubBranchRequest();
    subbranchRequest.findByBranch(req.params.branchid).then(function(response) {
      return success.OK(res, response);
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  },
  put: function(req, res) {
    if(!req.user.username) {
      console.error("No username found in session.");
      return error.InternalServerError(res);
    }

    if(!req.body.action || (req.body.action != 'accept' && req.body.action != 'reject')) {
      return error.BadRequest(res, 'Missing or malformed action parameter');
    }

    // first ensure the request exists
    var subbranchRequest = new SubBranchRequest();
    subbranchRequest.find(req.params.branchid, req.params.childid).then(function(data) {
      if(!data || data.length == 0) {
        return error.NotFound(res);
      }

      // create promise to delete the subbranch request
      var deletePromise = subbranchRequest.delete({
        parentid: req.params.branchid,
        childid: req.params.childid
      });

      // create an mod log entry for the parent branch describing the
      // action taken on the subbranch request
      var entryParent = new ModLogEntry({
        branchid: req.params.branchid,     // parent branch
        username: req.user.username,       // parent mod
        date: new Date().getTime(),
        action: 'answer-subbranch-request',
        data: JSON.stringify({
          response: req.body.action,       // 'accept' or 'reject'
          childid: req.params.childid,     // child branch id
          parentid: req.params.branchid,   // parent branch id
          childmod: data[0].creator        // child mod username
        })
      });
      // create an mod log entry for the child branch describing the
      // action taken on the subbranch request
      var entryChild = new ModLogEntry({
        branchid: req.params.childid,      // parent branch
        username: req.user.username,       // parent mod
        date: new Date().getTime(),
        action: 'answer-subbranch-request',
        data: JSON.stringify({
          response: req.body.action,       // 'accept' or 'reject'
          childid: req.params.childid,     // child branch id
          parentid: req.params.branchid,   // parent branch id
          childmod: data[0].creator        // child mod username
        })
      });
      var propertiesToCheck = ['branchid', 'username', 'date', 'action', 'data'];
      var invalidsParent = entryParent.validate(propertiesToCheck);
      var invalidsChild = entryChild.validate(propertiesToCheck);
      if(invalidsParent.length > 0 || invalidsChild.length > 0) {
        console.error('Error saving mod log entry.');
        return error.InternalServerError(res);
      }


      // Accept the request:
      if(req.body.action == 'accept') {
        // ensure the requested parent is not a child branch
        var tag = new Tag();
        tag.findByBranch(req.params.branchid).then(function(parentTags) {
          for(var i = 0; i < parentTags.length; i++) {
            if(parentTags[i].tag == req.params.childid) {
              return error.BadRequest(res, 'The requested parent is a subbranch.');
            }
          }
          // requested parent is not child; continue

          // get the child branch's tags
          tag.findByBranch(req.params.childid).then(function(childTags) {
            var B = childTags.map(function(x) {
              return x.tag;
            });
            var P = parentTags.map(function(x) {
              return x.tag;
            });
            var _O = _.difference(B, _.intersection(B, P));
            if(_O.indexOf(req.params.childid) > -1) _O.splice(_O.indexOf(req.params.childid), 1);  // remove self from O
            var _N = _.difference(P, B);

            // get the branch whose parent is changing AND all its children
            tag.findByTag(req.params.childid).then(function(allChildren) {
              var updateTagsPromises = [];
              // update each child's tags (allChildren includes self)
              for(var i = 0; i < allChildren.length; i++) {
                updateTagsPromises.push(new Promise(function(resolve, reject) {
                  // perform tag update operations for this branch, resolving promise when complete

                  // get all the tags of this child
                  tag.findByBranch(allChildren[i].branchid).then(function(tags) {
                    var bid;
                    if(tags.length > 0) bid = tags[0].branchid;
                    var promises = [];  // to hold all tag operation promises
                    // make copies
                    var O = _O.slice(0);
                    var N = _N.slice(0);

                    // for each tag in the child's tag set...
                    var n = 0;
                    for(var t = 0; t < tags.length; t++) {
                      // if the tag set contains a tag from O
                      if(O.indexOf(tags[t].tag) > -1) {
                        // remove tag from list
                        promises.push(tag.delete(tags[t]));
                        tags.splice(t, 1);
                        // replace it with one from N if possible
                        if(n < N.length) {
                          tags.push({
                            branchid: bid,
                            tag: N[n]
                          });
                          promises.push(new Tag({
                            branchid: bid,
                            tag: N[n]
                          }).save());
                          n++;
                        }
                      }
                    }

                    // add any remaining tags in N
                    while(n < N.length) {
                      tags.push({
                        branchid: bid,
                        tag: N[n]
                      });
                      promises.push(new Tag({
                        branchid: bid,
                        tag: N[n]
                      }).save());
                      n++;
                    }

                    // wait for all tag operations on this branch to complete
                    Promise.all(promises).then(function() {
                      // Success updating tags!
                      return resolve();
                    }, function(err) {
                      return reject(err);
                    });
                  }, function(err) {
                    console.error("Error fetching tags by branch:", err);
                    return error.InternalServerError(res);
                  });
                }));
              }

              var parentMods, childMods;
              // when all tags are updated, update the actual branch parent
              Promise.all(updateTagsPromises).then(function () {
                // update the child branch's parentid
                var updatedBranch = new Branch({
                  id: req.params.childid
                });
                updatedBranch.set('parentid', req.params.branchid);
                updatedBranch.update().then(function () {
                  // delete the request from the table
                  return deletePromise;
                }).then(function() {
                  // save the child mod log entry
                  return entryChild.save();
                }).then(function() {
                  // save the parent mod log entry
                  return entryParent.save();
                }).then(function() {
                  // create a notification for the creator of the subbranch request
                  // indicating that it was accepted
                  var time = new Date().getTime();
                  var notification = new Notification({
                    id: data[0].creator + '-' + time,
                    user: data[0].creator,
                    date: time,
                    unread: true,
                    type: NotificationTypes.CHILD_BRANCH_REQUEST_ANSWERED,
                    data: {
                      action: 'accept',
                      username: req.user.username,
                      parentid: req.params.branchid,
                      childid: req.params.childid
                    }
                  });

                  var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
                  var invalids = notification.validate(propertiesToCheck);
                  if(invalids.length > 0) {
                    console.error('Error creating notification.');
                    return error.InternalServerError(res);
                  }

                  return notification.save(req.sessionID);
                }).then(function() {
                  // create notifications for all branch mods (child and parent)
                  // that the branch has been moved

                  // first fetch the parent branch mods
                  return new Mod().findByBranch(req.params.branchid);
                }).then(function(mods) {
                  parentMods = mods;
                  // fetch the child branch mods
                  return new Mod().findByBranch(req.params.childid);
                }).then(function(mods) {
                  childMods = mods;
                  // remove any duplicates e.g. for user who is a mod of both branches
                  var allMods = _.uniqBy(parentMods.concat(childMods), 'username');
                  var promises = [];
                  for(var i = 0; i < allMods.length; i++) {
                    // create a notification for mod that the branch was moved
                    // to a new parent
                    var time = new Date().getTime();
                    var notification = new Notification({
                      id: allMods[i].username + '-' + time,
                      user: allMods[i].username,
                      date: time,
                      unread: true,
                      type: NotificationTypes.BRANCH_MOVED,
                      data: {
                        childid: req.params.childid,
                        parentid: req.params.branchid
                      }
                    });

                    var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
                    var invalids = notification.validate(propertiesToCheck);
                    if(invalids.length > 0) {
                      console.error('Error creating notification.');
                      return error.InternalServerError(res);
                    }

                    promises.push(notification.save(req.sessionID));
                  }

                  return Promise.all(promises);
                }).then(function () {
                  // All done!
                  return success.OK(res);
                }).catch(function(err) {
                  console.error("Error accepting request: ", err);
                  return error.InternalServerError(res);
                });
              }, function(err) {
                console.error("Error updating tags: ", err);
                return error.InternalServerError(res);
              });
            });
          }, function() {
            console.error("Error fetching branch tags");
            return error.InternalServerError(res);
          });
        });
      // Reject the request:
      } else {
        // delete the request from the table
        deletePromise.then(function() {
          // save the child mod log entry
          return entryChild.save();
        }).then(function() {
          // save the parent mod log entry
          return entryParent.save();
        }).then(function() {
          // create a notification for the creator of the subbranch request
          // indicating that it was rejected
          var time = new Date().getTime();
          var notification = new Notification({
            id: data[0].creator + '-' + time,
            user: data[0].creator,
            date: time,
            unread: true,
            type: NotificationTypes.CHILD_BRANCH_REQUEST_ANSWERED,
            data: {
              action: 'reject',
              username: req.user.username,
              parentid: req.params.branchid,
              childid: req.params.childid
            }
          });

          var propertiesToCheck = ['id', 'user', 'date', 'unread', 'type', 'data'];
          var invalids = notification.validate(propertiesToCheck);
          if(invalids.length > 0) {
            console.error('Error creating notification.');
            return error.InternalServerError(res);
          }

          return notification.save(req.sessionID);
        }).then(function() {
          return success.OK(res);
        }).catch(function() {
          return error.InternalServerError(res);
        });
      }
    }, function(err) {
      if(err) {
        console.error("Error fetching subbranch request:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};