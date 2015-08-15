"use strict";

module.exports = function (sequelize, DataTypes) {
    var Comment = sequelize.define("Comment",{
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true // Automatically gets converted to SERIAL for postgres
        },
        ReplyId: DataTypes.INTEGER,
        UserId: DataTypes.INTEGER,
        ChatroomId: DataTypes.INTEGER,
        message: DataTypes.TEXT,
        likes: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        dislikes: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        }
    }, {
        classMethods: {
            associate: function (models) {
                Comment.belongsTo(models.User);
                Comment.hasOne(models.Comment, { foreignKey: 'ReplyId'});
            }
        },
        instanceMethods: {
            like: function () {
                this.increment("likes");

                sequelize.model('User').find({ where: { id : this.UserId } }).then(function (user) {           
                    user.increment("karma");
                });

                this.save();
            },
            dislike: function () {
                this.increment("dislikes");
                
                sequelize.model('User').find({ where: { id : this.UserId } }).then(function (user) {           
                    user.decrement("karma");
                });

                this.save();
            },
            unlike: function (){
                this.decrement("likes");
                
                sequelize.model('User').find({ where: { id : this.UserId } }).then(function (user) {           
                    user.decrement("karma");
                });

                this.save();
            },
            undislike: function (){
                this.decrement("dislikes");
                
                sequelize.model('User').find({ where: { id : this.UserId } }).then(function (user) {           
                    user.increment("karma");
                });

                this.save();
            }
        }
    });
    
    return Comment;
};