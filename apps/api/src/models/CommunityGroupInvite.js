'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class CommunityGroupInvite extends Model {
    static associate(models) {
      CommunityGroupInvite.belongsTo(models.CommunityGroup, { as: 'group', foreignKey: 'group_id' });
      CommunityGroupInvite.belongsTo(models.User, { as: 'inviter', foreignKey: 'inviter_id' });
      CommunityGroupInvite.belongsTo(models.User, { as: 'invitee', foreignKey: 'invitee_id' });
    }
  }

  CommunityGroupInvite.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    group_id: { type: DataTypes.UUID, allowNull: false },
    inviter_id: { type: DataTypes.UUID, allowNull: false },
    invitee_id: { type: DataTypes.UUID, allowNull: false },
    status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
  }, {
    sequelize,
    modelName: 'CommunityGroupInvite',
    tableName: 'community_group_invites',
    underscored: true,
  });

  return CommunityGroupInvite;
};
