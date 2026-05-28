'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_community_group_member', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      group_id:   { type: Sequelize.UUID, allowNull: false },
      user_id:    { type: Sequelize.UUID, allowNull: false },
      role:       { type: Sequelize.STRING(20), defaultValue: 'member' },
      joined_at:  { type: Sequelize.DATE, defaultValue: Sequelize.literal('now()') },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_community_group_member', ['group_id']);
    await queryInterface.addIndex('app_community_group_member', ['user_id']);
    await queryInterface.addIndex('app_community_group_member', {
      fields: ['group_id', 'user_id'],
      unique: true,
      where: { deleted_at: null },
    });
    await queryInterface.addConstraint('app_community_group_member', {
      fields: ['group_id'],
      type: 'foreign key',
      references: { table: 'app_community_group', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('app_community_group_member', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_community_group_member');
  },
};
