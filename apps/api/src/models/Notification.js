module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    type:    { type: DataTypes.STRING(60), allowNull: false },
    title:   { type: DataTypes.STRING(255), allowNull: false },
    body:    { type: DataTypes.TEXT, allowNull: false },
    jogo_id: { type: DataTypes.UUID },
    read:    { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'app_notification', paranoid: true, timestamps: true, underscored: true });

  Notification.associate = (m) => {
    Notification.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
    Notification.belongsTo(m.Jogo, { foreignKey: 'jogo_id', as: 'jogo' });
  };

  return Notification;
};
