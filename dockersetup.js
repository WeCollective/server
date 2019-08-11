const shell = require('shelljs');
const fs = require('fs');

shell.cd('lambda_stuff');
var file = 'container.txt';
var command = 'docker container ls > ' + file;
var LocalStackContainerName = process.argv[2];
shell.exec(command);
fs.readFile(file, 'utf8', function(err, data) {
  if(!data.includes(LocalStackContainerName))
  {
    shell.cd('lambda_stuff');
    shell.exec('docker-compose up -d');
    let ip = shell.exec('docker-machine ip', { silent: true }).stdout.trim();
    let cmdLam = 'node lambdas.js ' + ip;
    shell.exec(cmdLam)
  }
  else console.log('localstack is already setup');
});
shell.cd('..');
