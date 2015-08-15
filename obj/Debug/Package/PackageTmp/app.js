
/**
 * Module dependencies.
 */

var express = require('express');
var routes = require('./routes');
var user = require('./routes/user');
var http = require('http');
var path = require('path');
var mysql = require('mysql');
var connection = mysql.createConnection({
    host     : '71.225.0.120',
    user     : 'admin',
    password : '22penn27',
    database : 'chatroom'
});

connection.connect(function (err) {
    if (!err) {
        console.log("Database is connected ... \n\n");
    } else {
        console.log("Error connecting database ... \n\n");
    }
});

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(app.router);
//app.use(require('stylus').middleware(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

app.get('/', routes.index);
app.get('/users', user.list);

var serve = http.createServer(app);
var io = require('socket.io')(serve);

var usersConnected = 0;
var comments = new Array();
var comment = function (commentId, timeStamp, username, message, replyId){

}

serve.listen(app.get('port'), function () {
    console.log('Express server listening on port ' + app.get('port'));
});

io.on('connection', function (socket) {
    usersConnected++;
    console.log('a user connected ' + usersConnected);
    
    //Send to All clients that someone has joined
    io.sockets.emit('newuser', usersConnected);

    //onDisconnect
    socket.on('disconnect', function () {
        console.log('user disconnected ' + usersConnected);
        usersConnected--;
        io.sockets.emit('newuser', usersConnected);
    });

    //Load 10 previous Messages
    connection.query("SELECT `comment_id`, `reply_id`, `username` , `message`  FROM `comments` ORDER BY `comment_id` DESC LIMIT 20", function (err, results) {
        var commentId = "";
        var username = "";
        var message = "";
        var replyId = "";

        if (!err) {
            for (var i = results.length - 1; i >= 0; i--) {
                commentId = results[i]["comment_id"];
                replyId = results[i]["reply_id"];
                username = results[i]["username"];
                message = results[i]["message"];
                console.log("Broadcasting: " + commentId + " " + replyId + " " + username + " " + message);
                socket.emit('chatToClient', commentId, replyId, username, message);
            }
        } else {
            console.log('Error while performing Query.');
        }
    });

    //Handle Incoming Chat
    socket.on('chatToServer', function (replyId, username, msg) {
         
        //Add Chat to database
        connection.query("INSERT INTO comments (reply_id, username, message) VALUES('"+ replyId +"','" + username + "', '" + msg + "')", function (err, result) {
            //Broadcast To the Rest of the Clients
            console.log("Broadcasting: "+ result.insertId + " " + replyId + " " + username + " " + msg);
            io.sockets.emit('chatToClient', result.insertId, replyId, username, msg);
            if (err)
                console.log('Error while performing Query.');
        });
    });
}); 