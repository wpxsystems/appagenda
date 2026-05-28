module.exports = (sequelize, DataTypes) => {
  const CommunityGroup = sequelize.define('CommunityGroup', {
    id:         { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nome:       { type: DataTypes.STRING(120), allowNull: false },
    sport:      { type: DataTypes.ENUM('padel', 'beach_tennis', 'tennis') },
    created_by: { type: DataTypes.UUID, allowNull: false },
  }, { tableName: 'app_community_group', paranoid: true, timestamps: true, underscored: true });

  CommunityGroup.associate = (m) => {
    CommunityGroup.belongsTo(m.User,                { foreignKey: 'created_by', as: 'creator' });
    CommunityGroup.hasMany(m.CommunityGroupMember,  { foreignKey: 'group_id', as: 'members' });
    CommunityGroup.hasMany(m.CommunityGroupMessage, { foreignKey: 'group_id', as: 'messages' });
  };

  return CommunityGroup;
};
