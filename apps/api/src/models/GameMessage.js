module.exports = (sequelize, DataTypes) => {
  const GameMessage = sequelize.define('GameMessage', {
    id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    jogo_id: { type: DataTypes.UUID, allowNull: false },
    user_id: { type: DataTypes.UUID, allowNull: false },
    content: { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: 'app_game_message', paranoid: true, timestamps: true, underscored: true });

  GameMessage.associate = (m) => {
    GameMessage.belongsTo(m.Jogo, { foreignKey: 'jogo_id', as: 'jogo' });
    GameMessage.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
  };

  return GameMessage;
};
