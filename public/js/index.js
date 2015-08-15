var socket = io();
var MAX_MSG_LENGTH = 1000;
var likesArray;
var dislikesArray;
var filterType = 0;
var lastPostTime = null;
var loggedIn = true;

$(document).ready(function () {
    if (following === "true") {
        $("#follow-btn").hide();
        $("#unfollow-btn").show();
    } else {
        $("#unfollow-btn").hide();
        $("#follow-btn").show();
    }
    
    $('[data-toggle="tooltip"]').tooltip();

    if (name == "") {
        loggedIn = false;
        name = "Anonymous";
        console.log(name);
    }

    if (interval == null || interval < 5) {
        interval = 5;
    }

    if (likeListJ != null) {
        likeListJ = JSON.parse(likeListJ);
        likesArray = Object.keys(likeListJ).map(function (k) { return parseInt(likeListJ[k]) });
    }
    if (dislikeListJ != null) {
        dislikeListJ = JSON.parse(dislikeListJ);
        dislikesArray = Object.keys(dislikeListJ).map(function (k) { return parseInt(dislikeListJ[k]) });
    }
});

$(document).on('click', '.fa-reply', function () {
    var replyId = $(this).parent().data("commentid");
    
    if (replyId == null) {
        replyId = $(this).parent().parent().data("commentid")
    }
    $('#message-box').val('@' + replyId + " ");
});

$(document).on('click', '.badrep', function () {
    var showing = ($(this).children(".showing").length ? true : false);

    if (showing) {
        $(this).children(".showing").removeClass("showing");
    } else {
        $(this).children("p").addClass("showing");
    }
});

$(document).on('click', '.fa-caret-square-o-down', function () {
    if ($(this).parent().is("p")) {
        $(this).parent().parent().children("p1").hide();
        $(this).removeClass("fa-caret-square-o-down").addClass("fa-caret-square-o-up");
    }
});

$(document).on('click', '.fa-caret-square-o-up', function () {
    if ($(this).parent().is("p")) {
        $(this).parent().parent().children("p1").show();
        $(this).removeClass("fa-caret-square-o-up").addClass("fa-caret-square-o-down");
    }
});

//like
$(document).on('click', '.fa-arrow-up', function () {
    var commentId = $(this).parent().parent().data("commentid");
    
    //check if comment is already disliked
    if (dislikesArray.indexOf(commentId) > -1) {
        //remove it
        dislikesArray.splice(dislikesArray.indexOf(commentId), 1);
        
        //update Color
        $(this).siblings(".fa-arrow-down").css("color","#A4A4A4");
    }
    
    if (likeListJ == null) {
        //console.log("like list empty, adding first like");
        
        likesArray.push(commentId);
        
        $(this).css("color", "#000");
    } else {    
        if (likesArray.indexOf(commentId) == -1) {   //Not liked yet

            likesArray.push(commentId);  //Add new comment to likes
            
            $(this).css("color", "#000");
        } else {    //Already like so unlike it
            likesArray.splice(likesArray.indexOf(commentId), 1);
            
            $(this).css("color", "#A4A4A4");
        }
    }

    socket.emit('likeToServer', commentId);
    setTimeout(function () {
        socket.emit('requestUpdatedComment', commentId);
    }, 50);
});

//dislike
$(document).on('click', '.fa-arrow-down', function () {
    var commentId = $(this).parent().parent().data("commentid");

    //check if comment is already liked
    if (likesArray.indexOf(commentId) > -1) {
        //remove it
        likesArray.splice(likesArray.indexOf(commentId), 1);
        
        //update Color
        $(this).siblings(".fa-arrow-up").css("color", "#A4A4A4");
    }
    
    if (dislikeListJ == null) {
        //console.log("like list empty, adding first like");
        
        dislikesArray.push(commentId);
        $(this).css("color", "#000");
    } else {
        if (dislikesArray.indexOf(commentId) == -1) {   //Not disliked yet
            
            dislikesArray.push(commentId);  //Add new comment to dislikes
            $(this).css("color", "#000");
        } else {    //Already like so undislike it
            dislikesArray.splice(dislikesArray.indexOf(commentId), 1);
            $(this).css("color", "#A4A4A4");
        }
    }

    socket.emit('dislikeToServer', commentId);
    setTimeout(function () {
        socket.emit('requestUpdatedComment', commentId);
    }, 50);
});

$("#message-box").keyup(function (event) {
    if (event.keyCode == 13) {
        $("#send-message-btn").click();
    }
});

$("#realtime").click(function () {
    $("#messages").empty();
    filterType = 0;
    $("#filters").children().removeClass("active");
    $(this).addClass("active");
    socket.emit('chatRequest', 0, chatId);
});

$("#hot").click(function () {
    $("#messages").empty();
    filterType = 1;
    $("#filters").children().removeClass("active");
    $(this).addClass("active");
    socket.emit('chatRequest', 1, chatId);
});

$("#top").click(function () {
    $("#messages").empty();
    filterType = 2;
    $("#filters").children().removeClass("active");
    $(this).addClass("active");
    socket.emit('chatRequest', 2, chatId);
});

$("#liked").click(function () {
    $("#messages").empty();
    filterType = 3;
    $("#filters").children().removeClass("active");
    $(this).addClass("active");
    socket.emit('chatRequest', 3, chatId);
});

$("#mine").click(function () {
    $("#messages").empty();
    filterType = 4;
    $("#filters").children().removeClass("active");
    $(this).addClass("active");
    socket.emit('chatRequest', 4, chatId);
});

$("#unfollow-btn").click(function () {
    var followcount = parseInt($("#followcount").html());
    followcount--;

    socket.emit("unfollowChat", chatId);
    $("#unfollow-btn").hide();
    $("#follow-btn").show();
    $("#followcount").html(followcount);
});

$("#follow-btn").click(function () {
    var followcount = parseInt($("#followcount").html());
    followcount++;

    socket.emit("followChat", chatId);
    $("#follow-btn").hide();
    $("#unfollow-btn").show();
    $("#followcount").html(followcount);
});

$('#send-message-btn').click(function () {
    var msg = $('#message-box').val();
    
    $("#errors").empty();

    if (validUsername(name) && validMessage(msg)) {
        processChat(msg);
        $('#message-box').val('');
    }
});

socket.on('connect', function () {
    $("#messages").empty();

    socket.emit('adduser', name, chatId);
});

socket.on('updateUsersConnected', function (amount) {
    $('#connected').html("<b>Connected Users:</b> "+amount);
});

socket.on('receiveUpdatedComment', function (commentId, likes, dislikes) {
    //TODO change only the values not the entire html.
    $('#messages div[data-commentId=' + commentId + '] p .fa-arrow-up span').html(likes);
    $('#messages div[data-commentId=' + commentId + '] p .fa-arrow-down span').html(dislikes);
    //console.log("receiveUpdatedComment" + commentId + " " + likes + " " + dislikes);
});

socket.on('commentDelete', function (commId) {
    $('div[data-commentId=' + commId + '])').remove();
    $('p1[data-commentId=' + commId + '])').remove();
});

socket.on('chatToClient', function (data) {
    var commentId = data[0];// data[0] = id
    var replyId = data[1];// data[1] = ReplyId
    var username = data[2];// data[2] = username
    var msg = data[3];// data[3] = message
    var likes = data[4];// data[4] = likes
    var dislikes = data[5];// data[5] = dislikes
    var createdAt = data[6];// data[6] = createdAt
    var badgeUrl = data[7];// data[7] = Badge Url
    
    msg = escapeHtml(msg);
    msg = urlify(msg);
    msg = emoteify(msg);

    //Handle Anon chat
    if (commentId == "-1" || username == "Anonymous") {
        var chatHtml = "<b>" + username + ":</b> " + msg;
        if (replyId == null) {
            $('#messages').append($('<p>').html(chatHtml));
        } else {
            if ($('div[data-commentid=' + replyId + ']').length > 0) {
                $('div[data-commentid=' + replyId + ']').append($('<p1>').html(chatHtml));
            } else {
                $('p1[data-commentid=' + replyId + ']').parent().append($('<p1>').html(chatHtml));
            }
        }
        
        if (filterType == 0)
            $('#messages').animate({ scrollTop: $('#messages').height() }, 0);
        return;
    }

    //console.log("Chat Recieved: " + data);
    createdAt = formatDate(createdAt);
    var date = createdAt.substring(0, createdAt.indexOf("T"));
    date = date.substring(0, date.length - 5);
    var time = createdAt.substring(createdAt.indexOf("T") + 1, createdAt.length);
    time = time.substring(0, time.length - 8);
    
    date = time + " | " + date;
    
    console.log(date);
    console.log(time);
    if (likes == null) likes = 0;
    if (dislikes == null) dislikes = 0;
    
    var likeColor = "#A4A4A4";
    var dislikeColor = "#A4A4A4";
    
    if (likesArray != null && likesArray.indexOf(commentId) > -1) {
        likeColor = "#000";
    }
    
    if (dislikesArray != null && dislikesArray.indexOf(commentId) > -1) {
        dislikeColor = "#000";
    }

    var chatHtml = "<span class='date'>" + date + "</span><i class='fa fa-reply'></i><i class='fa fa-arrow-up' style='color:"+likeColor+"'><span>"+likes+"</span></i><i class='fa fa-arrow-down' style='color:" + dislikeColor + "'><span>"+dislikes+"</span></i><i class='fa fa-caret-square-o-down'></i><span class='customBadge'></span><a href='/u/" + username + "'><b>" + username + ":</b></a> " + msg;
    var replyHtml = "<span class='date'>" + date + "</span><i class='fa fa-reply'></i><span class='customBadge'></span><a href='/u/"+ username +"'><b>" + username + ":</b></a> " + msg;

    //if (name.length == 0) {
    //    chatHtml = "<span class='date'>" + date + "</span><i class='fa fa-caret-square-o-down'></i><span class='customBadge'></span><a href='/u/" + username + "'><b>" + username + ":</b></a> " + msg;
    //    replyHtml = "<span class='date'>" + date + "</span><span class='customBadge'></span><a href='/u/" + username + "'><b>" + username + ":</b> </a> " + msg;
    //}

    if (replyId == null) {
        if (dislikes > 10) {
            $('#messages').append("<div class='badrep' data-commentId=" + commentId + ">");
        } else {
            $('#messages').append("<div data-commentId=" + commentId + ">");
        }

        $('#messages div[data-commentId=' + commentId + ']').append($('<p>').html(chatHtml));
        $('div[data-commentId=' + commentId + '] .customBadge').css("background-image", "url('" + badgeUrl + "')");
    } else {
        if ($('div[data-commentid=' + replyId + ']').length > 0) {
            //console.log("First Reply" + $('div[data-commentid=' + replyId + ']'));
            $('div[data-commentid=' + replyId + ']').append($('<p1 data-commentId=' + commentId + '>').html(replyHtml));
            $('p1[data-commentId=' + commentId + '] .customBadge').css("background-image", "url('" + badgeUrl + "')");
        } else {
            //console.log("Reply to Reply");
            $('p1[data-commentid=' + replyId + ']').parent().append($('<p1 data-commentId=' + commentId + '>').html(replyHtml));
            $('p1[data-commentId=' + commentId + '] .customBadge').css("background-image", "url('" + badgeUrl + "')");
        }
    }

    if(filterType == 0)
        $('#messages').animate({ scrollTop: $('#messages').height() }, 0);
});

function validUsername(name) {
    var valid = false;

    if (name != null && name != "") {
        valid = true;
        $("#errors").empty();
    }

    if (valid == false) {
        $("#errors").append($('<p>').html("Not a valid username."));
    }

    return valid;
}

function validMessage(message){
    var valid = false;
    var errmsg = "";

    if (message == null || message == "") {
        errmsg = "Message too short.";
        valid = false;
    } else if(message.length > MAX_MSG_LENGTH ) {
        errmsg = "Message too long. ("+ MAX_MSG_LENGTH +" Char Max)";
        valid = false;
    } else {
        valid = true;
    }

    if (valid == false) {
        $("#errors").empty();
        $("#errors").append($('<p>').html(errmsg));
    }

    return valid;
}

function processChat(message){
    message = message.trim();
    var firstChar = message.charAt(0);
    
    if (lastPostTime != null) {
        var now = new Date();
        var dif = lastPostTime.getTime() - now.getTime();
        var Seconds_from_T1_to_T2 = dif / 1000;
        var Seconds_Between_Dates = Math.abs(Seconds_from_T1_to_T2);
    
        if (Seconds_Between_Dates <= interval) {
            errmsg = "You are posting too often (Only 1 post per " + interval + " seconds)";
            $("#errors").empty();
            $("#errors").append($('<p>').html(errmsg))
            return;
        } else {
            $("#errors").empty();
            lastPostTime = new Date();
        }
    } else {
        lastPostTime = new Date();
    }
    
    if (firstChar == "@") {
        processReply(message);
    } else if (firstChar == "/"){
        processCommand(message);
    } else {
        socket.emit('chatToServer', null, chatId, message);
    }
}

function processCommand(command){

}

function processReply(message){
    var reply_id = parseInt(message.substring(1, message.indexOf(" ")));
    message = message.substring(message.indexOf(" ") + 1, message.length);
    
    socket.emit('chatToServer', reply_id, chatId, message);
    //console.log("CommentID: "+ reply_id+ " Message: " + message);
}

function urlify(text) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function (url) {
        if (checkForImg(text)) {
            return '<a href="' + url + '" target="_blank"><img src="' + url + '" style="width: 200px;"></a>';
        } else {
            return '<a href="' + url + '" target="_blank">' + url + '</a>';
        }
    });
}

function checkForImg(url) {
    return (url.match(/\.(jpeg|jpg|gif|png)$/) != null);
}

var formatDate = function (dateString) {
    // Convert 'yyyy-mm-dd hh:mm:ss' to 'mm/dd/yyyy hh:mm:ss'
    return dateString.replace(/^(\d{4})-(\d{2})-(\d{2})/, '$2/$3/$1');
};

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;',
    "'": '&#39;'
    //"/": '&#x2F;'
};

function escapeHtml(string) {
    return String(string).replace(/[&<>"']/g, function (s) {
        return entityMap[s];
    });
}

var emoteMap = {
    ":)": "/img/emotes/smile.png",
    ":D": "/img/emotes/happy.png",
    ":(": "/img/emotes/sad.png",
    ";(": "/img/emotes/cry.png",
    ":X": "/img/emotes/oops.png",
    ":x": "/img/emotes/oops.png",
    ":P": "/img/emotes/silly.png",
    ":p": "/img/emotes/silly.png",
    "B)": "/img/emotes/cool.png",
    "B|": "/img/emotes/thug.png",
    ":*": "/img/emotes/kiss.png",
    ">:)": "/img/emotes/evilgrin.png",
    ">:(": "/img/emotes/evilfrown.png",
    "xD": "/img/emotes/xD.png",
    "XD": "/img/emotes/xD.png",
    "nomnom": "/img/emotes/nomnom.png",
    "rawr": "/img/emotes/rawr.png",
    "<3": "/img/emotes/heart.png"
};

function emoteify(string){
    return String(string).replace(/:[)D(xXpP]|;[(]|B[)|]|[xX]D|nomnom|rawr/g, function (s) {
        if (string.charAt(string.indexOf(s) - 1) == " " || string.indexOf(s) == 0) {
            if (string.charAt(string.indexOf(s) + s.length) == " " || string.indexOf(s) == string.length - s.length) {
                return "<span class='emote' data-toggle='tooltip' title='" + s + "'><img src='" + emoteMap[s] + "'></span>";
            }
            else {
                return s;
            }
        } else {
                return s;
            }
    });

    return string;
}