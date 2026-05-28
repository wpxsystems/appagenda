'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('community_group_invites', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      group_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'community_groups', key: 'id' }, onDelete: 'CASCADE' },
      inviter_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      invitee_id: { type: Sequelize.UUID, allowNull: false, references: { model: 'users', key: 'id' }, onDelete: 'CASCADE' },
      status: { type: Sequelize.STRING, allowNull: false, defaultValue: 'pending' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    });
    await queryInterface.addIndex('community_group_invites', ['invitee_id']);
    await queryInterface.addIndex('community_group_invites', ['group_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('community_group_invites');
  },
};
