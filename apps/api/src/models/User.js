module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id:                    { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nome:                  { type: DataTypes.STRING(120), allowNull: false },
    nickname:              { type: DataTypes.STRING(60) },
    email:                 { type: DataTypes.STRING(255), allowNull: false, unique: true },
    password_hash:         { type: DataTypes.STRING(72) },
    google_id:             { type: DataTypes.STRING(100) },
    phone:                 { type: DataTypes.STRING(20) },
    data_nascimento:       { type: DataTypes.DATEONLY },
    avatar_url:            { type: DataTypes.STRING(500) },
    bio:                   { type: DataTypes.TEXT },
    cidade_id:             { type: DataTypes.UUID },
    genero:                { type: DataTypes.ENUM('male', 'female', 'other') },
    role:                  { type: DataTypes.ENUM('player', 'professor', 'venue_admin', 'admin', 'superadmin'), defaultValue: 'player' },
    status:                { type: DataTypes.ENUM('active', 'suspended', 'banned'), defaultValue: 'active' },
    push_token:            { type: DataTypes.STRING(255) },
    notifications_enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
    availability_json:     { type: DataTypes.TEXT },
  }, { tableName: 'app_user', paranoid: true, timestamps: true, underscored: true });

  User.associate = (m) => {
    User.belongsTo(m.Cidade,              { foreignKey: 'cidade_id', as: 'cidade' });
    User.hasMany(m.RefreshToken,          { foreignKey: 'user_id', as: 'refreshTokens' });
    User.hasMany(m.SportProfile,          { foreignKey: 'user_id', as: 'sportProfiles' });
    User.hasMany(m.Participacao,          { foreignKey: 'user_id', as: 'participacoes' });
    User.hasMany(m.Notification,          { foreignKey: 'user_id', as: 'notifications' });
    User.hasMany(m.PushLog,               { foreignKey: 'user_id', as: 'pushLogs' });
    User.hasMany(m.CommunityGroup,        { foreignKey: 'created_by', as: 'createdGroups' });
    User.hasMany(m.CommunityGroupMember,  { foreignKey: 'user_id', as: 'groupMemberships' });
    User.hasOne(m.UserLocation,           { foreignKey: 'user_id', as: 'location' });
  };

  User.prototype.toJSON = function () {
    const { password_hash, ...rest } = this.get();
    return rest;
  };

  return User;
};
