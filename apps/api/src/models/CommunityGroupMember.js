module.exports = (sequelize, DataTypes) => {
  const CommunityGroupMember = sequelize.define('CommunityGroupMember', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    group_id:  { type: DataTypes.UUID, allowNull: false },
    user_id:   { type: DataTypes.UUID, allowNull: false },
    role:      { type: DataTypes.STRING(20), defaultValue: 'member' },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { tableName: 'app_community_group_member', paranoid: true, timestamps: true, underscored: true });

  CommunityGroupMember.associate = (m) => {
    CommunityGroupMember.belongsTo(m.CommunityGroup, { foreignKey: 'group_id', as: 'group' });
    CommunityGroupMember.belongsTo(m.User,           { foreignKey: 'user_id', as: 'user' });
  };

  return CommunityGroupMember;
};
