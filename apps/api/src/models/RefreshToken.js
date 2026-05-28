module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('RefreshToken', {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id:    { type: DataTypes.UUID, allowNull: false },
    token_hash: { type: DataTypes.STRING(128), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
  }, { tableName: 'app_refresh_token', paranoid: true, timestamps: true, underscored: true });

  RefreshToken.associate = (m) => {
    RefreshToken.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
  };

  return RefreshToken;
};
