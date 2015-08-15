var socket = io();
var username = "";
var MAX_MSG_LENGTH = 140;


$(document).on('click', '.fa-reply', function () {
    $('#message-box').val('@' + $(this).parent().data("commentid")+ " ");
});

$('#send-message-btn').click(function () {
    var msg = $('#message-box').val();
    
    $("#errors").empty();

    if (validUsername(username) && validMessage(msg)) {
        processChat(msg);
        $('#message-box').val('');
    }
});

$("#choose-name-btn").click(function () {
    username = $("#name-box").val();

    $("#errors").empty();

    if (validUsername(username)) {
        $("#name-box").hide();
        $("#choose-name-btn").hide();
    }
});

socket.on('newuser', function (amount) {
    $('#connected').html("<b>Connected Users:</b> "+amount);
});

socket.on('chatToClient', function (commentId, replyId, username, msg) {
    console.log("Chat Recieved: " + commentId + " " + replyId + " " + username + " " + msg);

    if (replyId == null) {
        $('#messages').append("<div data-commentId=" + commentId + ">");
        $('#messages div[data-commentId='+ commentId+']').append($('<p>').html("<i class='fa fa-reply'></i><i class='fa fa-arrow-up'></i><i class='fa fa-arrow-down'></i><b>" + username + ":</b> " + msg));
    } else {
        if ($('div[data-commentid=' + replyId + ']').length > 0) {
            console.log("First Reply" + $('div[data-commentid=' + replyId + ']'));
            $('div[data-commentid=' + replyId + ']').append($('<p1 data-commentId=' + commentId + '>').html("<i class='fa fa-reply'></i><i class='fa fa-arrow-up'></i><i class='fa fa-arrow-down'></i><b>" + username + ":</b> " + msg));
        } else {
            console.log("Reply to Reply");
            $('p1[data-commentid=' + replyId + ']').parent().append($('<p1 data-commentId=' + commentId + '>').html("<i class='fa fa-reply'></i><i class='fa fa-arrow-up'></i><i class='fa fa-arrow-down'></i><b>" + username + ":</b> " + msg));
        }
    }
    $('#messages').animate({ scrollTop: $('#messages').height() }, "slow");
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
    
    if (firstChar == "@") {
        processReply(message);
    } else if (firstChar == "/"){
        processCommand(message);
    } else {
        socket.emit('chatToServer', null, username, message);
        //$('#messages').append($('<p data-commentId=' + commentId + '>').html("<i class='fa fa-reply'></i><i class='fa fa-arrow-up'></i><i class='fa fa-arrow-down'></i><b>" + username + ":</b> " + message));
        //$('#messages').animate({ scrollTop: $('#messages').height() }, "slow");
    }
}

function processCommand(command){

}

function processReply(message){
    var reply_id = parseInt(message.substring(1, message.indexOf(" ")));
    message = message.substring(message.indexOf(" ") + 1, message.length);
    
    socket.emit('chatToServer', reply_id, username, message);
    console.log("CommentID: "+ reply_id+ " Message: " + message);
}