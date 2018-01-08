const reqlib = require('app-root-path').require;

const algolia = reqlib('config/algolia');
const Constants = reqlib('config/constants');
const error = reqlib('responses/errors');
const fs = reqlib('config/filestorage');
const mailer = reqlib('config/mailer');
const Models = reqlib('models/');
const RequestsController = reqlib('routers/requests/controller');
const success = reqlib('responses/successes');

const {
  BranchCoverType,
  BranchThumbnailType,
} = Constants;
const { BranchImageTypes } = Constants.AllowedValues;
const { createBranchImageId } = Constants.Helpers;

// Deletes the branch completely and moves all of its children under b/root.
const deleteBranch = branch => {
  const branchid = branch.get('id');
  let deletedImagesArr = [];
  let deletedImagesResizedArr = [];

  return branch.destroy()
    // Fetch branch pictures.
    .then(() => Models.BranchImage.findById(createBranchImageId(branchid, BranchThumbnailType)))
    .then(instance => {
      if (instance !== null) {
        const ext = instance.get('extension');
        const id = instance.get('id');

        deletedImagesArr = [
          ...deletedImagesArr,
          { Key: `${id}-orig.${ext}` },
        ];

        deletedImagesResizedArr = [
          ...deletedImagesResizedArr,
          { Key: `${id}-200.${ext}` },
          { Key: `${id}-640.${ext}` },
        ];
      }

      return Models.BranchImage.findById(createBranchImageId(branchid, BranchCoverType));
    })
    // Delete branch profile and cover pictures from storage.
    .then(instance => {
      if (instance !== null) {
        const ext = instance.get('extension');
        const id = instance.get('id');

        deletedImagesArr = [
          ...deletedImagesArr,
          { Key: `${id}-orig.${ext}` },
        ];

        deletedImagesResizedArr = [
          ...deletedImagesResizedArr,
          { Key: `${id}-800.${ext}` },
          { Key: `${id}-1920.${ext}` },
        ];
      }

      if (!deletedImagesArr.length) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => Models.Dynamite.aws.s3Client.deleteObjects({
        Bucket: fs.Bucket.BranchImages,
        Delete: {
          Objects: deletedImagesArr,
        },
      }, err => {
        if (err) {
          return reject(err);
        }

        return resolve();
      }));
    })
    .then(() => {
      if (!deletedImagesResizedArr.length) {
        return Promise.resolve();
      }

      return new Promise((resolve, reject) => Models.Dynamite.aws.s3Client.deleteObjects({
        Bucket: fs.Bucket.BranchImagesResized,
        Delete: {
          Objects: deletedImagesResizedArr,
        },
      }, err => {
        if (err) {
          return reject(err);
        }

        return resolve();
      }));
    })
    // Delete branch pictures from database.
    // .then(() => new BranchImage().delete({ id: `${branchid}-picture` }))
    // .then(() => new BranchImage().delete({ id: `${branchid}-cover` }))
    // Delete mod log entries.
    .then(() => Models.ModLog.findByBranch(branchid))
    .then(entries => {
      let promises = [];

      for (let i = 0; i < entries.length; i += 1) {
        const promise = entries[i].destroy();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Delete branch moderators.
    .then(() => Models.Mod.findByBranch(branchid))
    .then(mods => {
      let promises = [];

      for (let i = 0; i < mods.length; i += 1) {
        const promise = mods[i].destroy();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Delete all branch tags.
    .then(() => Models.Tag.findByBranch(branchid))
    .then(tags => {
      let promises = [];

      for (let i = 0; i < tags.length; i += 1) {
        const promise = tags[i].destroy();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Delete this branch's tag from its children.
    .then(() => Models.Tag.findByTag(branchid))
    .then(tags => {
      let promises = [];

      for (let i = 0; i < tags.length; i += 1) {
        const promise = tags[i].destroy();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Change all direct children parentid to b/root.
    .then(() => Models.Branch.findSubbranches(branchid, 0, 'date', null, 0))
    .then(children => {
      let promises = [];

      for (let i = 0; i < children.length; i += 1) {
        const instance = children[i];
        instance.set('parentid', 'root');
        const promise = instance.update();
        promises = [
          ...promises,
          promise,
        ];
      }

      return Promise.all(promises);
    })
    // Decrement the branch_count constant.
    .then(() => Models.Constant.findById('branch_count'))
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Constant does not exist.',
          status: 404,
        });
      }

      instance.set('data', instance.get('data') - 1);
      return instance.update();
    })
    .catch(err => {
      console.error(`Error deleting b/${branchid}:`, err);
      return Promise.reject(err);
    });
};

// Detaches the branch from its parent and moves it under b/root.
// Tree structure remains unchanged.
const detachBranch = branch => {
  const branchid = branch.get('id');
  let deletedTagsArr = [];

  branch.set('parentid', 'root');

  return branch.update()
    // Delete all branch tags from the tree root, except for self and b/root.
    .then(() => Models.Tag.findByBranch(branchid))
    .then(tags => {
      let promises = [];

      for (let i = 0; i < tags.length; i += 1) {
        const tag = tags[i].get('tag');
        if (tag !== branchid && tag !== 'root') {
          const promise = Models.Tag.destroy({
            branchid,
            tag,
          });

          deletedTagsArr = [
            ...deletedTagsArr,
            tag,
          ];

          promises = [
            ...promises,
            promise,
          ];
        }
      }

      return Promise.all(promises);
    })
    // Delete all branch tags from tree children.
    .then(() => Models.Tag.findByTag(branchid))
    .then(tags => {
      let promises = [];

      for (let i = 0; i < tags.length; i += 1) {
        for (let j = 0; j < deletedTagsArr.length; j += 1) {
          const promise = Models.Tag.destroy({
            branchid: tags[i].get('branchid'),
            tag: deletedTagsArr[j],
          });

          promises = [
            ...promises,
            promise,
          ];
        }
      }

      return Promise.all(promises);
    })
    .catch(err => {
      console.error(`Error detaching b/${branchid}:`, err);
      return Promise.reject(err);
    });
};

module.exports.createBranch = (req, res) => {
  const {
    id: childBranchId,
    name,
    parentid: parentBranchId,
  } = req.body;
  const creator = req.user.get('username');
  const date = new Date().getTime();

  return Models.Branch.findById(childBranchId)
    .then(instance => {
      if (instance !== null) {
        return Promise.reject({
          message: `${childBranchId} already exists.`,
          status: 400,
        });
      }

      // The parent branch must exist.
      return Models.Branch.findById(parentBranchId);
    })
    // If we are attaching branch to anything other than root, we will
    // need a permission to do so before moving it there.
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: `${parentBranchId} does not exist.`,
          status: 404,
        });
      }

      if (parentBranchId === 'root') {
        return Promise.resolve();
      }

      return Models.SubBranchRequest.create({
        childid: childBranchId,
        creator,
        date,
        parentid: parentBranchId,
      });
    })
    // Make the user automatically the first moderator of the new branch.
    .then(() => Models.Mod.create({
      branchid: childBranchId,
      date,
      username: creator,
    }))
    // Create the new branch.
    .then(() => Models.Branch.create({
      creator,
      date,
      id: childBranchId,
      name,
      // By default, every branch is a child of root.
      // We will add request to the parentBranchId below
      // if it's different from root.
      parentid: 'root',
      post_comments: 0,
      post_count: 0,
      post_points: 0,
    }))
    // Add new branch to the search index.
    // todo
    .then(instance => algolia.addObjects(instance.dataValues, 'branch'))
    // Create tags for the new branch - since it's only a child of root for now,
    // these will always be equal to 'root' and childBranchId.
    // Skip validation as we have already established above that childBranchId
    // is valid. We have created a branch with its name, after all.
    .then(() => Models.Tag.create({
      branchid: childBranchId,
      tag: childBranchId,
    }))
    .then(() => Models.Tag.create({
      branchid: childBranchId,
      tag: 'root',
    }))
    // Increase user's branch and mod count.
    .then(() => {
      req.user.set('num_branches', req.user.get('num_branches') + 1);
      req.user.set('num_mod_positions', req.user.get('num_mod_positions') + 1);
      return req.user.update();
    })
    // Update the SendGrid contact list with the new user data.
    // todo
    .then(() => mailer.addContact(req.user.dataValues, true))
    // Update branch_count.
    .then(() => Models.Constant.findById('branch_count'))
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Constant does not exist.',
          status: 404,
        });
      }

      instance.set('data', instance.get('data') + 1);
      return instance.update();
    })
    // Remember how we put this branch under root because we might need a permission
    // in case we want to attach it to any branch other than root? Well, here we will
    // find out if we really need a permission to move this newly created branch.
    .then(() => {
      if (parentBranchId === 'root') {
        return Promise.resolve();
      }

      return Models.Mod.findByBranch(parentBranchId);
    })
    .then(mods => {
      // We don't need a permission but there is also
      // nothing to move as we are already under root,
      // so we can end it here.
      if (parentBranchId === 'root') {
        return success.OK(res);
      }

      mods = mods.map(obj => obj.get('username'));

      // We don't need a permission.
      if (mods.includes(creator)) {
        // Inject the action parameter to the request so it doesn't
        // fail while accepting the branch request.
        req.body.action = 'accept';
        req.params.childid = childBranchId;
        req.params.branchid = parentBranchId;
        return RequestsController.put(req, res);
      }

      // We need a permission, end it here.
      return success.OK(res);
    })
    .catch(err => {
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }
      return error.InternalServerError(res, err);
    });
};

module.exports.delete = (req, res) => {
  const { child: childBranch } = req.query;
  const { branchid: parentBranch } = req.params;

  let branch;
  let child;

  return Models.Branch.findById(parentBranch)
    // Fetch child branch data if defined.
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: `b/${parentBranch} does not exist.`,
          status: 404,
        });
      }

      branch = instance;

      if (childBranch) {
        return Models.Branch.findById(childBranch);
      }
      return Promise.resolve();
    })
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: `b/${childBranch} does not exist.`,
          status: 404,
        });
      }

      child = instance;

      // Decide which action to take and check permissions.
      if (branch.get('id') === 'root') {
        // Delete any branch, we are admins so we can pick anything except root.
        if (child && child.get('id') !== 'root') {
          return deleteBranch(child);
        }

        return Promise.reject({
          code: 403,
          message: 'You cannot delete the root branch.',
        });
      }

      // Detach a branch, check if it's a direct child.
      if (child) {
        if (child.get('parentid') === branch.get('id')) {
          return detachBranch(child);
        }

        return Promise.reject({
          code: 403,
          message: `b/${childBranch} is not a direct child branch of b/${parentBranch}.`,
        });
      }

      // Delete this branch.
      return deleteBranch(branch);
    })
    .then(() => success.OK(res))
    .catch(err => {
      if (typeof err === 'object' && err.status) {
        return error.code(res, err.status, err.message);
      }

      return error.InternalServerError(res);
    });
};

module.exports.get = (req, res) => {
  const { branchid } = req.params;
  let branch;

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  return Models.Branch.findById(branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject();
      }

      branch = instance;

      const p1 = module.exports.getBranchPicture(branchid, BranchThumbnailType, false);
      const p2 = module.exports.getBranchPicture(branchid, BranchThumbnailType, true);
      const p3 = module.exports.getBranchPicture(branchid, BranchCoverType, false);
      const p4 = module.exports.getBranchPicture(branchid, BranchCoverType, true);

      return Promise.all([p1, p2, p3, p4]);
    })
    .then(values => {
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

      branch.set('profileUrl', values[0]);
      branch.set('profileUrlThumb', values[1]);
      branch.set('coverUrl', values[2]);
      branch.set('coverUrlThumb', values[3]);
      // todo
      return success.OK(res, branch.dataValues);
    })
    .catch(err => {
      if (err) {
        console.error('Error fetching branch:', err);
        return error.InternalServerError(res);
      }

      return error.NotFound(res);
    });
};

module.exports.getBranchPicture = (branchid, type, thumbnail = false) => {
  if (!branchid || !BranchImageTypes.includes(type)) return Promise.resolve('');

  let size;
  if (type === BranchThumbnailType) {
    size = thumbnail ? 200 : 640;
  }
  else {
    size = thumbnail ? 800 : 1920;
  }

  return Models.BranchImage.findById(createBranchImageId(branchid, type))
    .then(instance => {
      if (instance === null) {
        return Promise.resolve('');
      }

      const date = instance.get('date');
      const extension = instance.get('extension');
      const id = instance.get('id');
      let params = '';

      // Append timestamp for correct caching on the client.
      if (date) {
        params = `?time=${date}`;
      }

      const Bucket = fs.Bucket.BranchImagesResized;
      const Key = `${id}-${size}.${extension}`;
      return Promise.resolve(`https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}${params}`);
    })
    .catch(err => {
      console.error('Error fetching branch image:', err);
      return Promise.resolve('');
    });
};

module.exports.getModLog = (req, res) => {
  const { branchid } = req.params; 

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  return Models.ModLog.findByBranch(branchid)
    // todo
    .then(logs => success.OK(res, logs.map(instance => instance.dataValues)))
    .catch(err => {
      console.error('Error fetching mod log:', err);
      return error.InternalServerError(res);
    });
};

module.exports.getPicture = (req, res, type, thumbnail) => {
  const { branchid } = req.params;

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  if (!BranchImageTypes.includes(type)) {
    return error.BadRequest(res, 'Invalid picture type.');
  }

  let size;
  if (type === BranchThumbnailType) {
    size = thumbnail ? 200 : 640;
  }
  else {
    size = thumbnail ? 800 : 1920;
  }

  return Models.BranchImage.findById(createBranchImageId(branchid, type))
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Branch image does not exist.',
          status: 404,
        });
      }

      return new Promise((resolve, reject) => Models.Dynamite.aws.s3Client.getSignedUrl('getObject', {
        Bucket: fs.Bucket.BranchImagesResized,
        Key: `${instance.get('id')}-${size}.${instance.get('extension')}`,
      }, (err, url) => {
        if (err) {
          return reject(err);
        }

        return resolve(url);
      }));
    })
    .then(url => success.OK(res, url))
    .catch(err => {
      console.log('Error getting picture:', err);
      return error.code(res, err.status, err.message);
    });
};

module.exports.getPictureUploadUrl = (req, res, type) => {
  const { branchid } = req.params;

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  if (!BranchImageTypes.includes(type)) {
    return error.BadRequest(res, 'Invalid picture type.');
  }

  return new Promise((resolve, reject) => Models.Dynamite.aws.s3Client.getSignedUrl('putObject', {
    Bucket: fs.Bucket.BranchImages,
    ContentType: 'image/*',
    Key: `${branchid}-${type}-orig.jpg`,
  }, (err, url) => {
    if (err) {
      return reject(err);
    }
    return resolve(url);
  }))
    .then(url => success.OK(res, url))
    .catch(err => {
      console.log('Error getting picture:', err);
      return error.code(res, err.status, err.message);
    });
};

module.exports.getSubbranches = (req, res) => {
  const { branchid } = req.params;
  const {
    lastBranchId,
    timeafter,
  } = req.query;

  if (!branchid) {
    return error.BadRequest(res, 'Missing branchid');
  }

  if (!timeafter) {
    return error.BadRequest(res, 'Missing timeafter');
  }

  // const branch = new Branch();
  const sortBy = req.query.sortBy || 'date';

  let branches = [];
  let lastBranch = null;
  
  // if lastBranchId is specified, client wants results which appear _after_ this branch (pagination)
  return new Promise((resolve, reject) => {
    if (lastBranchId) {
      return Models.Branch.findById(lastBranchId)
        .then(instance => {
          if (instance === null) {
            return Promise.reject({ code: 404 });
          }

          lastBranch = instance;
          return resolve();
        })
        .catch(err => reject(err));
    }

    // No last branch specified, continue.
    return resolve();
  })
    .then(() => Models.Branch.findSubbranches(branchid, timeafter, sortBy, lastBranch))
    // Attach branch profile images.
    .then(instances => {
      branches = instances;

      let promises = [];

      for (let i = 0; i < branches.length; i += 1) {
        promises.push(new Promise((resolve, reject) => {
          const branch = branches[i];
          const id = branch.get('id');

          Models.BranchImage
            .findById(createBranchImageId(id, BranchThumbnailType))
            .then(instance => {
              if (instance === null) {
                return resolve('');
              }

              const date = instance.get('date');
              const extension = instance.get('extension');
              const id = instance.get('id');

              const time = date ? `?time=${date}` : '';
              const Bucket = fs.Bucket.BranchImagesResized;
              const Key = `${id}-640.${extension}`;
              const KeyThumb = `${id}-200.${extension}`;
              const profileUrl = `https://${Bucket}.s3-eu-west-1.amazonaws.com/${Key}${time}`;
              const profileUrlThumb = `https://${Bucket}.s3-eu-west-1.amazonaws.com/${KeyThumb}${time}`;

              branch.set('profileUrl', profileUrl);
              branch.set('profileUrlThumb', profileUrlThumb);

              return resolve();
            })
            .catch(err => {
              console.log(err);
              return reject();
            });
        }));
      }

      return Promise.all(promises);
    })
    .then(() => success.OK(res, branches.map(instance => ({
      creator: instance.get('creator'),
      date: instance.get('date'),
      id: instance.get('id'),
      name: instance.get('name'),
      parentid: instance.get('parentid'),
      post_comments: instance.get('post_comments'),
      post_count: instance.get('post_count'),
      post_points: instance.get('post_points'),
      profileUrl: instance.get('profileUrl'),
      profileUrlThumb: instance.get('profileUrlThumb'),
    }))))
    .catch(err => {
      console.error('Error fetching subbranches:', err);
      return error.InternalServerError(res);
    });
};

module.exports.put = (req, res) => {
  const {
    description,
    name,
    rules,
  } = req.body;
  const { branchid } = req.params;
  let branch;

  if (!branchid) {
    return error.BadRequest(res, 'Invalid branchid.');
  }

  return Models.Branch.findById(branchid)
    .then(instance => {
      if (instance === null) {
        return Promise.reject({
          message: 'Branch does not exist.',
          status: 404,
        });
      }

      branch = instance;
      if (description !== undefined) branch.set('description', description);
      if (name !== undefined) branch.set('name', name);
      if (rules !== undefined) branch.set('rules', rules);
      return branch.update();
    })
    // Update branch in the search index.
    // todo
    .then(() => algolia.updateObjects(branch.dataValues, 'branch'))
    .then(() => success.OK(res))
    .catch(() => error.InternalServerError(res));
};
