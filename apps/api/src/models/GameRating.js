module.exports = (sequelize, DataTypes) => {
  const GameRating = sequelize.define('GameRating', {
    id:            { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    jogo_id:       { type: DataTypes.UUID, allowNull: false },
    rater_id:      { type: DataTypes.UUID, allowNull: false },
    rated_user_id: { type: DataTypes.UUID, allowNull: false },
    score:         { type: DataTypes.SMALLINT, allowNull: false },
    badges:        { type: DataTypes.JSONB, defaultValue: [] },
  }, { tableName: 'app_game_rating', timestamps: true, underscored: true, paranoid: false });

  GameRating.associate = (m) => {
    GameRating.belongsTo(m.Jogo, { foreignKey: 'jogo_id', as: 'jogo' });
    GameRating.belongsTo(m.User, { foreignKey: 'rater_id',      as: 'rater' });
    GameRating.belongsTo(m.User, { foreignKey: 'rated_user_id', as: 'ratedUser' });
  };

  return GameRating;
};
