var moment = require('moment');
var uuid = require('node-uuid');
var AWS = require('aws-sdk');
var db = new AWS.DynamoDB();

function getValue(attribute, type) {
  if (attribute === undefined) {
    return null;
  }
  return attribute[type];
}

function mapBundleItem(item) {
  return {
    "bid": item.bid.N,
    "version": item.version.N
  };
}

function mapReleaseItem(item) {
  return {
    "uid": item.uid.S,
    "friendlyname": item.friendlyname.S,
    "created": item.created.N
  };
}

exports.getReleases = function(event, cb) {
  console.log("getReleases", JSON.stringify(event));
  var params = {
    "TableName": "todo-release",
    "Limit": event.parameters.limit || 10
  };
  if (event.parameters.next) {
    params.ExclusiveStartKey = {
      "uid": {
        "S": event.parameters.next
      }
    };
  }
  db.scan(params, function(err, data) {
    if (err) {
      cb(err);
    } else {
      var res = {
        "body": data.Items.map(mapReleaseItem)
      };
      if (data.LastEvaluatedKey !== undefined) {
        res.headers = {"next": data.LastEvaluatedKey.uid.S};
      }
      cb(null, res);
    }
  });
};

exports.postRelease = function(event, cb) {
  console.log("postRelease", JSON.stringify(event));
  var uid = uuid.v4();
  var params = {
    "Item": {
      "uid": {
        "S": uid
      },
      "friendlyname": {
        "S": event.body.friendlyname
      },
      "created": {
        "N": moment().format("YYYYMMDD")
      }
    },
    "TableName": "todo-release",
    "ConditionExpression": "attribute_not_exists(uid)"
  };
  db.putItem(params, function(err) {
    if (err) {
      cb(err);
    } else {
      cb(null, {"headers": {"uid": uid}, "body": mapReleaseItem(params.Item)});
    }
  });
  // TODO: need to make some bundles here
};

exports.getRelease = function(event, cb) {
  console.log("getRelease", JSON.stringify(event));
  var params = {
    "Key": {
      "uid": {
        "S": event.parameters.releaseId
      }
    },
    "TableName": "todo-release"
  };
  db.getItem(params, function(err, data) {
    if (err) {
      cb(err);
    } else {
      if (data.Item) {
        cb(null, {"body": mapReleaseItem(data.Item)});
      } else {
        cb(new Error('not found'));
      }
    }
  });
};

exports.deleteRelease = function(event, cb) {
  console.log("deleteRelease", JSON.stringify(event));
  var params = {
    "Key": {
      "uid": {
        "S": event.parameters.releaseId
      }
    },
    "TableName": "todo-release"
  };
  db.deleteItem(params, function(err) {
    if (err) {
      cb(err);
    } else {
      cb();
    }
  });
};

exports.getBundles = function(event, cb) {
  console.log("getBundles", JSON.stringify(event));
  var params = {
    "KeyConditionExpression": "uid = :uid",
    "ExpressionAttributeValues": {
      ":uid": {
        "S": event.parameters.releaseId
      }
    },
    "TableName": "todo-bundle",
    "Limit": event.parameters.limit || 10
  };
  if (event.parameters.next) {
    params.KeyConditionExpression += ' AND bid > :next';
    params.ExpressionAttributeValues[':next'] = {
      "N": event.parameters.next
    };
  }

  db.query(params, function(err, data) {
    if (err) {
      cb(err);
    } else {
      var res = {
        "body": data.Items.map(mapBundleItem)
      };
      if (data.LastEvaluatedKey !== undefined) {
        res.headers = {"next": data.LastEvaluatedKey.bid.N};
      }
      cb(null, res);
    }
  });
};
