module.exports = (sequelize, DataTypes) => {
  const PushLog = sequelize.define('PushLog', {
    id:      { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID, allowNull: false },
    type:    { type: DataTypes.STRING(60), allowNull: false },
    payload: { type: DataTypes.TEXT },
    sent_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    error:   { type: DataTypes.TEXT },
  }, { tableName: 'app_push_notification_log', paranoid: true, timestamps: true, underscored: true });

  PushLog.associate = (m) => {
    PushLog.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
  };

  return PushLog;
};
