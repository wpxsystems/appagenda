module.exports = (sequelize, DataTypes) => {
  const SportProfile = sequelize.define('SportProfile', {
    id:              { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id:         { type: DataTypes.UUID, allowNull: false },
    sport:           { type: DataTypes.ENUM('padel', 'beach_tennis', 'tennis'), allowNull: false },
    is_active:       { type: DataTypes.BOOLEAN, defaultValue: true },
    category:        { type: DataTypes.ENUM('C', 'B', 'A', 'Open') },
    side_preference: { type: DataTypes.ENUM('left', 'right', 'both') },
    skill_level:     { type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'competitive') },
    play_format:     { type: DataTypes.ENUM('singles', 'doubles', 'both') },
  }, { tableName: 'app_sport_profile', paranoid: true, timestamps: true, underscored: true });

  SportProfile.associate = (m) => {
    SportProfile.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
  };

  return SportProfile;
};
