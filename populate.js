const csv = require('csv-parser');
const fs = require('fs');
const reqlib = require('app-root-path').require;
const auth = reqlib('config/auth');

const token = auth.generateToken()
var users = []


fs.createReadStream('commentdata.csv')
    .pipe(csv())
    .on('data', (row) => {
		if(row.user && row.user!="" && row.user.replace(/[^a-zA-Z]/g, "")!=""){
			var username = row.user.replace(/[^a-zA-Z]/g, "");
			auth.generateSalt().then(salt => {
				auth.hash(username + "123", salt).then(hash => {

					var date = new Date();
					var timestamp = date.getTime();
					if (!users.includes(username)) {
						var newUser = {
							"username": {
								"S": username
							},
							"resetPasswordToken": {
								"NULL": true
							},
							"verified": {
								"BOOL": true
							},
							"name": {
								"S": "Mike"
							},
							"num_branches": {
								"N": "0"
							},
							"dob": {
								"NULL": true
							},
							"num_comments": {
								"N": "0" //get a number
							},
							"datejoined": {
								"N": timestamp
							},
							"num_mod_positions": {
								"N": "0"
							},
							"token": {
								"S": "" + token
							},
							"num_posts": {
								"N": "0"
							},
							"show_nsfw": {
								"BOOL": true
							},
							"password": {
								"S": "" + hash
							},
							"email": {
								"S": username + "@asd.com"
							}
						};

						//add the user
						let content = fs.readFileSync("lambda_stuff/dump/devUsers/data/0001.json");
						let jsonContent = JSON.parse(content);
						jsonContent.Items.push(newUser);
						jsonContent.Count = jsonContent.Items.length;
						jsonContent.Count = jsonContent.Items.length;
						fs.writeFileSync('lambda_stuff/dump/devUsers/data/0001.json', JSON.stringify(jsonContent));
						users.push(username);
					}
					//add the comment stuff
					var newComment = {
						"parentid": {
							"S": "none"
						},
						"up": {
							"N": row.likes + 1 
						},
						"rank": {
							"N": "0"
						},
						"down": {
							"N": "0"
						},
						"individual": {
							"N": "0"
						},
						"replies": {
							"N": "0"
						},
						"date": {
							"N": timestamp
						},
						"postid": {
							"S": "james-1568482174870"
						},
						"id": {
							"S": username + "-" + timestamp
						}
					};
					var newCommentData = {
						"date": {
							"N": timestamp
						},
						"edited": {
							"BOOL": false
						},
						"creator": {
							"S": username
						},
						"id": {
							"S": username + "-" + timestamp
						},
						"text": {
							"S": row.Text.replace(/[^a-zA-Z ]/g, "")
						}
					};

					let content = fs.readFileSync("lambda_stuff/dump/devComments/data/0001.json");
					let jsonContent = JSON.parse(content);
					jsonContent.Items.push(newComment);
					jsonContent.Count = jsonContent.Items.length;
					jsonContent.ScannedCount = jsonContent.Items.length;
					fs.writeFileSync('lambda_stuff/dump/devComments/data/0001.json', JSON.stringify(jsonContent));

					content = fs.readFileSync("lambda_stuff/dump/devCommentData/data/0001.json");
					jsonContent = JSON.parse(content);
					jsonContent.Items.push(newCommentData);
					jsonContent.Count = jsonContent.Items.length;
					jsonContent.ScannedCount = jsonContent.Items.length;
					fs.writeFileSync('lambda_stuff/dump/devCommentData/data/0001.json', JSON.stringify(jsonContent));
				});

			});

		}

    })
    .on('end', () => {
        console.log('CSV file successfully processed');
    });