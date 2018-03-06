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

function mapEntityItem(item) {
  return {
    "uid": item.uid.S,
    "eid": item.eid.N,
    "identity": item.identity.S,
    "entitytype": item.entitytype.S
  };
}

function mapCollectionItem(item) {
  return {
    "uid": item.uid.S,
    "friendlyname": item.friendlyname.S,
    "created": item.created.N
  };
}

exports.getCollections = function(event, cb) {
  console.log("getCollections", JSON.stringify(event));
  var params = {
    "TableName": "collection-collection",
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
        "body": data.Items.map(mapCollectionItem)
      };
      if (data.LastEvaluatedKey !== undefined) {
        res.headers = {"next": data.LastEvaluatedKey.uid.S};
      }
      cb(null, res);
    }
  });
};

exports.postCollection = function(event, cb) {
  console.log("postCollection", JSON.stringify(event));
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
    "TableName": "collection-collection",
    "ConditionExpression": "attribute_not_exists(uid)"
  };
  db.putItem(params, function(err) {
    if (err) {
      cb(err);
    } else {
      cb(null, {"headers": {"uid": uid}, "body": mapCollectionItem(params.Item)});
    }
  });
  // TODO: need to make some bundles here
};

exports.getCollection = function(event, cb) {
  console.log("getCollection", JSON.stringify(event));
  var params = {
    "Key": {
      "uid": {
        "S": event.parameters.releaseId
      }
    },
    "TableName": "collection-collection"
  };
  db.getItem(params, function(err, data) {
    if (err) {
      cb(err);
    } else {
      if (data.Item) {
        cb(null, {"body": mapCollectionItem(data.Item)});
      } else {
        cb(new Error('not found'));
      }
    }
  });
};

exports.deleteCollection = function(event, cb) {
  console.log("deleteCollection", JSON.stringify(event));
  var params = {
    "Key": {
      "uid": {
        "S": event.parameters.releaseId
      }
    },
    "TableName": "collection-collection"
  };
  db.deleteItem(params, function(err) {
    if (err) {
      cb(err);
    } else {
      cb();
    }
  });
};

exports.getEntities = function(event, cb) {
  console.log("getEntities", JSON.stringify(event));
  var params = {
    "KeyConditionExpression": "uid = :uid",
    "ExpressionAttributeValues": {
      ":uid": {
        "S": event.parameters.releaseId
      }
    },
    "TableName": "collection-entity",
    "Limit": event.parameters.limit || 10
  };
  if (event.parameters.next) {
    params.KeyConditionExpression += ' AND eid > :next';
    params.ExpressionAttributeValues[':next'] = {
      "N": event.parameters.next
    };
  }

  db.query(params, function(err, data) {
    if (err) {
      cb(err);
    } else {
      var res = {
        "body": data.Items.map(mapEntityItem)
      };
      if (data.LastEvaluatedKey !== undefined) {
        res.headers = {"next": data.LastEvaluatedKey.eid.N};
      }
      cb(null, res);
    }
  });
};

exports.getCartEntities = function(event, cb) {
  console.log("getCartEntities", JSON.stringify(event));
  var params = {
    "KeyConditionExpression": "entitytype = :entitytype",
    "ExpressionAttributeValues": {
      ":entitytype": {
        "S": event.parameters.entitytype
      }
    },
    "TableName": "collection-cart-entities",
    "Limit": event.parameters.limit || 10
  };
  if (event.parameters.next) {
    params.KeyConditionExpression += ' AND eid > :next';
    params.ExpressionAttributeValues[':next'] = {
      "N": event.parameters.next
    };
  }

  db.query(params, function(err, data) {
    if (err) {
      cb(err);
    } else {
      var res = {
        "body": data.Items.map(mapEntityItem)
      };
      if (data.LastEvaluatedKey !== undefined) {
        res.headers = {"next": data.LastEvaluatedKey.eid.N};
      }
      cb(null, res);
    }
  });
};

exports.postCartEntities = function(event, cb) {
  console.log("postCartEntities", JSON.stringify(event));
  var tid = Date.now();
  var uid = uuid.v4();
  //for (let item of event.body.) {
  //console.log(item);
  //}
  var params = {
    "Item": {
      "uid": {
        "S": uid
      },
      "eid": {
          "N": tid.toString()
      },
      "identity": {
        "S": event.body.identity
      },
      "entitytype": {
        "S": event.body.entitytype
      }
    },
    "TableName": "collection-cart-entities",
    "ConditionExpression": "attribute_not_exists(eid)"
  };
  db.putItem(params, function(err) {
    if (err) {
      cb(err);
    } else {
      cb(null, {"headers": {"uid": uid}, "body": mapEntityItem(params.Item)});
    }
  });
};
