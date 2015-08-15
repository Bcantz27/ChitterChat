//Module dependencies.
var express = require('express');
var http = require('http');
var path = require('path');
var passport = require('passport');
var models = require('./models');
var flash = require('connect-flash');
var session = require('express-session');
var async = require('async');
var fs = require('fs');

var ipaddress = process.env.OPENSHIFT_NODEJS_IP || "127.0.0.1";
var port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

var app = express();

require('./config/passport')(passport); // pass passport for configuration

// App Config
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.set('models', require('./models'));
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(session({ secret: 'superdupersecret' })); // session secret
app.use(express.bodyParser()); // get information from html forms
app.use(express.cookieParser()); // read cookies (needed for auth)
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// required for passport
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash());
app.use(app.router);

// routes ======================================================================
require('./routes/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

var sql = app.get('models');
var serve = http.createServer(app);
var io = require('socket.io')(serve);

var badgeList = [];
var anonChatList = [[]];

fs.readFile('./config/anonchat.dat', 'utf8', function (err, data) {
    if (err) {
        return console.log(err);
    }
    console.log("AnonChat loaded");
    anonChatList = JSON.parse(data);
});

serve.listen( port, ipaddress, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
    initServer();
});

function initServer(){
    function Badge(id, name, url) {
        this.id = id;
        this.name = name;
        this.imageUrl = url;
    };

    models.sequelize.query("UPDATE chatrooms SET usersConnected = 0").then(function () {});

    models.sequelize.query("SELECT * FROM badges").then(function (badges) {
        for (var i = 0; i < badges[0].length; i++) {
            badgeList.push(new Badge(badges[0][i].id, badges[0][i].name, badges[0][i].imageUrl));
        }
    });
}

io.on('connection', function (socket) {
    console.log('a user connected');

    socket.on('adduser', function (username, chatId) {
        socket.leave();
        socket.username = username;
        socket.room = chatId.toString();
        socket.join(socket.room);

        queryCommentsThenLoad(chatId, "SELECT * FROM `comments` WHERE (ReplyId IS NULL AND ChatroomId = " + socket.room + ") ORDER BY `id` LIMIT 15", socket);

        //Increment Users in Chatroom
        models.Chatroom.findById(chatId).then(function (chatroom) {
            chatroom.increment("usersConnected");
            chatroom.reload().then(function () {
                socket.emit("updateUsersConnected", chatroom.usersConnected);
                socket.broadcast.to(socket.room).emit("updateUsersConnected", chatroom.usersConnected);
            });
        });
    });

    //onDisconnect
    socket.on('disconnect', function () {
        var chatId = parseInt(socket.room);
        console.log('user disconnected ' + chatId);

        //Decrement Users in Chatroom
        models.Chatroom.findById(chatId).then(function (chatroom) {
            chatroom.decrement("usersConnected");
            chatroom.reload().then(function () {
                socket.emit("updateUsersConnected", chatroom.usersConnected);
                socket.broadcast.to(socket.room).emit("updateUsersConnected", chatroom.usersConnected);
                socket.leave();
            });
        });


    });
    
    //onLike
    socket.on('likeToServer', function (commentId) {
        console.log(socket.username + ' liked a comment with id ' + commentId);
        models.User.find({ where: { username: socket.username } }).then(function (user) {
            user.like(commentId);
        });
    });
    
    //onDislike
    socket.on('dislikeToServer', function (commentId) {
        console.log(socket.username + ' disliked a comment with id ' + commentId);
        models.User.find({ where: { username: socket.username } }).then(function (user) {
            user.dislike(commentId);
        });
    });
    
    //onFollow
    socket.on('followChat', function (chatId) {
        models.User.find({ where: { username: socket.username } }).then(function (user) {
            if (user == null) {
                console.log("Null user trying to follow chat with id " + chatId);
            }

            user.followChat(chatId);
        });
    });
    
    //onunFollow
    socket.on('unfollowChat', function (chatId) {
        models.User.find({ where: { username: socket.username } }).then(function (user) {
            if (user == null) {
                console.log("Null user trying to follow chat with id " + chatId);
            }
            
            user.unfollowChat(chatId);
        });
    });
    
    socket.on('requestUpdatedComment', function (commentId) {
        models.Comment.findById(commentId).then(function (comment) {
            socket.emit("receiveUpdatedComment", commentId, comment.likes, comment.dislikes);
            //socket.broadcast.emit("receiveUpdatedComment", commentId, comment.likes, comment.dislikes);
        });
    });
    
    socket.on('chatRequest', function (type,chatId) {
        //type = 0 Realtime
        //= 1 Hot
        //= 2 Top
        //= 3 Liked
        //= 4 Mine

        if (type == 4) {
            //MINE
            socket.leave(socket.room);
            
            models.User.find({ where: { username: socket.username } }).then(function (user) {
                if (user == null) return;
                
                var likeList = user.getLikeArray();
                var query = "SELECT * FROM `comments` WHERE (ReplyId IS NULL AND `UserId`="+ user.id +" AND `ChatroomId`="+chatId+") ORDER BY `likes` DESC, `dislikes` ASC, `createdAt` DESC LIMIT 25";
                
                queryCommentsThenLoad(chatId, query, socket);
            });

        } else if (type == 3) {
            //LIKED
            socket.leave(socket.room);
            
            models.User.find({ where: { username: socket.username } }).then(function (user) {
                if (user == null) return;
                
                var likeList = user.getLikeArray();
                var query = "SELECT * FROM `comments` WHERE ChatroomId = " + chatId;
                if (likeList.length > 0) {
                    query = query + " AND (";
                    for (var k = 0; k < likeList.length; k++) {
                        query = query + "id = " + likeList[k];
                        if (k != (likeList.length - 1)) {
                            query = query + " OR ";
                        }
                    }
                    query = query + ")";
                } else {
                    return;
                }
                query = query + " ORDER BY likes DESC LIMIT 10";
                
                queryCommentsThenLoad(chatId, query, socket);
            });

        } else if (type == 2) {
            //TOP
            socket.leave(socket.room);
            queryCommentsThenLoad(chatId, "SELECT * FROM `comments` WHERE (ReplyId IS NULL AND ChatroomId = " + chatId + ") ORDER BY `likes` DESC, `dislikes` ASC, `createdAt` DESC LIMIT 25", socket);
            
        } else if (type == 1) {
            //HOT
            socket.leave(socket.room);
            queryCommentsThenLoad(chatId, "SELECT * FROM `comments` WHERE (ReplyId IS NULL AND ChatroomId = " + chatId + " AND (`createdAt` > DATE_SUB(now(), INTERVAL 30 DAY))) ORDER BY `likes` DESC, `dislikes` ASC, `createdAt` DESC LIMIT 25", socket);

        } else {
            //REALTIME
            socket.join(socket.room);
            queryCommentsThenLoad(chatId, "SELECT * FROM `comments` WHERE (ReplyId IS NULL AND ChatroomId = " + chatId + ") ORDER BY `id` LIMIT 15", socket);
        }
    })

    //Handle Incoming Chat
    socket.on('chatToServer', function (replyId, chatId, msg) {
        var badgeId = "";
        
        if (socket.username == "Anonymous") {
            var data = [];
            data.push(-1);         // data[0] = id
            data.push(replyId);    // data[1] = ReplyId
            data.push(socket.username); // data[2] = username
            data.push(msg);    // data[3] = message
            data.push(0);      // data[4] = likes
            data.push(0);   // data[5] = dislikes
            data.push(new Date());  // data[6] = createdAt
            data.push(0);        // data[7] = Badge Url
            
            if (anonChatList[chatId] == null) {
                anonChatList[chatId] = new Array();
            }
            if (anonChatList[chatId].length >= 10) {
                anonChatList[chatId].splice(0, 1);
            }
            anonChatList[chatId].push(data);
            
            fs.writeFile("./config/anonchat.dat", JSON.stringify(anonChatList), function (err) {
                if (err) {
                    return console.log(err);
                }
            }); 

            console.log("Broadcasting: " + data);
            socket.emit('chatToClient', data);
            socket.broadcast.to(socket.room).emit('chatToClient', data);
            return;
        }

        async.series([
            function (callback){
                models.User.find({ where: { username: socket.username } }).then(function (user) {
                    badgeId = user.BadgeId;
                    callback(null, user.id);
                });
            },
            function (callback) {//Get badge url
                callback(null, badgeList[badgeId-1].imageUrl);
            }
        ], function (err, result) {
            //result[0] = id
            //result[1] = badgeurl
            //Add Chat to database

            if (replyId == null) {
                models.Comment.create({ ReplyId: null, UserId: result[0], ChatroomId: chatId, message: msg }).then(function (comm) {
                    var data = [];
                    data.push(comm.id);         // data[0] = id
                    data.push(comm.ReplyId);    // data[1] = ReplyId
                    data.push(socket.username); // data[2] = username
                    data.push(comm.message);    // data[3] = message
                    data.push(comm.likes);      // data[4] = likes
                    data.push(comm.dislikes);   // data[5] = dislikes
                    data.push(comm.createdAt);  // data[6] = createdAt
                    data.push(result[1]);        // data[7] = Badge Url
                    console.log("Broadcasting: " + data);
                    socket.emit('chatToClient', data);
                    socket.broadcast.to(socket.room).emit('chatToClient', data);
                });
            } else {
                models.Comment.create({ ReplyId: replyId, UserId: result[0], ChatroomId: chatId, message: msg }).then(function (comm) {
                    var data = [];
                    data.push(comm.id);         // data[0] = id
                    data.push(comm.ReplyId);    // data[1] = ReplyId
                    data.push(socket.username); // data[2] = username
                    data.push(comm.message);    // data[3] = message
                    data.push(comm.likes);      // data[4] = likes
                    data.push(comm.dislikes);   // data[5] = dislikes
                    data.push(comm.createdAt);  // data[6] = createdAt
                    data.push(result[1]);        // data[7] = Badge Url
                    console.log("Broadcasting: " + data);
                    socket.emit('chatToClient', data);
                    socket.broadcast.to(socket.room).emit('chatToClient', data);
                });
            }
        });
    });
});

function queryCommentsThenLoad(chatId, query, socket){
    var commIds = [];
    var users = [];
    var badges = [];
    var comms = [];
    var count1 = 0;
    var count2 = 0;
    var names = [];
    var badgeUrls = [];
    var commCount = 0;
    var anonList = anonChatList[chatId].slice(0);

    async.series([
        function (callback) {
            //Fetch Comments
            models.sequelize.query(query).then(function (comments) {
                comms = comments[0];
                for (var i = 0; i < comments[0].length; i++) {
                    commIds[i] = comments[0][i].id;
                    users[i] = comments[0][i].UserId; //ID
                }
                
                callback(null);
            });
        },
        function (callback) {
            //Get usernames and badgeids
            async.whilst(
                function () { return count1 < users.length; },
                function (callback3) {
                    models.User.findById(users[count1]).then(function (user) {
                        names.push(user.username);
                        badges.push(user.BadgeId);
                        count1++;
                        callback3(null);
                    });
                },
                function (err) {
                    callback(null);
                }
            );
        },
        function (callback) {
            //Get badgeurls
            for (var i = 0; i < badges.length; i++) {
                badgeUrls.push(badgeList[badges[i]-1].imageUrl);
            }
            callback(null);
        },
        function (callback) {
            var data = [];

            for (var i = 0; i < commIds.length; i++) {
                data = [];
                
                if (anonList.length > 0) {
                    var lowAnonDate = new Date(anonList[0][6]);
                    var commDate = new Date(comms[i].createdAt);

                    while(lowAnonDate < commDate) {
                        socket.emit('chatToClient', anonList.shift());

                        if (anonList.length > 0) {
                            lowAnonDate = anonList[0][6];
                            commDate = Date.parse(comms[i].createdAt);
                        } else {
                            lowAnonDate = commDate + 1;
                        }
                    }
                }

                data.push(comms[i].id);         // data[0] = id
                data.push(comms[i].ReplyId);    // data[1] = ReplyId
                data.push(names[i]);            // data[2] = username
                data.push(comms[i].message);    // data[3] = message
                data.push(comms[i].likes);      // data[4] = likes
                data.push(comms[i].dislikes);   // data[5] = dislikes
                data.push(comms[i].createdAt);  // data[6] = createdAt
                data.push(badgeUrls[i]);        // data[7] = Badge Url
                socket.emit('chatToClient', data);
            }
            
            count1 = 0;
            count2 = 0;
            names = [];
            users = [];
            badges = [];
            badgeUrls = [];

            async.whilst(
                function () { return commCount < commIds.length; },
                function (callback3) {
                    models.sequelize.query("SELECT * FROM `comments` WHERE ReplyId = " + commIds[commCount] + " ORDER BY `id` ASC LIMIT 10").then(function (replys) {
                        
                        if (replys == null) {
                            commCount++;
                            callback3(null);
                        }
                        //console.log("Getting Replys for " + commIds[commCount]);
                        for (var i = 0; i < replys[0].length; i++) {
                            users[i] = replys[0][i].UserId; //ID
                        }
                        async.series([
                            function (callback2) {
                                //Get usernames
                                async.whilst(
                                function () { return count1 < users.length; },
                                function (callback3) {
                                        models.User.findById(users[count1]).then(function (user) {
                                            names.push(user.username);
                                            badges.push(user.BadgeId);
                                            count1++;
                                            callback3(null);
                                        });
                                    },
                                   function (err) {
                                        callback2(null);
                                    }
                                );
                            },
                            function (callback4) {
                                //Get badgeurls
                                for (var i = 0; i < badges.length; i++) {
                                    badgeUrls.push(badgeList[badges[i]-1].imageUrl);
                                }
                                callback4(null);
                            }
                        ],  
                        function (err, results) {
                            var data2 = [];

                            for (var i = 0; i < replys[0].length; i++) {
                                data2 = [];
                                data2.push(replys[0][i].id);         // data[0] = id
                                data2.push(replys[0][i].ReplyId);    // data[1] = ReplyId
                                data2.push(names[i]);                // data[2] = username
                                data2.push(replys[0][i].message);    // data[3] = message
                                data2.push(replys[0][i].likes);      // data[4] = likes
                                data2.push(replys[0][i].dislikes);   // data[5] = dislikes
                                data2.push(replys[0][i].createdAt);  // data[6] = createdAt
                                data2.push(badgeUrls[i]);            // data[7] = Badge Url
                                socket.emit('chatToClient', data2);
                            }
                            count1 = 0;
                            count2 = 0;
                            users = [];
                            names = [];
                            badges = [];
                            badgeUrls = [];

                            commCount++;
                            callback3(null);
                        });

                    });
                },
                function (err) {
                    //LOAD ANON
                    if (anonList.length > 0) {
                        for (var i = 0; i < anonList.length; i++) {
                            socket.emit('chatToClient', anonList[i]);
                        }
                    }
                    callback(null);
                }
            );

        }
    ]);
}

