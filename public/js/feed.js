var loaded = 10;
var likesArray = [];
var dislikesArray = [];

$(document).ready(function () {

    if (likeListJ != null) {
        likeListJ = JSON.parse(likeListJ);
        likesArray = Object.keys(likeListJ).map(function (k) { return parseInt(likeListJ[k]) });
    }
    if (dislikeListJ != null) {
        dislikeListJ = JSON.parse(dislikeListJ);
        dislikesArray = Object.keys(dislikeListJ).map(function (k) { return parseInt(dislikeListJ[k]) });
    }

    checkLikes();
    checkDislikes();
});

$("#loadmore").click(function () {
    $.get('/fetchTrendy/' + loaded, loaded, function (data) {
        var comms = data[0][0];
        var commNames = data[0][1];
        var commRooms = data[0][2];
        var commHtml;
        var moreToLoad = (data[0][1].length == 10 ? true : false);

        for (var i = 0; i < comms.length; i++) {
            commHtml = "<li data-commentid='"+comms[i].id+"'><a href='/u/" + commNames[i] + "'>" + commNames[i] + ": </a><a class='room' href='/c/" + commRooms[i] +"'>/c/"+commRooms[i]+"</a><p3>" + urlify(escapeHtml(comms[i].message)) + "</p3><i class='fa fa-arrow-up' style='color:#A4A4A4;'><span style='color:green'>" + comms[i].likes + "</span></i><i class='fa fa-arrow-down' style='color:#A4A4A4;'><span style='color:red'>" + comms[i].dislikes + "</span></i></li>";
            
            $("#trendy ul").append(commHtml);
        }
        
        checkLikes();
        checkDislikes();
        
        if (moreToLoad == false) {
            $("#loadmore").hide();
        } else {
            loaded = loaded + 10;
        }
    });
})

$(document).on('click', '.fa-arrow-up', function () {
    var commentId = parseInt($(this).parent().data("commentid"));

    if (loggedIn == "true") {
        $.get('/like/' + commentId, function (data) {
            if (likesArray.indexOf(commentId) > -1) {   //ALREADY LIKE
                likesArray.splice(likesArray.indexOf(commentId), 1);
                $("li[data-commentid='" + commentId + "'] .fa-arrow-up").css('color', '#A4A4A4');
                $("li[data-commentid='" + commentId + "'] .fa-arrow-up span").html(parseInt($("li[data-commentid='" + commentId + "'] .fa-arrow-up span").html())-1);
            } else {    //LIKE
                likesArray.push(commentId);
                $("li[data-commentid='" + commentId + "'] .fa-arrow-up").css('color', '#000');
                $("li[data-commentid='" + commentId + "'] .fa-arrow-up span").html(parseInt($("li[data-commentid='" + commentId + "'] .fa-arrow-up span").html())+1);
            }

            if (dislikesArray.indexOf(commentId) > -1) {   //ALREADY DISLIKE
                dislikesArray.splice(dislikesArray.indexOf(commentId), 1);
                $("li[data-commentid='" + commentId + "'] .fa-arrow-down").css('color', '#A4A4A4');
                $("li[data-commentid='" + commentId + "'] .fa-arrow-down span").html(parseInt($("li[data-commentid='" + commentId + "'] .fa-arrow-down span").html()) - 1);
            }
        });
    }

});

$(document).on('click', '.fa-arrow-down', function () {
    var commentId = parseInt($(this).parent().data("commentid"));

    if (loggedIn == "true") {
        $.get('/dislike/' + commentId, function (data) {
            if (dislikesArray.indexOf(commentId) > -1) {   //ALREADY DISLIKE
                dislikesArray.splice(dislikesArray.indexOf(commentId), 1);
                $("li[data-commentid='" + commentId + "'] .fa-arrow-down").css('color', '#A4A4A4');
                $("li[data-commentid='" + commentId + "'] .fa-arrow-down span").html(parseInt($("li[data-commentid='" + commentId + "'] .fa-arrow-down span").html()) - 1);
            } else {    //DISLIKE
                dislikesArray.push(commentId);
                $("li[data-commentid='" + commentId + "'] .fa-arrow-down").css('color', '#000');
                $("li[data-commentid='" + commentId + "'] .fa-arrow-down span").html(parseInt($("li[data-commentid='" + commentId + "'] .fa-arrow-down span").html()) + 1);
            }

            if (likesArray.indexOf(commentId) > -1) {   //ALREADY LIKE
                likesArray.splice(likesArray.indexOf(commentId), 1);
                $("li[data-commentid='" + commentId + "'] .fa-arrow-up").css('color', '#A4A4A4');
                $("li[data-commentid='" + commentId + "'] .fa-arrow-up span").html(parseInt($("li[data-commentid='" + commentId + "'] .fa-arrow-up span").html()) - 1);
            }
        });
    }

});

function checkLikes(){
    for (var i = 0; i < likesArray.length; i++) {
        if ($("li[data-commentid='" + likesArray[i] + "']").length > 0) {
            $("li[data-commentid='" + likesArray[i] + "'] .fa-arrow-up").css('color','#000')
        }
    }
}

function checkDislikes() {
    for (var i = 0; i < dislikesArray.length; i++) {
        if ($("li[data-commentid='" + dislikesArray[i] + "']").length > 0) {
            $("li[data-commentid='" + dislikesArray[i] + "'] .fa-arrow-up").css('color', '#000')
        }
    }
}

function urlify(text) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function (url) {
        return '<a href="' + url + '" target="_blank">' + url + '</a>';
    });
}

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