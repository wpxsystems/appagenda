module.exports = (sequelize, DataTypes) => {
  const UserLocation = sequelize.define('UserLocation', {
    id:               { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id:          { type: DataTypes.UUID, allowNull: false, unique: true },
    cidade_id:        { type: DataTypes.UUID, allowNull: false },
    search_radius_km: { type: DataTypes.INTEGER, defaultValue: 15 },
  }, { tableName: 'app_user_location', paranoid: true, timestamps: true, underscored: true });

  UserLocation.associate = (m) => {
    UserLocation.belongsTo(m.User,   { foreignKey: 'user_id', as: 'user' });
    UserLocation.belongsTo(m.Cidade, { foreignKey: 'cidade_id', as: 'cidade' });
  };

  return UserLocation;
};
