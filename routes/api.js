/*
*
*
*       Complete the API routing below
*
*
*/

'use strict';

var expect = require('chai').expect;
var MongoClient = require('mongodb');
var ObjectID = require('mongodb').ObjectID;
var DATABASE = process.env.DATABASE;
var bcrypt = require('bcrypt');

module.exports = function (app) {
  
  app.route('/api/threads/:board')
  
    .get(function(req, res) {
      var board = req.params.board;
    
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).find({reported: false}).limit(10).sort({bumped_at: -1}).toArray(function(err, result) {
          if (err) console.log(err);
          if (result) {
            return res.send(result);
          }
        });
      })
    
    })
  
    .post(function(req, res) {
      var board = req.body.board || req.params.board;
      var text = req.body.text;
      var password = req.body.delete_password;
      if (!text || !password) return res.send('Cannot create new thread, fields cannot be empty.');
    
      var data = {
        text: text,
        created_on: Date.now(),
        bumped_on: Date.now(),
        reported: false,
        delete_password: password,
        replies: []
      }
      
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).insertOne(data, function(err, doc) {
          if (err) console.log(err);
          db.close();
        })
      });
    
      return res.redirect(`/b/${board}`);
    })
    
    .put(function(req, res) {
      var board = req.body.board || req.params.board;
      var thread_id = req.body.thread_id;
      if (!thread_id || !board) return res.send('Cannot report thread, fields cannot be empty.');
      if (thread_id.length != 24) return res.send('_id error');
    
      var _id;
      try { _id = ObjectID(thread_id) }
      catch (err) { return res.send('_id error') }
    
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).updateOne({_id: _id}, {$set: {reported: true}}, function(err, result) {
          if (err) console.log(err);
          if (result.modifiedCount == 0) return res.send('thread not found');
          if (result) return res.send('success');
          db.close();
        })
      });
    })
  
    .delete(function(req, res) {
      var board = req.body.board || req.params.board;
      var thread_id = req.body.thread_id;
      var password = req.body.delete_password;
      if (!board || !thread_id || !password) return res.send('Cannot delete board, fields cannot be empty.');
      if (thread_id.length != 24) return res.send('_id error');
    
      var _id;
      try { _id = ObjectID(thread_id) }
      catch (err) { return res.send('_id error') }
    
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).findOneAndDelete({_id: _id, delete_password: password}, function(err, result) {
          if (err) console.log(err);
          console.log(result);
          if (result.value == null) return res.send('thread not found or password incorrect');
          else if (result) return res.send('success');
          db.close();
        })
      });
    });  
  
  app.route('/api/replies/:board')
    .get(function(req, res) {
      // console.log(req);
      var board = req.params.board;
      var thread_id = req.query.thread_id;
    
      var _id;
      try { _id = ObjectID(thread_id) }
      catch (err) { return res.send('_id error') }
    
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).findOne({_id: _id}, function(err, doc) {
          if (err) console.log(err);
          if (doc == null) res.send('thread _id error');
          else send(doc);
          
        });
      })
    
      function send(replies) {
        return res.send(replies)
      }
    })
  
    .post(function(req, res) {
      var board = req.body.board || req.params.board;
      var thread_id = req.body.thread_id;
      var reply_text = req.body.text;
      var password = req.body.delete_password;
      if (!board || !thread_id || !reply_text || !password) return res.send('Cannot create new reply, fields cannot be empty.');
      if (thread_id.length != 24) return res.send('_id error');
    
      var _id;
      try { _id = ObjectID(thread_id) }
      catch (err) { return res.send('_id error') }
    
      var obj = {
        _id: Date.now(),
        text: reply_text,
        created_on: Date.now(),
        delete_password: password,
        reported: false
      }
      
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).updateOne({_id: _id}, {$set: {bumped_on: obj.created_on}, $push: {replies: obj}}, function(err, result) {
          if (err) console.log(err);
          if (result.modifiedCount == 0) return res.send('could not post reply, board not found');
          else return res.redirect(`/b/${board}/${thread_id}`);
          db.close();
        })
      });
    })
  
    .put(function(req, res) {
      var board = req.body.board || req.params.board;
      var thread_id = req.body.thread_id;
      var reply_id = req.body.reply_id;
      if (!board || !thread_id || !reply_id) return res.send('Cannot report reply, fields cannot be empty.');
      if (thread_id.length != 24) return res.send('_id error');
    
      var _id;
      try { _id = ObjectID(thread_id) }
      catch (err) { return res.send('_id error') }
      
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).findOne({_id: _id}, function(err, doc) {
          if (err) console.log(err);
          if (doc == null) res.send('_id error');
          else update(doc.replies);
        });
        db.close();
      })
    
      function update(replies) {
        var found = false;
        for (var item of replies) {
          if (item._id && item._id == reply_id) {
            item.reported = true;
            found =true;
            
            MongoClient.connect(DATABASE, function(err, db) {
              db.collection(board).updateOne({_id: _id}, {$set: {replies: replies}}, function(err, result) {
                if (err) console.log(err);
                if (result.modifiedCount == 0) return res.send('reply not found');
                else return res.send('success');
                db.close();
              })
            });
            break;
          }
        }
        if (found == false) {
          return res.send('reply id not found');
        }
      }
    })
  
    .delete(function(req, res) {
      var board = req.body.board || req.params.board;
      var thread_id = req.body.thread_id;
      var reply_id = req.body.reply_id;
      var password = req.body.delete_password;
      if (!board || !thread_id || !reply_id || !password) return res.send('Cannot delete reply, fields cannot be empty.');
      if (thread_id.length != 24) return res.send('_id error');
    
      var _id;
      try { _id = ObjectID(thread_id) }
      catch (err) { return res.send('_id error') }
    
      MongoClient.connect(DATABASE, function(err, db) {
        db.collection(board).findOne({_id: _id}, function(err, doc) {
          if (err) console.log(err);
          if (doc == null) return res.send('_id error');
          else Delete(doc.replies);
          db.close();
        });
        
      })
    
      function Delete(replies) {
      
        var found = false;
        var index = 0;
        for (var item of replies) {
          index++;
          if (item._id && item._id == reply_id) {
            if (item.delete_password == password) {
              found = true;
              break;
            }
          }
        }
        
        if (found) {
          replies[index - 1].text = '[deleted]';
          MongoClient.connect(DATABASE, function(err, db) {
            db.collection(board).updateOne({_id: _id}, {$set: {replies: replies}}, function(err, result) {
              if (err) console.log(err);
              if (result.modifiedCount == 0) return res.send('reply not found');
              else return res.send('success');
              db.close();
            })
          });
        }
        else {
          return res.send('thread not found or password incorrect');
        }
        
      }
    });

};
