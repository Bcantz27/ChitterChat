"use strict";

module.exports = function (sequelize, DataTypes) {
    var Chatroom = sequelize.define("Chatroom", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: DataTypes.STRING,
        followers: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        usersConnected: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        chatInterval: {
            type: DataTypes.INTEGER,
            defaultValue: 5
        },
        description: DataTypes.TEXT,
        details: DataTypes.TEXT,
        founder: DataTypes.STRING,
        type: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        filter: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        anon: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        karmaReq: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        modList: {
            type: DataTypes.TEXT //JSON, but mysql will not accept JSON so we will stringify it
        }
    },{
        classMethods: {
            associate: function (models) {

            }
        },
        hooks: {
            beforeCreate : function (chatroom, options, next) {
                chatroom.modList = "[]";
                next(null, chatroom);
            }
        },
        instanceMethods: {
            userJoin: function (socket){

            },
            userLeave: function (socket) {

            },
            getModArray: function () {
                var jsonModList = [];
                var modArray = [];
                
                if (this.modList != null) {
                    jsonModList = JSON.parse(this.modList)
                    modArray = Object.keys(jsonModList).map(function (k) { return jsonModList[k] });  //JSON to array
                }
                
                return modArray;
            },
            addMod: function (newModName) {
                var modArray = this.getModArray();
                
                if (modArray.indexOf(newModName) == -1) {
                    modArray.push(newModName);
                    this.modList = JSON.stringify(modArray);
                    this.save();
                    return true;
                }
                return false;
            },
            removeMod: function (removeModName) {
                var modArray = this.getModArray();
                
                if (modArray.indexOf(removeModName) != -1) {
                    modArray.splice(modArray.indexOf(removeModName),1);
                    this.modList = JSON.stringify(modArray);
                    this.save();
                    return true;
                }
                return false;
            },
            isMod: function (name) {
                var modArray = this.getModArray();
                
                if (modArray.indexOf(name) != -1) {
                    return true;
                }
                return false;
            }
        },
    });
    
    return Chatroom;
};