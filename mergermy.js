var fs = require('fs');


var postscontent = fs.readFileSync('posts.json');
var postsjsonContent = JSON.parse(postscontent);

var datacontent = fs.readFileSync('postdata.json');
var datajsonContent = JSON.parse(datacontent);


var merged = [];
console.log(postsjsonContent.length);
postsjsonContent.forEach(post => {
	datajsonContent.forEach(data => {
		//check if id's are the same
				//if they are add the new obj to the array
		if(post.fields.id == data.fields.id){
			let b = post;
			b.fields.title = data.fields.title;
			merged.push(b);
		}
	});
	
});
var js = JSON.stringify(merged);

fs.writeFileSync('merged.json',js);
//array to file 