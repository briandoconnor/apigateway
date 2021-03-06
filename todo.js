var moment = require('moment');
var uuid = require('node-uuid');
var AWS = require('aws-sdk');
var db = new AWS.DynamoDB();
const https = require("https");

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
    "version": item.version.S,
    "fragments": JSON.parse(item.fragments.S),
    "keyvalues": JSON.parse(item.keyvalues.S),
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
  // add entitites from the URL
  // read the collection from the URL
  // TODO: support paging
  var url = event.body.entitiesurl;
  https.get(url, res => {
  res.setEncoding("utf8");
  let body = "";
  res.on("data", data => {
    body += data;
  });
  res.on("end", () => {
    body = JSON.parse(body);
    //console.log(`: ${body.entities[0].uid} -`);
    // now loop over the entities and create them
    var tid = Date.now();
    for (var i=0; i<body.entities.length; i++) {
      tid++;
      console.log(`Adding Entity: ${body.entities[i].uid}`);
      var params = {
        "Item": {
          "uid": {
            "S": uid
          },
          "eid": {
              "N": tid.toString()
          },
          "entitytype": {
            "S": body.entities[i].entitytype
          },
          "identity": {
            "S": body.entities[i].identity
          },
          "version": {
            "S": body.entities[i].version
          },
          "keyvalues": {
            "S": JSON.stringify(body.entities[i].keyvalues)
          },
          "fragments": {
            "S": JSON.stringify(body.entities[i].fragments)
          }
        },
        "TableName": "collection-entity",
        "ConditionExpression": "attribute_not_exists(eid)"
      };
      db.putItem(params, function(err) {
        console.log(`Adding Entity: ${params.Item.uid}`);
        if (err) {
          cb(err);
        } else {
          cb(null, {"headers": {"uid": uid}, "body": mapEntityItem(params.Item)});
        }
      });
    }
    });
  });
};

exports.getCollection = function(event, cb) {
  console.log("getCollection", JSON.stringify(event));
  var params = {
    "Key": {
      "uid": {
        "S": event.parameters.collectionId
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
        // TODO: need to retrieve the entitites
      } else {
        cb(new Error('not found'));
      }
    }
    // probably need to merge with /collection/{collectionId}/entities
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

// this probably should be merged with /collection/{collectionId} and then go away
exports.getEntities = function(event, cb) {
  console.log("getEntities", JSON.stringify(event));
  var params = {
    "KeyConditionExpression": "uid = :uid",
    "ExpressionAttributeValues": {
      ":uid": {
        "S": event.parameters.collectionId
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
    "IndexName": "identity-index",
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
        "body": {
          "uid": uuid.v4(),
          "friendlyname": "shopping cart",
          "created": Date.now().toString(),
          "entities": data.Items.map(mapEntityItem)
        }
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
      "entitytype": {
        "S": event.body.entitytype
      },
      "identity": {
        "S": event.body.identity
      },
      "version": {
        "S": event.body.version
      },
      "keyvalues": {
        "S": JSON.stringify(event.body.keyvalues)
      },
      "fragments": {
        "S": JSON.stringify(event.body.fragments)
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

exports.deleteCartEntity = function(event, cb) {
  console.log("deleteCartEntity", JSON.stringify(event));
  var params = {
    "Key": {
      "uid": {
        "S": event.parameters.entityId
      },
      "eid": {
        "N": event.body.entityTimeId
      }
    },
    "TableName": "collection-cart-entities"
  };
  db.deleteItem(params, function(err) {
    if (err) {
      cb(err);
    } else {
      cb();
    }
  });
};
