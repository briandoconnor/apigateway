#   Authors: Brian O'Connor
#   Date: March 2018
#
#   Description: a quick script to load the lambda

import os
import os.path
import argparse
import json
import jsonschema
import datetime
import re
import dateutil
import ast
#from urllib import urlopen
from subprocess import Popen, PIPE

def input_Options():
    """
    Creates the parse options
    """
    parser = argparse.ArgumentParser(description='Directory that contains Json files.')
    parser.add_argument('-d', '--test-directory', help='Directory that contains the json metadata files')

    args = parser.parse_args()
    return args

def main():
    args = input_Options()

    # environment
    my_env = os.environ.copy()

    # delete
    command="aws cloudformation delete-stack --stack-name apigateway"
    run_command(command)
    run_command("sleep 5")

    # start by bundling
    bundle_Command=["./bundle.sh"]
    c_data=Popen(bundle_Command, shell=True, stdout=PIPE, stderr=PIPE, env=my_env)
    stdout, stderr = c_data.communicate()

    # upload
    command="aws s3 cp lambda.zip s3://$S3Bucket/lambda.zip"
    print("COMMAND: "+str(command))
    c_data=Popen(command, shell=True, stdout=PIPE, stderr=PIPE, env=my_env)
    stdout, stderr = c_data.communicate()
    print("STDOUT: "+str(stdout))
    print("STDERR: "+str(stderr))

    # create stack
    command="aws cloudformation create-stack --stack-name apigateway --template-body file://template.json --capabilities CAPABILITY_IAM --parameters ParameterKey=S3Bucket,ParameterValue=$S3Bucket"
    print("COMMAND: "+str(command))
    c_data=Popen(command, shell=True, stdout=PIPE, stderr=PIPE, env=my_env)
    stdout, stderr = c_data.communicate()
    print("STDOUT: "+str(stdout))
    print("STDERR: "+str(stderr))

    # wait for stack
    command="aws cloudformation wait stack-create-complete --stack-name apigateway"
    run_command(command)

    # pull back arn
    command="aws cloudformation describe-stacks --stack-name apigateway --query Stacks[0].Outputs"
    stdout, stderr = run_command(command)
    metadata_struct = json.loads(stdout)
    print ("INFO: "+str(metadata_struct))
    print ("INFO: "+str(metadata_struct[0]))
    print ("INFO: "+str(metadata_struct[0]['OutputValue']))
    arn_str = str(metadata_struct[0]['OutputValue'])

    # use the ARN in the template
    command="sed 's/$LambdaArn/"+arn_str+"/g' swagger.json.template > swagger.json"

def run_command(command):
    my_env = os.environ.copy()
    print("COMMAND: "+str(command))
    c_data=Popen(command, shell=True, stdout=PIPE, stderr=PIPE, env=my_env)
    stdout, stderr = c_data.communicate()
    print("STDOUT: "+str(stdout))
    print("STDERR: "+str(stderr))
    return(stdout, stderr)

if __name__ == "__main__":
    main()
