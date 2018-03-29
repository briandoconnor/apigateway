# Collections Prototype

This is a prototype for the Collections API to help define functionality needed by the Orange Box in HCA. It includes
endpoints for managing the following:
* collections
* shortened URLs
* shopping cart
* handoff to red box portals (tertiary analysis portals)

It also has test endpoints for generating some synthetic collections using a pretty simple JSON format.

The example in this repository reuses the example from chapter 10 in [Amanzon Web Services in Action](https://www.manning.com/books/amazon-web-services-in-action). You can find the code for the original example in the book's [code repository](https://github.com/AWSinAction/code/tree/master/chapter10).

Use [Swagger UI](http://petstore.swagger.io/?url=https://raw.githubusercontent.com/briandoconnor/collections-prototype/master/swagger.json) to have a look at the API definition.

## Prep

See https://cloudonaut.io/create-a-serverless-restful-api-with-api-gateway-swagger-lambda-and-dynamodb/

```
$> conda create -n python_3_6_4_for_release_service python=3.6.4 anaconda
$> source activate python_3_6_4_for_release_service
$> pip install awscli --upgrade --user
export AWS_DEFAULT_REGION=us-west-2
export S3Bucket=$(whoami)-apigateway

```
And follow the rest of the directions...

## Setup

I've wrapped the whole process in a simple python script to automate deployment.  Just run with:

    $> python load.py

For more details on what this script is doing, see the details below.

### Using CloudFormation, Swagger / OpenAPI Specification and the AWS CLI

clone this repository

```
$ git clone git@github.com:AWSinAction/apigateway.git
$ cd apigateway/
```

create the lambda code file (`lambda.zip`)

```
$ npm install --production
$ ./bundle.sh
```

create an S3 bucket in the US East (N. Virginia, `us-east-1`) region and upload the `lambda.zip` file (replace `$S3Bucket` with a S3 bucket name)

```
export AWS_DEFAULT_REGION=us-east-1
export S3Bucket=$(whoami)-apigateway
$ aws s3 mb s3://$S3Bucket
$ aws s3 cp lambda.zip s3://$S3Bucket/lambda.zip
```

create cloudformation stack (replace `$S3Bucket` with your S3 bucket name)

```
$ aws cloudformation create-stack --stack-name apigateway --template-body file://template.json --capabilities CAPABILITY_IAM --parameters ParameterKey=S3Bucket,ParameterValue=$S3Bucket
```

wait until the stack is created (`CREATE_COMPLETE`)

```
$ aws cloudformation wait stack-create-complete --stack-name apigateway
```

replace **all nine occurrences** of `$AWSRegion` in `swagger.json` with the region that you are creating your API and Lamdba in

```
$ sed -i '.bak' 's/$AWSRegion/us-east-1/g' swagger.json
```

get the `LambdaArn`

```
$ aws cloudformation describe-stacks --stack-name apigateway --query Stacks[0].Outputs
```

replace **all nine occurrences** of `$LambdaArn` in `swagger.json` with the ARN from the stack output above (e.g. `arn:aws:lambda:us-east-1:YYY:function:apigateway-Lambda-XXX`)

```
$ sed -i '.bak' 's/$LambdaArn/arn:aws:lambda:us-east-1:YYY:function:apigateway-Lambda-XXX/g' swagger.json
```

deploy the API Gateway

> make sure you have an up-to-date version (`aws --version`) of the AWS CLI >= 1.10.18. Learn more here: http://docs.aws.amazon.com/cli/latest/userguide/installing.html

```
$ aws apigateway import-rest-api --fail-on-warnings --body file://swagger.json
```

update the CloudFormation template to set the `ApiId` parameter (replace `$ApiId` with the `id` output from above)

```
$ aws cloudformation update-stack --stack-name apigateway --template-body file://template.json --capabilities CAPABILITY_IAM --parameters ParameterKey=S3Bucket,UsePreviousValue=true ParameterKey=S3Key,UsePreviousValue=true ParameterKey=ApiId,ParameterValue=$ApiId
```

deploy to stage v1 (replace `$ApiId`)

```
$ aws apigateway create-deployment --rest-api-id $ApiId --stage-name v1
```

set the `$ApiGatewayEndpoint` environment variable (replace `$ApiId`)

```
export ApiGatewayEndpoint="$ApiId.execute-api.us-east-1.amazonaws.com/v1"
```

and now [use the RESTful API](#use-the-restful-api).

## Use the RESTful API

the following examples assume that you replace `$ApiGatewayEndpoint` with `$ApiId.execute-api.us-east-1.amazonaws.com`

create a user

```
curl -vvv -X POST -d '{"email": "your@mail.com", "phone": "0123456789"}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/user
```

list users

```
curl -vvv -X GET https://$ApiGatewayEndpoint/user
```

create a task

```
curl -vvv -X POST -d '{"description": "test task"}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/user/$UserId/task
```

list tasks

```
curl -vvv -X GET https://$ApiGatewayEndpoint/user/$UserId/task
```

mark task as complete

```
curl -vvv -X PUT https://$ApiGatewayEndpoint/user/$UserId/task/$TaskId
```

delete task

```
curl -vvv -X DELETE https://$ApiGatewayEndpoint/user/$UserId/task/$TaskId
```

create a task with a category

```
curl -vvv -X POST -d '{"description": "test task", "category": "test"}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/user/$UserId/task
```

list tasks by category

```
curl -vvv -X GET https://$ApiGatewayEndpoint/category/$Category/task
```

### Collection Testing Examples

```
# you need to fillin the ApiID based on the output from the load script!
$> export ApiId=hj50wnu39m
$> export ApiGatewayEndpoint="$ApiId.execute-api.us-west-2.amazonaws.com/v1"
# create a shopping cart entry
$> curl -vvv -X POST -d '{"entitytype": "project", "eid": 1, "identity": "Foo", "version": "123", "keyvalues": {"key1": "value1"}, "fragments": ["json-ld pointer"]}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/cart/entity
# delete a cart entry (for this implementation you need both keys, hence the awkward delete doc here)
$> curl -vvv -X DELETE -d '{"entityTimeId": "1522298960490"}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/cart/entity/746057ad-207c-4d5f-9f7c-210170e771ee
# get cart entries (you should add more than 10 if you want to get a value for the "link" header field for paging purposes)
$> curl -vvv -X GET "https://$ApiGatewayEndpoint/cart?limit=10&entitytype=project&next=1" -H "accept: application/json"
# create a collection from the cart
$> curl -vvv -X POST -d '{"friendlyname": "v1.1.2", "entitiesurl": "https://s9wh37dzch.execute-api.us-west-2.amazonaws.com/v1/cart?limit=10&entitytype=project&next=1"}' -H "Content-Type: application/json" https://$ApiGatewayEndpoint/collection
```


## Teardown

### Using CloudFormation, Swagger / OpenAPI Specification and the AWS CLI

delete API Gateway (replace `$ApiId`)

```
$ aws apigateway delete-rest-api --rest-api-id $ApiId
```

delete CloudFormation stack

```
$ aws cloudformation delete-stack --stack-name apigateway
```

delete S3 bucket (replace `$S3Bucket`)

```
$ aws s3 rb --force s3://$S3Bucket
```


## TODO
* need to review one more time then try a redeployment
* once releases can be created, need to add bundles+versions to a release post and update tables
* filtering on releases
* corresponding lookups in the core DSS API based on release
* supporting TSV manifest for release creation (not JSON)
* ability to have extra fields in the manifest
* redirect: "method.response.header.Location": "integration.response.body.redirect.url"
