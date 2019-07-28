call aws --endpoint-url=http://localhost:4572 s3 mb s3://dev-weco-branch-images
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket dev-weco-branch-images --acl public-read-write
call aws --endpoint-url=http://localhost:4572 s3 mb s3://dev-weco-branch-images-resized
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket dev-weco-branch-images-resized --acl public-read-write
call aws --endpoint-url=http://localhost:4572 s3 mb s3://dev-weco-post-images
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket dev-weco-post-images --acl public-read-write
call aws --endpoint-url=http://localhost:4572 s3 mb s3://dev-weco-post-images-resized
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket dev-weco-post-images-resized --acl public-read-write
call aws --endpoint-url=http://localhost:4572 s3 mb s3://dev-weco-user-images
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket dev-weco-user-images --acl public-read-write
call aws --endpoint-url=http://localhost:4572 s3 mb s3://dev-weco-user-images-resized
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket dev-weco-user-images-resized --acl public-read-write
call aws --endpoint-url=http://localhost:4572 s3 mb s3://lambdas
call aws --endpoint-url=http://localhost:4572 s3api put-bucket-acl --bucket lambdas --acl public-read-write

call aws s3api list-buckets --endpoint-url=http://localhost:4572 --query "Buckets[].Name"