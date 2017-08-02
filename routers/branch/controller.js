'use strict';

const aws = require('../../config/aws');
const Branch = require('../../models/branch.model');
const BranchImage = require('../../models/branch-image.model');
const Constant = require('../../models/constant');
const error = require('../../responses/errors');
const fs = require('../../config/filestorage');
const mailer = require('../../config/mailer');
const Mod = require('../../models/mod.model');
const ModLogEntry = require('../../models/mod-log-entry.model');
const SubBranchRequest = require('../../models/subbranch-request.model');
const success = require('../../responses/successes');
const Tag = require('../../models/tag.model');
const User = require('../../models/user.model');

module.exports = {
  get(req, res) {
    const branchid = req.params.branchid;

    if (!branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    const p1 = module.exports.getBranchPicture(branchid, 'picture', false);
    const p2 = module.exports.getBranchPicture(branchid, 'picture', true);
    const p3 = module.exports.getBranchPicture(branchid, 'cover', false);
    const p4 = module.exports.getBranchPicture(branchid, 'cover', true);

    Promise.all([p1, p2, p3, p4]).then(values => {
      const branch = new Branch();

      branch.findById(branchid)
        .then( _ => {
          // Attach parent branch
          /*
          if ('root' === branch.parentid || 'none' === branch.parentid) {
            branch.parent = {
              id: branch.parentid
            };
          }
          else {
            res = yield this.API.fetch('/branch/:branchid', { branchid: branch.parentid });
            branch.parent = res.data;
          }

          delete branch.parentid;
          */

          branch.data.profileUrl = values[0];
          branch.data.profileUrlThumb = values[1];
          branch.data.coverUrl = values[2];
          branch.data.coverUrlThumb = values[3];
          return success.OK(res, branch.data);
        })
        .catch(err => {
          if (err) {
            console.error(`Error fetching branch:`, err);
            return error.InternalServerError(res);
          }

          return error.NotFound(res);
        });
    });
  },

  getBranchPicture(branchid, type, thumbnail = false) {
    return new Promise((resolve, reject) => {
      if (!branchid || ('picture' !== type && 'cover' !== type)) return resolve('');

      let size;

      if ('picture' === type) {
        size = thumbnail ? 200 : 640;
      }
      else {
        size = thumbnail ? 800 : 1920;
      }

      const image = new BranchImage();

      image.findById(branchid, type)
        .then( _ => {
          let params = '';

          // Append timestamp for correct caching on the client.
          if (image.data.date) {
            params = `?time=${image.data.date}`;
          }

          const Bucket = fs.Bucket.BranchImagesResized;
          const Key = `${image.data.id}-${size}.${image.data.extension}`;
          return resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}${params}`);
        })
        .catch(err => {
          if (err) {
            console.error(`Error fetching branch image:`, err);
            return resolve('');
          }

          return resolve('');
        });
    });
  },

  post(req, res) {
    if (!req.user.username) {
      console.error('No username found in session.');
      return error.InternalServerError(res);
    }

    // create branch object
    var time = new Date().getTime();
    var branch = new Branch({
      id: req.body.id,
      name: req.body.name,
      creator: req.user.username,
      date: time,
      parentid: req.body.parentid,
      post_count: 0,
      post_points: 0,
      post_comments: 0
    });

    // validate branch properties
    var propertiesToCheck = ['id', 'name', 'creator', 'date', 'parentid'];
    var invalids = branch.validate(propertiesToCheck);
    if (invalids.length > 0) {
      return error.BadRequest(res, invalids[0]);
    }

    // check whether the specified branch id is unique
    new Branch().findById(req.body.id).then(function() {
      return error.BadRequest(res, 'That Unique Name is already taken');
    }, function(err) {
      if(err) {
        return error.InternalServerError(res);
      }

      var user = new User();
      var branchCount = new Constant();
      // ensure the specified parent branch exists
      return new Branch().findById(req.body.parentid).then(function() {
        // save a subbranch request iff. the parentid is not the root branch
        if(req.body.parentid != 'root') {
          // create new subbranch request for the given parentid
          var subbranchRequest = new SubBranchRequest({
            parentid: req.body.parentid,
            childid: req.body.id,
            date: time,
            creator: req.user.username
          });
          // validate request properties
          var propertiesToCheck = ['parentid', 'childid', 'date', 'creator'];
          invalids = subbranchRequest.validate(propertiesToCheck);
          if(invalids.length > 0) {
            return error.BadRequest(res, 'Invalid ' + invalids[0]);
          }
          // save the request
          return subbranchRequest.save(req.sessionID);
        } else {
          return new Promise(function(resolve, reject) {
            resolve();
          });
        }
      }).then(function() {
        // create mod object
        var mod = new Mod({
          branchid: req.body.id,
          date: time,
          username: req.user.username
        });

        // validate mod properties
        propertiesToCheck = ['branchid', 'date', 'username'];
        invalids = mod.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }

        // save the mod of new branch
        return mod.save();
      }).then(function() {
        // save the new branch
        branch.set('parentid', 'root');
        return branch.save();
      }).then(function () {
        // add the branchid to the tags table with the tags of itself and
        // those of its parent (just 'root')
        var branchTag = new Tag({
          branchid: branch.data.id,
          tag: branch.data.id
        });
        propertiesToCheck = ['branchid', 'tag'];
        invalids = branchTag.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }
        return branchTag.save();
      }).then(function () {
        var rootTag = new Tag({
          branchid: branch.data.id,
          tag: 'root'
        });
        propertiesToCheck = ['branchid', 'tag'];
        invalids = rootTag.validate(propertiesToCheck);
        if(invalids.length > 0) {
          return error.BadRequest(res, 'Invalid ' + invalids[0]);
        }
        return rootTag.save();
      }).then(function () {
        // get the user
        return user.findByUsername(req.user.username);
      }).then(function () {
        // increment the user's branch and mod count
        user.set('num_branches', user.data.num_branches + 1);
        user.set('num_mod_positions', user.data.num_mod_positions + 1);
        return user.update();
      }).then(function () {
        // update the SendGrid contact list with the new user data
        return mailer.addContact(user.data, true);
      }).then(function() {
        // update the branch_count constant
        return branchCount.findById('branch_count');
      }).then(function() {
        branchCount.set('data', branchCount.data.data + 1);
        return branchCount.update();
      }).then(function() {
        return success.OK(res);
      }).catch(function(err) {
        return error.InternalServerError(res);
      });
    });
  },
  
  put(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var branch = new Branch({
      id: req.params.branchid
    });

    var propertiesToCheck = [];
    if(req.body.name) {
      branch.set('name', req.body.name);
      propertiesToCheck.push('name');
    }

    if(req.body.description) {
      branch.set('description', req.body.description);
      propertiesToCheck.push('description');
    }

    if(req.body.rules) {
      branch.set('rules', req.body.rules);
      propertiesToCheck.push('rules');
    }

    // Check new parameters are valid, ignoring id validity
    var invalids = branch.validate(propertiesToCheck);

    if(invalids.length > 0) {
      return error.BadRequest(res, 'Invalid ' + invalids[0]);
    }
    branch.update().then(function() {
      return success.OK(res);
    }, function() {
      return error.InternalServerError(res);
    });
  },

  delete(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var branch = new Branch();
    var profile = new BranchImage();
    var cover = new BranchImage();
    var branchCount = new Constant();
    branch.findById(req.params.branchid).then(function() {
      // IF THE BRANCH IS A ROOT BRANCH, DELETE PERMANENTLY
      if(branch.data.parentid === 'root') {
        // delete the branch
        return branch.delete({
          id: req.params.branchid
        }).then(function() {
          // get branch profile picture
          return new Promise(function(resolve, reject) {
            profile.findById(req.params.branchid, 'picture').then(resolve, function(err) {
              if(err) return reject();
              resolve();
            });
          });
        }).then(function () {
          // get branch cover picture
          return new Promise(function(resolve, reject) {
            profile.findById(req.params.branchid, 'cover').then(resolve, function(err) {
              if(err) return reject();
              resolve();
            });
          });
        }).then(function() {
          // delete orig branch profile and cover pictures from s3
          return new Promise(function(resolve, reject) {
            var objects = [];
            if(profile.data.id) {
              objects.push({
                Key: profile.data.id + '-orig.' + profile.data.extension
              });
            }
            if(cover.data.id) {
              objects.push({
                Key: cover.data.id + '-orig.' + cover.data.extension
              });
            }
            if(objects.length == 0) {
              return resolve();
            }
            aws.s3Client.deleteObjects({
              Bucket: fs.Bucket.BranchImages,
              Delete: {
                Objects: objects
              }
            }, function(err) {
              if(err) return reject(err);
              resolve();
            });
          });
        }).then(function() {
          // delete resized branch profile and cover pictures from s3
          return new Promise(function(resolve, reject) {
            var objects = [];
            if(profile.data.id) {
              objects.push({
                Key: profile.data.id + '-640.' + profile.data.extension
              });
            }
            if(cover.data.id) {
              objects.push({
                Key: cover.data.id + '-1920.' + cover.data.extension
              });
            }
            if(objects.length == 0) {
              return resolve();
            }
            aws.s3Client.deleteObjects({
              Bucket: fs.Bucket.BranchImagesResized,
              Delete: {
                Objects: objects
              }
            }, function(err) {
              if(err) return reject(err);
              resolve();
            });
          });
        }).then(function () {
          // delete branch profile image from db
          return new BranchImage().delete({
            id: req.params.branchid + '-picture'
          });
        }).then(function() {
          // delete branch cover image from db
          var cover = new BranchImage();
          return cover.delete({
            id: req.params.branchid + '-cover'
          });
        }).then(function() {
          // get mod log entries for this branch
          return new ModLogEntry().findByBranch(req.params.branchid);
        }).then(function(entries) {
          // delete all mod log entries
          var promises = [];
          for(var i = 0; i < entries.length; i++) {
            promises.push(new ModLogEntry().delete({
              branchid: entries[i].branchid,
              date: entries[i].date
            }));
          }
          return Promise.all(promises);
        }).then(function () {
          // fetch all mods for this branch
          return new Mod().findByBranch(req.params.branchid);
        }).then(function(mods) {
          // delete all mods
          var promises = [];
          for(var i = 0; i < mods.length; i++) {
            promises.push(new Mod().delete({
              branchid: mods[i].branchid,
              date: mods[i].date
            }));
          }
          return Promise.all(promises);
        }).then(function() {
          // fetch all tags on this branch
          return new Tag().findByBranch(req.params.branchid);
        }).then(function(tags) {
          // delete all tags
          var promises = [];
          for(var i = 0; i < tags.length; i++) {
            promises.push(new Tag().delete({
              branchid: tags[i].branchid,
              tag: tags[i].tag
            }));
          }
          return Promise.all(promises);
        }).then(function() {
          // fetch all tags of this branch on other branches
          return new Tag().findByTag(req.params.branchid);
        }).then(function(tags) {
          // delete all tags
          var promises = [];
          for(var i = 0; i < tags.length; i++) {
            promises.push(new Tag().delete({
              branchid: tags[i].branchid,
              tag: tags[i].tag
            }));
          }
          return Promise.all(promises);
        }).then(function() {
          // get the deleted branch's subbranches
          return branch.findSubbranches(req.params.branchid, 0, 'date');
        }).then(function(subbranches) {
          // update all subbranches parents to 'root'
          var promises = [];
          for(var i = 0; i < subbranches.length; i++) {
            var b = new Branch(subbranches[i]);
            b.set('parentid', 'root');
            promises.push(b.update());
          }
          return Promise.all(promises);
        }).then(function() {
          return branchCount.findById('branch_count');
        }).then(function() {
          // decrement branch_count constant
          branchCount.set('data', branchCount.data.data - 1);
          return branchCount.update();
        }).then(function() {
          return success.OK(res);
        }, function(err) {
          console.error("Error deleting branch:", err);
          return error.InternalServerError(res);
        });
      } else {
        // IF THE BRANCH IS A CHILD BRANCH, DETACH IT FROM ITS PARENT
        // AND MAKE IT A ROOT BRANCH (KEEPING ITS SUBTREE INTACT)
        branch.set('parentid', 'root');
        var tagsToRemove = [];
        branch.update().then(function() {
          // remove all tags from branch to be removed (except self)
          // and remember these - they'll be removed from all children too
          new Tag().findByBranch(branch.data.id).then(function(tags) {
            var promises = [];
            for(var i = 0; i < tags.length; i++) {
              if(tags[i].tag !== branch.data.id && tags[i].tag !== 'root') {
                tagsToRemove.push(tags[i].tag);
                promises.push(new Tag().delete({
                  branchid: branch.data.id,
                  tag: tags[i].tag
                }));
              }
            }
            return Promise.all(promises);
          }).then(function() {
            // get all children of the branch being removed on path to leaves
            return new Tag().findByTag(branch.data.id);
          }).then(function(children) {
            // remove the tags from all children
            var promises = [];
            for(var i = 0; i < children.length; i++) {
              for(var j = 0; j < tagsToRemove.length; j++) {
                promises.push(new Tag().delete({
                  branchid: children[i].branchid,
                  tag: tagsToRemove[j]
                }));
              }
            }
            return Promise.all(promises);
          }).then(function() {
            return success.OK(res);
          }).catch(function(err) {
            console.error("Error deleting child branch:", err);
            return error.InternalServerError(res);
          });
        }).catch(function(err) {
          if(err) {
            console.error("Error deleting child branch:", err);
            return error.InternalServerError(res);
          }
        });
      }
    }, function(err) {
      if(err) return error.InternalServerError(res);
      // no err, branch was not found
      return error.NotFound(res);
    });
  },

  getPictureUploadUrl(req, res, type) {
    if (!req.user || !req.user.username) {
      return error.Forbidden(res);
    }

    if (!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (type !== 'picture' && type !== 'cover') {
      return error.InternalServerError(res);
    }

    aws.s3Client.getSignedUrl('putObject', {
      Bucket: fs.Bucket.BranchImages,
      ContentType: 'image/*',
      Key: `${req.params.branchid}-${type}-orig.jpg`
    }, (err, url) => {
      return success.OK(res, url);
    });
  },

  getPicture(req, res, type, thumbnail) {
    if (!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (type !== 'picture' && type !== 'cover') {
      return error.InternalServerError(res);
    }

    let size;

    if (type === 'picture') {
      size = thumbnail ? 200 : 640;
    }
    else {
      size = thumbnail ? 800 : 1920;
    }

    const image = new BranchImage();

    image.findById(req.params.branchid, type)
      .then(_ => {
        aws.s3Client.getSignedUrl('getObject', {
          Bucket: fs.Bucket.BranchImagesResized,
          Key: `${image.data.id}-${size}.${image.data.extension}`
        }, (err, url) => {
          if (err) {
            return error.InternalServerError(res);
          }

          return success.OK(res, url);
        });
      })
      .catch(err => {
        if (err) {
          return error.InternalServerError(res);
        }

        return error.NotFound(res);
      });
  },

  getSubbranches(req, res) {
    if (!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    if (!req.query.timeafter) {
      return error.BadRequest(res, 'Missing timeafter');
    }

    const branch = new Branch();
    const sortBy = req.query.sortBy || 'date';

    let branches = [];
    let lastBranch = null;
    
    // if lastBranchId is specified, client wants results which appear _after_ this branch (pagination)
    new Promise( (resolve, reject) => {
      if (req.query.lastBranchId) {
        const last = new Branch();

        // get the branch
        last.findById(req.query.lastBranchId)
          .then( _ => {
            // create lastBranch object
            lastBranch = last.data;
            return resolve();
          })
          .catch( err => {
            if (err) {
              return reject();
            }

            return error.NotFound(res); // lastBranchId is invalid
          });
      }
      else {
        // no last branch specified, continue
        return resolve();
      }
    })
    .then( _ => branch.findSubbranches(req.params.branchid, req.query.timeafter, sortBy, lastBranch) )
    .then( results => {
      branches = results;

      let promises = [];

      for (let i = 0; i < branches.length; i++) {
        promises.push( new Promise( (resolve, reject) => {
          new BranchImage().findById(branches[i].id, 'picture')
            .then( branchimage => {
              const Bucket = fs.Bucket.BranchImagesResized;
              const Key = `${branchimage.id}-640.${branchimage.extension}`;
              return resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}`);
            })
            .catch( err => {
              if (err) {
                return reject();
              }

              return resolve('');
            });
        }));
      }

      return Promise.all(promises);
    })
    .then( urls => {
      let promises = [];
      
      for (let i = 0; i < branches.length; i++) {
        // attach branch image url to each branch
        branches[i].profileUrl = urls[i];
        
        promises.push(new Promise(function(resolve, reject) {
          new BranchImage().findById(branches[i].id, 'picture')
            .then( branchimage => {
              const Bucket = fs.Bucket.BranchImagesResized;
              const Key = `${branchimage.id}-200.${branchimage.extension}`;
              return resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}`);
            })
            .catch( err => {
              if (err) {
                return reject();
              }

              return resolve('');
            });
        }));
      }

      return Promise.all(promises);
    })
    .then( urls => {
      // attach branch image thumbnail url to each branch
      for (let i = 0; i < branches.length; i++) {
        branches[i].profileUrlThumb = urls[i];
      }

      return success.OK(res, branches);
    })
    .catch( err => {
      console.error(`Error fetching subbranches:`, err);
      return error.InternalServerError(res);
    });
  },

  getModLog(req, res) {
    if(!req.params.branchid) {
      return error.BadRequest(res, 'Missing branchid');
    }

    var log = new ModLogEntry();
    log.findByBranch(req.params.branchid).then(function(data) {
      return success.OK(res, data);
    }, function(err) {
      if(err) {
        console.error("Error fetching mod log:", err);
        return error.InternalServerError(res);
      }
      return error.NotFound(res);
    });
  }
};
