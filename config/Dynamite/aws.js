const AWS = require('aws-sdk');
const sh = require('shelljs');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID_WECO_API,
    logger: process.env.NODE_ENV ? undefined : process.stdout === 'test',
    region: 'eu-west-1',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_WECO_API,
    sslEnabled: true,
});




var local = process.env.NODE_ENV === "local";
var stdout = null;






//testing cloudsearch


/*

testdb.scan(params, onScan);

function onScan(err, data) {
    if (err) {
        console.error("Unable to scan the table. Error JSON:", JSON.stringify(err, null, 2));
    } else {
        // print all the movies
        console.log("Scan succeeded.");
        data.Items.forEach(function(branch) {
           console.log(
                branch.name + ": ");
				});

        // continue scanning if we have more movies, because
        // scan can retrieve a maximum of 1MB of data
        //if (typeof data.LastEvaluatedKey != "undefined") {
          //  console.log("Scanning for more...");
            //params.ExclusiveStartKey = data.LastEvaluatedKey;
            //docClient.scan(params, onScan);
       // }
		
    }
}
*/
//end test



//get ip
if (local) {
    stdout = sh.exec('docker-machine ip', { silent: true }).stdout.trim();
}
module.exports = {
    dbClient: local ? new AWS.DynamoDB.DocumentClient({ service: new AWS.DynamoDB({ endpoint: 'http://' + stdout + ':4569' }) }) : new AWS.DynamoDB.DocumentClient(),
    s3Client: local ? new AWS.S3({ endpoint: 'http://' + stdout + ':4572', s3ForcePathStyle: true }) : new AWS.S3(),
	BranchCloudSearch: new AWS.CloudSearchDomain({endpoint: 'search-search-branches-xiqudynvibqz2wdcfk5rj7uiwy.eu-west-1.cloudsearch.amazonaws.com'}), //do for local later
	PostCloudSearch: new AWS.CloudSearchDomain({endpoint: 'search-srch-posts-c67xchgchllbnp7ayo33th5siq.eu-west-1.cloudsearch.amazonaws.com'}), //do for local later
    s3Path: local ? stdout + ':4572/' : '.s3-eu-west-1.amazonaws.com/',
    s3Cert: local ? 'http://' : 'https://',
    s3Local: local,
    getRootPath: (bucket) => {
        var pth = local ? stdout + ':4572/' : '.s3-eu-west-1.amazonaws.com/';
        var cert = local ? 'http://' : 'https://';
        if (local) {
            //localpath
            return `${cert}${pth}${bucket}/`;
        } else {
            return `${cert}${bucket}${pth}`;
            //server path s3
        }
    },
};