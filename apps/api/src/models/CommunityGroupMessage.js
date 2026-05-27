module.exports = (sequelize, DataTypes) => {
  const CommunityGroupMessage = sequelize.define('CommunityGroupMessage', {
    id:       { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    group_id: { type: DataTypes.UUID, allowNull: false },
    user_id:  { type: DataTypes.UUID, allowNull: false },
    content:  { type: DataTypes.TEXT, allowNull: false },
  }, { tableName: 'app_community_group_message', paranoid: true, timestamps: true, underscored: true });

  CommunityGroupMessage.associate = (m) => {
    CommunityGroupMessage.belongsTo(m.CommunityGroup, { foreignKey: 'group_id', as: 'group' });
    CommunityGroupMessage.belongsTo(m.User,           { foreignKey: 'user_id', as: 'user' });
  };

  return CommunityGroupMessage;
};
