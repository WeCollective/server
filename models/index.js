const fs = require('fs');
const path = require('path');
const reqlib = require('app-root-path').require;

const Dynamite = reqlib('config/Dynamite/');

const BASE_DIR = __dirname;
const THIS_FILE = 'index.js';
const models = {};

const isFolder = str => !str.includes('.');
const isSystemFile = str => str.indexOf('.') === 0;

const importModels = dir => {
  fs
    .readdirSync(dir)
    .filter(file => {
      if (isFolder(file) && THIS_FILE !== file) {
        importModels(path.join(dir, file));
      }
      return !(isFolder(file) || isSystemFile(file) ||
        (dir === BASE_DIR && THIS_FILE === file));
    })
    .forEach(file => {
      const filePath = path.join(dir, file);
      const model = Dynamite.import(filePath);
      models[model.name] = model;
    });
};

importModels(BASE_DIR);

models.Dynamite = Dynamite;
module.exports = models;
