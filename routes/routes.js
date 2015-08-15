var models = require('../models');
var marked = require('marked');
var async = require('async');
var nodemailer = require('nodemailer');
var sm = require('sitemap');
var crypto = require('crypto');


var badgeList = [];

function Badge(id, name, url) {
    this.id = id;
    this.name = name;
    this.imageUrl = url;
};

models.sequelize.query("SELECT * FROM badges").then(function (badges) {
    for (var i = 0; i < badges[0].length; i++) {
        badgeList.push(new Badge(badges[0][i].id, badges[0][i].name, badges[0][i].imageUrl));
    }
});

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;'
    //"/": '&#x2F;'
};


module.exports = function (app, passport) {
    
    // =====================================
    // HOME ========
    // =====================================
    app.get('/', function (req, res) {
        var query;
        var trendy;
        var dislikeList = [];
        var likeList = [];
        var username = "";

        if (req.user != null) { //IF LOGGED IN
            username = req.user.username;
            likeList = req.user.likesList;
            dislikeList = req.user.dislikesList;

            var fArray = req.user.getFollowArray();
                
            if (fArray.length != 0) {
                async.series([
                        //Getting New Rooms
                    function (callback) {
                        query = "SELECT * FROM `chatrooms` ORDER BY `createdAt` DESC LIMIT 5";
                        models.sequelize.query(query).then(function (newRooms) {
                            callback(null, newRooms[0]);
                        });
                    },
                        //Getting Top Rooms
                    function (callback) {
                        query = "SELECT * FROM `chatrooms` WHERE (";
                        for (var i = 0; i < fArray.length; i++) {
                            query = query + "id=" + fArray[i];
                            if (i != (fArray.length - 1)) {
                                query = query + " OR ";
                            }
                        }
                        query = query + ") ORDER BY `usersConnected` DESC LIMIT 5";
                        models.sequelize.query(query).then(function (topRooms) {
                            callback(null, topRooms[0]);
                        });
                    },
                        //Getting Suggested Rooms
                    function (callback) {
                        query = "SELECT * FROM `chatrooms` WHERE (";
                        for (var i = 0; i < fArray.length; i++) {
                            query = query + "id !=" + fArray[i];
                            if (i != (fArray.length - 1)) {
                                query = query + " AND ";
                            }
                        }
                        query = query + ") ORDER BY `usersConnected` DESC LIMIT 5";
                        models.sequelize.query(query).then(function (suggRooms) {
                            callback(null, suggRooms[0]);
                        });
                    }
                ], function (err, result) {
                    res.render('home', {
                        title: 'ChitterChat: online chat room communities',
                        loggedInAs: username,
                        newRooms: result[0],
                        topRooms: result[1],
                        suggRooms: result[2]
                    })
                });
                return;
            }
        }
        //IF NOT LOGGED IN

        async.series([
            //Getting New Rooms
            function (callback) {
                query = "SELECT * FROM `chatrooms` ORDER BY `createdAt` DESC LIMIT 5";
                models.sequelize.query(query).then(function (newRooms) {
                    callback(null, newRooms[0]);
                });
            },
            //Getting Top Rooms
            function (callback) {
                query = "SELECT * FROM `chatrooms` ORDER BY `usersConnected` DESC LIMIT 5";
                models.sequelize.query(query).then(function (topRooms) {
                    callback(null, topRooms[0]);
                });
            },
            //Getting Suggested Rooms
            function (callback) {
                query = "SELECT * FROM `chatrooms` ORDER BY `usersConnected` DESC LIMIT 5,5";
                models.sequelize.query(query).then(function (suggRooms) {
                    callback(null, suggRooms[0]);
                });
            }
        ], function (err, result) {
            res.render('home', {
                title: 'ChitterChat: online chat room communities',
                loggedInAs: username,
                newRooms: result[0],
                topRooms: result[1],
                suggRooms: result[2]
            });
        });

    });
    
    // =====================================
    // FEED ========
    // =====================================
    app.get('/feed', function (req, res) {
        var query;
        var trendy;
        var dislikeList = [];
        var likeList = [];
        var username = "";
        
        if (req.user != null) { //IF LOGGED IN
            username = req.user.username;
            likeList = req.user.likesList;
            dislikeList = req.user.dislikesList;
            
            var fArray = req.user.getFollowArray();
            
            if (fArray.length != 0) {
                async.series([
                    //Getting user ids and usernames
                    function (callback) {
                        query = "SELECT * FROM `comments` WHERE ((";
                        for (var i = 0; i < fArray.length; i++) {
                            query = query + "ChatroomId = " + fArray[i];
                            if (i != (fArray.length - 1)) {
                                query = query + " OR ";
                            }
                        }
                        query = query + ") AND ReplyId IS NULL) ORDER BY `likes` DESC, `createdAt` DESC LIMIT 10";
                        
                        models.sequelize.query(query).then(function (comments) {
                            var userids = [];
                            var chatids = [];
                            var names = [];
                            var chatnames = [];
                            var count1 = 0;
                            var count2 = 0;
                            for (var i = 0; i < comments[0].length; i++) {
                                userids.push(comments[0][i].UserId);
                                chatids.push(comments[0][i].ChatroomId);
                            }
                            
                            async.parallel([
                                function (callback2) {
                                    //Get usernames
                                    async.whilst(
                                        function () { return count1 < userids.length; },
                                function (callback3) {
                                            models.User.findById(userids[count1]).then(function (user) {
                                                names.push(user.username);
                                                count1++;
                                                callback3(null);
                                            });
                                        },
                                function (err) {
                                            callback2(null, names);
                                        }
                                    );
                                },
                                function (callback4) {
                                    //Get chatnames
                                    async.whilst(
                                        function () { return count2 < chatids.length; },
                                function (callback5) {
                                            models.Chatroom.findById(chatids[count2]).then(function (chat) {
                                                chatnames.push(chat.name);
                                                count2++;
                                                callback5(null);
                                            });
                                        },
                                function (err) {
                                            callback4(null, chatnames);
                                        }
                                    );
                                }
                            ],  
                    function (err, results) {
                                callback(null, comments[0] , results[0], results[1]);
                            });
                        });
                    },
                ], function (err, result) {
                    res.render('feed', {
                        title: 'Chat Feed - ChitterChat: online chat room communities',
                        loggedInAs: username,
                        likeList: likeList,
                        dislikeList: dislikeList,
                        entityMap: entityMap,
                        trendy: result[0][0],
                        commNames: result[0][1],
                        commRooms: result[0][2]
                    })
                });
                return;
            }
        }
        //IF NOT LOGGED IN
        
        async.series([
            //Getting user ids and usernames
            function (callback) {
                query = "SELECT * FROM `comments` WHERE (ReplyId IS NULL) ORDER BY `likes` DESC, `createdAt` DESC LIMIT 10";
                models.sequelize.query(query).then(function (comments) {
                    var userids = [];
                    var chatids = [];
                    var names = [];
                    var chatnames = [];
                    var count1 = 0;
                    var count2 = 0;
                    for (var i = 0; i < comments[0].length; i++) {
                        userids.push(comments[0][i].UserId);
                        chatids.push(comments[0][i].ChatroomId);
                    }
                    async.parallel([
                        function (callback2) {
                            //Get usernames
                            async.whilst(
                                function () { return count1 < userids.length; },
                                function (callback3) {
                                    //console.log(userids[count1]);
                                    models.User.findById(userids[count1]).then(function (user) {
                                        names.push(user.username);
                                        count1++;
                                        callback3(null);
                                    });
                                },
                                function (err) {
                                    callback2(null, names);
                                }
                            );
                        },
                        function (callback4) {
                            //Get chatnames
                            async.whilst(
                                function () { return count2 < chatids.length; },
                                function (callback5) {
                                    models.Chatroom.findById(chatids[count2]).then(function (chat) {
                                        chatnames.push(chat.name);
                                        count2++;
                                        callback5(null);
                                    });
                                },
                                function (err) {
                                    callback4(null, chatnames);
                                }
                            );
                        }
                    ],  
                    function (err, results) {
                        callback(null, comments[0] , results[0], results[1]);
                    });
                });
            }
        ], function (err, result) {
            res.render('feed', {
                title: 'Chat Feed - ChitterChat: online chat room communities',
                loggedInAs: username,
                entityMap: entityMap,
                trendy: result[0][0],
                commNames: result[0][1],
                commRooms: result[0][2]
            })
        });
    });

    // =====================================
    // CHATROOM ========
    // =====================================
    app.get('/c/:name', function (req, res) {
        
        // security hazard with name - need to encrypt or not depend on the client for its value
        var name;
        var dislikeList;
        var likeList;
        var chatName = req.params.name;
        var chatId;
        var following = false;
        var followArray = [];  //JSON to array
        
        if (req.user != null) {
            followArray = req.user.getFollowArray();
            name = req.user.username;
            likeList = req.user.likesList;
            dislikeList = req.user.dislikesList;
        } else {
            name = "";
            likeList = "";
            dislikeList = "";
        }
        
        models.Chatroom.find({ where: { name: chatName } }).then(function (chatroom) {
            
            if (chatroom == null) {
                res.redirect('/404');
            }
            
            if (req.user != null && followArray.indexOf(chatroom.id) > -1) {
                following = true;
            }
            console.log(marked(chatroom.details));
            res.render('chatroom', {
                title: chatroom.name + ' - ChitterChat: online chat room communities',
                name: name,
                likeList: likeList,
                dislikeList: dislikeList,
                roomId: chatroom.id,
                roomName: chatroom.name,
                followers: chatroom.followers,
                description: chatroom.description,
                details: marked(chatroom.details).toString(),
                modList: chatroom.getModArray(),
                isMod: chatroom.isMod(name),
                anon: chatroom.anon,
                founder: chatroom.founder,
                interval: chatroom.chatInterval,
                following: following
            });
        });
    });
    
    // =====================================
    // FOLLOWING ===========================
    // =====================================
    app.get('/following', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        var fArray = req.user.getFollowArray();
        
        var query = "SELECT * FROM `chatrooms` WHERE (";
        for (var i = 0; i < fArray.length; i++) {
            query = query + "id=" + fArray[i];
            if (i != (fArray.length - 1)) {
                query = query + " OR ";
            }
        }
        query = query + ") ORDER BY `usersConnected` DESC";
        console.log(fArray);
        
        if (fArray.length > 0) {
            console.log("Following");
            models.sequelize.query(query).then(function (chatrooms) {
                res.render('following', {
                    title: 'Following - ChitterChat: online chat room communities',
                    loggedInAs: req.user.username,
                    rooms: chatrooms[0]
                });
            });
        } else {
            console.log("No follows");
            var rooms = [];
            res.render('following', {
                title: 'Following - ChitterChat: online chat room communities',
                loggedInAs: req.user.username,
                rooms: rooms
            });
        }
    });
    
    // =====================================
    // MY ROOMS ===========================
    // =====================================
    app.get('/myrooms', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var query = "SELECT * FROM `chatrooms` WHERE founder='" + req.user.username + "' ORDER BY `followers` DESC";
        
        models.sequelize.query(query).then(function (chatrooms) {
            if (chatrooms == null) {
                res.render('myrooms', {
                    title: 'My Rooms - ChitterChat: online chat room communities',
                    loggedInAs: req.user.username,
                    rooms: ''
                });
            } else {
                res.render('myrooms', {
                    title: 'My Rooms - ChitterChat: online chat room communities',
                    loggedInAs: req.user.username,
                    rooms: chatrooms[0]
                });
            }
        });
    });
    
    // =====================================
    // REP REWARDS ===========================
    // =====================================
    app.get('/reprewards', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var badgeid = req.user.BadgeId;

        res.render('rewards', {
            title: 'Reputation Rewards - ChitterChat: online chat room communities',
            loggedInAs: req.user.username,
            message: "",
            currBadge: badgeid,
            badgeList: badgeList
        });
    });
    
    app.post('/reprewards/updatebadge', function (req, res) {
        if (req.user == null) {
            return;
        }
        var username = req.user.username;
        var badgeid = parseInt(req.body.badge);

        models.User.find({ where: { username: username } }).then(function (user) {
            user.BadgeId = badgeid;
            user.save();
            res.render('rewards', {
                title: 'Reputation Rewards - ChitterChat: online chat room communities',
                loggedInAs: req.user.username,
                message: "Badge Updated",
                currBadge: badgeid,
                badgeList: badgeList
            });
        });
    });

    // =====================================
    // EDIT ROOM ===========================
    // =====================================
    app.get('/edit/:id', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatId = req.params.id;
        
        models.Chatroom.findById(chatId).then(function (chatroom) {
            if (req.user.username != chatroom.founder && !chatroom.isMod(req.user.username) && req.user.username != "Secretbryan") {
                res.redirect('/');
            }

            res.render('edit', {
                title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                loggedInAs: req.user.username,
                room: chatroom,
                modList: chatroom.getModArray(),
                message: ""
            });
        });
    });
    
    // =====================================
    // USER ===============================
    // =====================================   
    app.get('/u/:name', function (req, res) {
        var username = req.params.name;
        
        models.User.find({ where: { username: username } }).then(function (user) {
            if (user == null) {
                res.redirect('/404');
                return;
            }
            
            
            var pastComms = [];
            
            async.series([
            //Getting user ids and usernames
                function (callback) {
                    query = "SELECT * FROM `comments` WHERE ReplyId IS NULL AND UserId = " + user.id + " ORDER BY `createdAt` DESC LIMIT 10";
                    models.sequelize.query(query).then(function (comments) {
                        var chatids = [];
                        var chatnames = [];
                        var count2 = 0;
                        
                        for (var i = 0; i < comments[0].length; i++) {
                            chatids.push(comments[0][i].ChatroomId);
                        }
                        
                        pastComms = comments[0];
                        
                        async.whilst(
                            function () { return count2 < chatids.length; },
                        function (callback2) {
                                models.Chatroom.findById(chatids[count2]).then(function (chat) {
                                    chatnames.push(chat.name);
                                    count2++;
                                    callback2(null);
                                });
                            },
                        function (err) {
                                callback(null, chatnames);
                            }
                        );

                    });
                },
            ], function (err, result) {
                res.render('profile', {
                    title: 'Profile - ' + user.username + ' - ChitterChat: online chat room communities',
                    loggedInAs: (req.user == null ? "" : req.user.username),
                    user: user, // get the user out of session and pass to template
                    pastComms: pastComms,
                    entityMap: entityMap,
                    pastRoomNames: result[0]
                });
            });
        });
    });
    
    // =====================================
    // LOGIN ===============================
    // =====================================
    app.get('/login', function (req, res) {
        if (req.user != null) {
            res.redirect('/');
            return;
        }
        
        res.render('login', { title: 'Login - ChitterChat: online chat room communities', message: req.flash('loginMessage') });
    });
    
    // =====================================
    // SUPPORT ===============================
    // =====================================
    app.get('/support', function (req, res) {
        
        var username = "";
        
        if (req.user != null) {
            username = req.user.username;
        }

        res.render('support', { title: 'Support - ChitterChat: online chat room communities', message: '', loggedInAs: username });
    });
    
    // =====================================
    // SIGNUP ==============================
    // =====================================
    app.get('/signup', function (req, res) {
        if (req.user != null) {
            res.redirect('/');
            return;
        }
        // render the page and pass in any flash data if it exists
        res.render('signup', { title: 'Signup - ChitterChat: online chat room communities', message: req.flash('signupMessage') });
    });
    
    // =====================================
    // FAQ ==============================
    // =====================================
    app.get('/faq', function (req, res) {
        
        var username = "";
        
        if (req.user != null) {
            username = req.user.username;
        }

        res.render('faq', { title: 'FAQ - ChitterChat: online chat room communities' , message: '', loggedInAs: username });
    });
    
    // =====================================
    // PROFILE SECTION =====================
    // =====================================
    app.get('/profile', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var pastComms = [];

        async.series([
            //Getting user ids and usernames
            function (callback) {
                query = "SELECT * FROM `comments` WHERE ReplyId IS NULL AND UserId = " + req.user.id +" ORDER BY `createdAt` DESC LIMIT 10";
                models.sequelize.query(query).then(function (comments) {
                    var chatids = [];
                    var chatnames = [];
                    var count2 = 0;

                    for (var i = 0; i < comments[0].length; i++) {
                        chatids.push(comments[0][i].ChatroomId);
                    }
                    
                    pastComms = comments[0];
                    
                    async.whilst(
                        function () { return count2 < chatids.length; },
                        function (callback2) {
                            models.Chatroom.findById(chatids[count2]).then(function (chat) {
                                chatnames.push(chat.name);
                                count2++;
                                callback2(null);
                            });
                        },
                        function (err) {
                            callback(null, chatnames);
                        }
                    );

                });
            },
        ], function (err, result) {
            res.render('profile', {
                title: 'Profile - ' + req.user.username + ' - ChitterChat: online chat room communities',
                loggedInAs: req.user.username,
                user: req.user, // get the user out of session and pass to template
                entityMap: entityMap,
                pastComms: pastComms,
                pastRoomNames: result[0]
            });
        });
    });
    
    // =====================================
    // CREATE SECTION =====================
    // =====================================
    app.get('/create', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        res.render('create', {
            title: 'Create - ChitterChat: online chat room communities',
            loggedInAs: req.user.username,
            message: ''
        });
    });
    
    // =====================================
    // ADMIN SECTION =====================
    // =====================================
    app.get('/admin', function (req, res) {
        if (req.user == null || req.user.username != "Secretbryan") {
            res.redirect('/login');
            return;
        }
        
        res.render('admin', {
            title: 'Super secret admin area.',
            message: ''
        });
    });
    
    // process the edit form
    app.post('/admin/deletecomment', function (req, res) {
        if (req.user == null || req.user.username != "Secretbryan") {
            res.redirect('/login');
            return;
        }

        var commentId = req.body.commId;

        models.Comment.destroy({ where: { id: commentId } }).then(function (comment) {
            models.Comment.destroy({ where: { ReplyId: commentId } }).then(function (replys) {
                console.log("Comments and replys removed.");
                res.render('admin', {
                    title: 'Super secret admin area.',
                    message: 'Comment removed.'
                });
            });
        });
    });
    
    // =====================================
    // LOGOUT ==============================
    // =====================================
    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });
    
    //robots.txt
    app.get('/robots.txt', function (req, res) {
        res.type('text/plain');
        res.send("User-agent: *");
    });
    
    //sitemap
    app.get('/sitemap.xml', function (req, res) {     

        var sitemap = sm.createSitemap({
            hostname: 'http://www.chitterchat.net',
            cacheTime: 600000,  // 600 sec cache period 
            urls: [
                { url: '/', changefreq: 'daily', priority: 0.3 },
                { url: '/login', changefreq: 'weekly', priority: 0.7 },
                { url: '/reprewards', changefreq: 'weekly', priority: 0.7 },
                { url: '/signup' , changefreq: 'weekly', priority: 0.7 },
                { url: '/support' , changefreq: 'weekly', priority: 0.7 }
            ]
        });
        
        models.sequelize.query("SELECT name FROM chatrooms").then(function (rooms) {
            
            for (var i = 0; i < rooms[0].length; i++) {
                sitemap.urls.push({ url: '/c/'+ rooms[0][i].name, changefreq: 'daily', priority: 0.5 });
            }
            models.sequelize.query("SELECT username FROM users").then(function (users) {
                for (var i = 0; i < users[0].length; i++) {
                    sitemap.urls.push({ url: '/u/' + users[0][i].username, changefreq: 'daily', priority: 0.5 });
                }

                res.header('Content-Type', 'application/xml');
                res.send(sitemap.toString());
            });
        });   
    });

    //like
    app.get('/like/:id', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        var commentid = parseInt(req.params.id);
        var username = req.user.username;

        models.User.find({ where: {username: username} }).then(function (user) {
            user.like(commentid);
            res.send("like");
        });
    });
    
    //dislike
    app.get('/dislike/:id', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        var commentid = parseInt(req.params.id);
        var username = req.user.username;
        
        models.User.find({ where: { username: username } }).then(function (user) {
            user.dislike(commentid);
            res.send("dislike");
        });
    });

    //fetchTrendy
    app.get('/fetchTrendy/:offset', function(req, res) {
        var offset = req.params.offset;
        
        if (req.user != null) { //IF LOGGED IN
            var fArray = req.user.getFollowArray();
            
            if (fArray.length != 0) {
                async.series([
                    //Getting user ids and usernames
                    function (callback) {
                        query = "SELECT * FROM `comments` WHERE ((";
                        for (var i = 0; i < fArray.length; i++) {
                            query = query + "ChatroomId = " + fArray[i];
                            if (i != (fArray.length - 1)) {
                                query = query + " OR ";
                            }
                        }
                        query = query + ") AND ReplyId IS NULL) ORDER BY `likes` DESC, `dislikes` ASC, `createdAt` DESC LIMIT " + offset + ",10";
                        
                        models.sequelize.query(query).then(function (comments) {
                            var userids = [];
                            var chatids = [];
                            var names = [];
                            var chatnames = [];
                            var count1 = 0;
                            var count2 = 0;
                            for (var i = 0; i < comments[0].length; i++) {
                                userids.push(comments[0][i].UserId);
                                chatids.push(comments[0][i].ChatroomId);
                            }
                            
                            async.parallel([
                                function (callback2) {
                                    //Get usernames
                                    async.whilst(
                                        function () { return count1 < userids.length; },
                                function (callback3) {
                                            models.User.findById(userids[count1]).then(function (user) {
                                                names.push(user.username);
                                                count1++;
                                                callback3(null);
                                            });
                                        },
                                function (err) {
                                            callback2(null, names);
                                        }
                                    );
                                },
                                function (callback4) {
                                    //Get chatnames
                                    async.whilst(
                                        function () { return count2 < chatids.length; },
                                function (callback5) {
                                            models.Chatroom.findById(chatids[count2]).then(function (chat) {
                                                chatnames.push(chat.name);
                                                count2++;
                                                callback5(null);
                                            });
                                        },
                                function (err) {
                                            callback4(null, chatnames);
                                        }
                                    );
                                }
                            ],  
                    function (err, results) {
                                callback(null, comments[0] , results[0], results[1]);
                            });
                        });
                    },
                ], function (err, result) {
                    res.send(result);
                });
                return;
            }
        }
        //IF NOT LOGGED IN
        
        async.series([
            //Getting user ids and usernames
            function (callback) {
                query = "SELECT * FROM `comments` WHERE (ReplyId IS NULL) ORDER BY `likes` DESC, `dislikes` ASC, `createdAt` DESC LIMIT " + offset + ",10";
                models.sequelize.query(query).then(function (comments) {
                    var userids = [];
                    var chatids = [];
                    var names = [];
                    var chatnames = [];
                    var count1 = 0;
                    var count2 = 0;
                    for (var i = 0; i < comments[0].length; i++) {
                        userids.push(comments[0][i].UserId);
                        chatids.push(comments[0][i].ChatroomId);
                    }
                    
                    async.parallel([
                        function (callback2) {
                            //Get usernames
                            async.whilst(
                                function () { return count1 < userids.length; },
                                function (callback3) {
                                    models.User.findById(userids[count1]).then(function (user) {
                                        names.push(user.username);
                                        count1++;
                                        callback3(null);
                                    });
                                },
                                function (err) {
                                    callback2(null, names);
                                }
                            );
                        },
                        function (callback4) {
                            //Get chatnames
                            async.whilst(
                                function () { return count2 < chatids.length; },
                                function (callback5) {
                                    models.Chatroom.findById(chatids[count2]).then(function (chat) {
                                        chatnames.push(chat.name);
                                        count2++;
                                        callback5(null);
                                    });
                                },
                                function (err) {
                                    callback4(null, chatnames);
                                }
                            );
                        }
                    ],  
                    function (err, results) {
                        callback(null, comments[0] , results[0], results[1]);
                    });
                });
            },
        ], function (err, result) {
            res.send(result);
        });
    });

    // process the signup form
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect : '/', // redirect
        failureRedirect : '/signup', // redirect back to the signup page if there is an error
        failureFlash: true
    }));
    
    // process the login form
    app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/', // redirect
        failureRedirect : '/login', // redirect back to the login page if there is an error
        failureFlash: true
    }));
    
    
    app.get('/auth/twitter',
        passport.authenticate('twitter'));
    
    app.get('/auth/twitter/callback', 
        passport.authenticate('twitter', { failureRedirect: '/login' }),
        function (req, res) {
        // Successful authentication, redirect home.
        res.redirect('/');
    });

    app.get('/auth/facebook',
        passport.authenticate('facebook', { scope: ['email'] }),
        function (req, res) {
    });
    
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', { failureRedirect: '/login'}),
        function (req, res) {
            // Successful authentication, redirect home.
            res.redirect('/');
    });
    
    // GET /auth/reddit
    //   Use passport.authenticate() as route middleware to authenticate the
    //   request.  The first step in Reddit authentication will involve
    //   redirecting the user to reddit.com.  After authorization, Reddit
    //   will redirect the user back to this application at /auth/reddit/callback
    //
    //   Note that the 'state' option is a Reddit-specific requirement.
    app.get('/auth/reddit', function (req, res, next) {
        req.session.state = crypto.randomBytes(32).toString('hex');
        passport.authenticate('reddit', {
            state: req.session.state,
        })(req, res, next);
    });
    
    // GET /auth/reddit/callback
    //   Use passport.authenticate() as route middleware to authenticate the
    //   request.  If authentication fails, the user will be redirected back to the
    //   login page.  Otherwise, the primary route function function will be called,
    //   which, in this example, will redirect the user to the home page.
    app.get('/auth/reddit/callback', function (req, res, next) {
        // Check for origin via state token
        if (req.query.state == req.session.state) {
            passport.authenticate('reddit', {
                successRedirect: '/',
                failureRedirect: '/login'
            })(req, res, next);
        }
        else {
           next(new Error(403));
        }
    });


    // process the support form
    app.post('/support', function (req, res) {
        var message = req.body.message;
        var name = req.body.name;
        var ip = req.ip;
        
        var username = "";
        
        if (req.user != null) {
            username = req.user.username;
        }

        var mailOptions = {
            from: 'Site Mailer <mailer@ChitterChat.net>', // sender address
            to: 'specscape1@gmail.com', // list of receivers
            subject: 'Message from Website', // Subject line
            html: '<b>New message!</b><p>From: ' + name + '</p><br><p>'+message+'</p><br><p>'+ip+'</p>' // html body
        };
        
        // send mail with defined transport object
        transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
                res.render('support', { title: 'Support - ChitterChat: online chat room communities', loggedInAs: username, message: 'There was an error with sending the message.' });
                return console.log(error);
            }
            console.log('Message sent: ' + info.response);
            res.render('support', { title: 'Support - ChitterChat: online chat room communities', loggedInAs: username, message: 'Message Sent' });
        });

    });
    
    // process the create form
    app.post('/create', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatName = req.body.name;
        var desc = req.body.description;
        var details = req.body.details;
        var karmareq = parseInt(req.body.karmareq);
        var interval = parseInt(req.body.interval);
        var type = parseInt(req.body.type);
        var filterStr = parseInt(req.body.filter);
        var founder = req.user.username;
        var anon = parseInt(req.body.anon);
        
        //if (req.user.karma < 20) {
        //    res.render('create', {
        //        title: 'Create - ChitterChat',
        //        loggedInAs: req.user.username,
        //        message: 'You need atleast 20 karma to create a chatroom.'
        //    });
        //}
        
        if (!(/^[A-Za-z0-9]{5,}$/.test(chatName))) {
            console.log("Bad chat name");
            res.render('create', {
                title: 'Create - ChitterChat: online chat room communities',
                loggedInAs: req.user.username,
                message: 'Name cannot contain spaces or special characters.'
            });
            return;
        }
        
        models.Chatroom.find({ where: { name: chatName } }).then(function (chatroom) {
            if (chatroom == null) {
                console.log("creating");
                models.Chatroom.create({ name: chatName, description: desc, details: details, type: type, filter: filterStr, anon: anon, karmaReq: karmareq, founder: founder, chatInterval: interval }).then(function (newChatroom) {
                    res.redirect('/c/' + newChatroom.name);
                });
            } else {
                console.log("creating failed");
                res.render('create', {
                    title: 'Create - ChitterChat: online chat room communities',
                    loggedInAs: req.user.username,
                    message: 'Name is already in use.'
                });
            }
        });
    });
    
    // process the edit form
    app.post('/edit/:id', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatId = req.params.id;
        var desc = req.body.description;
        var details = req.body.details;
        var karmareq = req.body.karmareq;
        var interval = req.body.chatinterval;
        var type = parseInt(req.body.type);
        var filterStr = parseInt(req.body.filter);
        var founder = req.user.username;
        var anon = parseInt(req.body.anon);
        
        models.Chatroom.findById(chatId).then(function (chatroom) {
            if (chatroom.founder == req.user.username || req.user.username == "Secretbryan") {
                chatroom.updateAttributes({
                    description: desc,
                    details: details,
                    karmaReq: karmareq,
                    type: type,
                    filter: filterStr,
                    anon: anon,
                    chatInterval: interval
                }).then(function () {
                    res.render('edit', {
                        title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                        loggedInAs: req.user.username,
                        room: chatroom,
                        modList: chatroom.getModArray(),
                        message: 'Room Updated'
                    });
                });
            }
        });
    });
    
    // process the edit form
    app.post('/edit/:id/addmod', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatId = req.params.id;
        var newMod = req.body.mod;
        
        console.log(newMod);

        models.Chatroom.findById(chatId).then(function (chatroom) {
            if (chatroom == null) return;
            
            if (chatroom.founder == req.user.username || req.user.username == "Secretbryan") {
                models.User.find({ where: { username: newMod } }).then(function (user) {
                    if (user != null) {
                        if (chatroom.addMod(newMod) == true) {
                            chatroom.save();
                            res.render('edit', {
                                title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                                loggedInAs: req.user.username,
                                room: chatroom,
                                modList: chatroom.getModArray(),
                                message: 'Mod added.'
                            });
                        } else {
                            res.render('edit', {
                                title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                                loggedInAs: req.user.username,
                                room: chatroom,
                                modList: chatroom.getModArray(),
                                message: newMod + ' is already a mod.'
                            });
                        }
                    } else {
                        res.render('edit', {
                            title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                            loggedInAs: req.user.username,
                            room: chatroom,
                            modList: chatroom.getModArray(),
                            message: 'Invalid Username. Mod not added.'
                        });
                    }
                });
            }
        });
    });
    
    // process the edit form
    app.post('/edit/:id/removemod/:name', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatId = req.params.id;
        var removeMod = req.params.name;
        
        models.Chatroom.findById(chatId).then(function (chatroom) {
            if (chatroom == null) return;
            
            if (chatroom.founder == req.user.username || req.user.username == "Secretbryan") {
                models.User.find({ where: { username: removeMod } }).then(function (user) {
                    if (user != null) {
                        if (chatroom.removeMod(removeMod) == true) {
                            res.render('edit', {
                                title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                                loggedInAs: req.user.username,
                                room: chatroom,
                                modList: chatroom.getModArray(),
                                message: 'Mod removed.'
                            });
                        } else {
                            res.render('edit', {
                                title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                                loggedInAs: req.user.username,
                                room: chatroom,
                                modList: chatroom.getModArray(),
                                message: removeMod + ' is not a mod.'
                            });
                        }
                    } else {
                        res.render('edit', {
                            title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                            loggedInAs: req.user.username,
                            room: chatroom,
                            modList: chatroom.getModArray(),
                            message: 'Invalid Username. Mod not removed.'
                        });
                    }
                });
            }
        });
    });

    // process the edit form
    app.post('/edit/:id/passownership', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatId = req.params.id;
        var newOwner = req.body.newowner;
        
        models.Chatroom.findById(chatId).then(function (chatroom) {
            if (chatroom == null) return;
            
            if (chatroom.founder == req.user.username || req.user.username == "Secretbryan") {
                models.User.find({ where: { username: newOwner } }).then(function (user) {
                    if (user != null) {
                        chatroom.updateAttributes({
                            founder: newOwner
                        }).then(function () {
                            res.redirect('/myrooms');
                        });
                    } else {
                        res.render('edit', {
                            title: 'Edit - ' + chatroom.name + 'ChitterChat: online chat room communities',
                            loggedInAs: req.user.username,
                            room: chatroom,
                            modList: chatroom.getModArray(),
                            message: 'Invalid Username. Ownership not passed.'
                        });
                    }
                });
            }
        });
    });

    // process the edit form
    app.post('/edit/:id/delete', function (req, res) {
        if (req.user == null) {
            res.redirect('/login');
            return;
        }
        
        var chatId = req.params.id;
        
        async.series([
            function (callback){
                models.Chatroom.findById(chatId).then(function (chatroom) {
                    if (chatroom == null) return;
                    
                    if (chatroom.founder == req.user.username || req.user.username == "Secretbryan") {
                        console.log("Chatroom "+ chatroom.name + " destroyed");
                        chatroom.destroy().then(function () {
                            callback(null);
                        });
                    }
                });
            },
            function (callback) {
                models.Comment.destroy({where: {ChatroomId: chatId}}).then(function () {
                    console.log("Comments destroyed");
                    callback(null);
                });
            }
        ], function (err, result) {
            res.redirect('/myrooms');
        });
     
    });
}