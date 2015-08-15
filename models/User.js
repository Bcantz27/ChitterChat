"use strict";

var models = require('./index.js');
var bcrypt = require('bcrypt-nodejs');

module.exports = function (sequelize, DataTypes) {
    var User = sequelize.define("User",  {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true // Automatically gets converted to SERIAL for postgres
        },
        redditId: {
            type: DataTypes.STRING,
            defaultValue: 0
        },
        facebookId: {
            type: DataTypes.STRING,
            defaultValue: 0
        },
        twitterId: {
            type: DataTypes.STRING,
            defaultValue: 0
        },
        BadgeId: {
            type: DataTypes.INTEGER,
            defaultValue: 1
        },
        username: DataTypes.STRING,
        email: DataTypes.STRING,
        password: DataTypes.STRING,
        karma: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        followList: {
            type: DataTypes.TEXT //JSON, but mysql will not accept JSON so we will stringify it
        },
        likesList: {
            type: DataTypes.TEXT //JSON, but mysql will not accept JSON so we will stringify it
        },
        dislikesList: {
            type: DataTypes.TEXT //JSON, but mysql will not accept JSON so we will stringify it
        }
    }, {
        classMethods: {
            associate: function (models) {
                User.hasMany(models.Comment);
            }
        },

        hooks: {
            beforeCreate : function (user, options, next) {
                user.followList = "[]";
                user.likesList = "[]";
                user.dislikesList = "[]";

                bcrypt.genSalt(10, function (err, salt) {
                    bcrypt.hash(user.password, salt, null, function (err, hash) {
                        user.password = hash;
                        next(null, user);
                    });
                });
            }
        },
        
        instanceMethods: {
            checkPassword: function (password,user,done,req) {
                bcrypt.compare(password, this.password, function(err, res) {
                    if (res == true) {
                        return done(null, user);
                    } else {
                        return done(null, false, { message: req.flash('loginMessage', 'Incorrect password.') });
                    }
                });
            },
            getDislikeArray: function () {
                var jsonDislikeList = [];
                var dislikeArray = [];
                
                if (this.dislikesList != null) {
                    jsonDislikeList = JSON.parse(this.dislikesList)
                    dislikeArray = Object.keys(jsonDislikeList).map(function (k) { return jsonDislikeList[k] });  //JSON to array
                }
                
                return dislikeArray;
            },
            getLikeArray: function () {
                var jsonLikeList = [];
                var likeArray = [];
                
                if (this.likesList != null) {
                    jsonLikeList = JSON.parse(this.likesList)
                    likeArray = Object.keys(jsonLikeList).map(function (k) { return jsonLikeList[k] });  //JSON to array
                }
                
                return likeArray;
            },
            getFollowArray: function (){
                var jsonFollowList = [];
                var followArray = [];
                
                if (this.followList != null) {
                    jsonFollowList = JSON.parse(this.followList)
                    followArray = Object.keys(jsonFollowList).map(function (k) { return jsonFollowList[k] });  //JSON to array
                }

                return followArray;
            },
            like: function(commentId){
                var jsonLikes = JSON.parse(this.likesList);
                var jsonDislikes = JSON.parse(this.dislikesList);
                var likesArray = [];
                var dislikesArray = [];
                
                if (jsonDislikes != null) {
                    //console.log("dislike list is not empty, checking if already disliked");
                    
                    dislikesArray = Object.keys(jsonDislikes).map(function (k) { return jsonDislikes[k] });  //JSON to array
                    
                    //check if comment is already disliked
                    if (dislikesArray.indexOf(commentId) > -1) {
                        //console.log("comment is already disliked, remove it");
                        //remove it
                        dislikesArray.splice(dislikesArray.indexOf(commentId), 1);
                        this.dislikesList = JSON.stringify(dislikesArray);
                        
                        sequelize.model('Comment').findById(commentId).then(function (comment) {
                            comment.undislike();
                        });
                    }
                }
                
                if (jsonLikes == null) {
                    //console.log("like list empty, adding first like");
                    
                    likesArray.push(commentId);
                    this.likesList = JSON.stringify(likesArray);  //Save to json string
                    
                    sequelize.model('Comment').findById(commentId).then(function (comment) {
                        comment.like();
                    });
                } else {
                    likesArray = Object.keys(jsonLikes).map(function (k) { return jsonLikes[k] }); //JSON to array
                    
                    //console.log("CommentId: " + commentId + " index " + likesArray.indexOf(commentId))
                    
                    if (likesArray.indexOf(commentId) == -1) {   //Not liked yet
                        likesArray.push(commentId);  //Add new comment to likes
                        this.likesList = JSON.stringify(likesArray);
                        
                        sequelize.model('Comment').findById(commentId).then(function (comment) {
                            comment.like();
                        });
                    } else {    //Already dislike so unlike it
                        likesArray.splice(likesArray.indexOf(commentId), 1);
                        this.likesList = JSON.stringify(likesArray);
                        
                        sequelize.model('Comment').findById(commentId).then(function (comment) {
                            comment.unlike();
                        });
                    }
                }
                
                this.save();     
            },
            dislike: function (commentId) {
                var jsonLikes = JSON.parse(this.likesList);
                var jsonDislikes = JSON.parse(this.dislikesList);
                var likesArray = [];
                var dislikesArray = [];

                if (jsonLikes != null) {
                    //console.log("like list is not empty, checking if already liked");

                    likesArray = Object.keys(jsonLikes).map(function (k) { return jsonLikes[k] });  //JSON to array

                    //check if comment is already liked
                    if (likesArray.indexOf(commentId) > -1) {
                        //console.log("comment is already liked, remove it");
                        //remove it
                        likesArray.splice(likesArray.indexOf(commentId), 1);
                        this.likesList = JSON.stringify(likesArray);

                        sequelize.model('Comment').findById(commentId).then(function (comment) {
                            comment.unlike();
                        });
                    }
                }
                
                if (jsonDislikes == null) {
                    //console.log("dislike list empty, adding first dislike");

                    dislikesArray.push(commentId);
                    this.dislikesList = JSON.stringify(dislikesArray);  //Save to json string
                    
                    sequelize.model('Comment').findById(commentId).then(function (comment) {
                        comment.dislike();
                    });
                } else {
                    dislikesArray = Object.keys(jsonDislikes).map(function (k) { return jsonDislikes[k] }); //JSON to array
                    
                    //console.log("CommentId: " + commentId + " index " + dislikesArray.indexOf(commentId) )

                    if (dislikesArray.indexOf(commentId) == -1) {   //Not disliked yet
                        //console.log("Not dislike list, disliking");
                        dislikesArray.push(commentId);  //Add new comment to dislikes
                        this.dislikesList = JSON.stringify(dislikesArray);

                        sequelize.model('Comment').findById(commentId).then(function (comment) {
                            comment.dislike();
                        });
                    } else {    //Already dislike so undislike it
                        //console.log("Already in dislike list, undisliking");
                        dislikesArray.splice(dislikesArray.indexOf(commentId), 1);
                        this.dislikesList = JSON.stringify(dislikesArray);

                        sequelize.model('Comment').findById(commentId).then(function (comment) {
                            comment.undislike();
                        });
                    }
                }
                
                this.save();         
            },
            followChat: function (chatId) {
                chatId = parseInt(chatId);

                sequelize.model('Chatroom').findById(chatId).then(function (chatroom) {
                    chatroom.increment("followers");
                    chatroom.reload();
                });
                
                var jsonFollowList = [];
                var followArray = [];
                
                if (this.followList != null) {
                    jsonFollowList = JSON.parse(this.followList)
                    followArray = Object.keys(jsonFollowList).map(function (k) { return jsonFollowList[k] });  //JSON to array
                    
                    if (followArray.indexOf(chatId) == -1) {
                        followArray.push(chatId);
                        this.followList = JSON.stringify(followArray);
                    }

                } else {
                    followArray.push(chatId);
                    this.followList = JSON.stringify(followArray);
                }

                this.save();
            },
            unfollowChat: function (chatId) {
                chatId = parseInt(chatId);

                sequelize.model('Chatroom').findById(chatId).then(function (chatroom) {
                    chatroom.decrement("followers");
                    chatroom.reload();
                });

                var jsonFollowList = [];
                var followArray = [];
                
                if (this.followList != null) {
                    jsonFollowList = JSON.parse(this.followList)
                    followArray = Object.keys(jsonFollowList).map(function (k) { return jsonFollowList[k] });  //JSON to array
                    
                    if (followArray.indexOf(chatId) > -1) {
                        followArray.splice(followArray.indexOf(chatId), 1);
                        this.followList = JSON.stringify(followArray);
                    }

                }

                this.save();
            }
        }
    });
    
    User.sync();

    return User;
};