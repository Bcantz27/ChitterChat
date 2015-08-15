
module.exports = function (sequelize, DataTypes) {
    var Badge = sequelize.define("Badge", {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name: DataTypes.STRING,
            imageUrl: DataTypes.TEXT
        }, {

    });

    return Badge;
};


//sequelize.query("SELECT * FROM badges").then(function (badges) {
//    if (!init) {
//        for (var i = 0; i < badges[0].length; i++) {
//            badgeList.push({ id: badges[0][i].id, name: badges[0][i].name, imageUrl: badges[0][i].imageUrl });
//        }
//    }
//});