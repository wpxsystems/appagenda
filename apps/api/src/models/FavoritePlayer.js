module.exports = (sequelize, DataTypes) => {
  const FavoritePlayer = sequelize.define('FavoritePlayer', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id:          { type: DataTypes.UUID, allowNull: false },
    favorite_user_id: { type: DataTypes.UUID, allowNull: false },
  }, { tableName: 'app_favorite_player', paranoid: true, timestamps: true, underscored: true });

  FavoritePlayer.associate = (m) => {
    FavoritePlayer.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
    FavoritePlayer.belongsTo(m.User, { foreignKey: 'favorite_user_id', as: 'favoriteUser' });
  };

  return FavoritePlayer;
};
