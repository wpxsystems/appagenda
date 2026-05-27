'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_community_group_message', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      group_id:   { type: Sequelize.UUID, allowNull: false },
      user_id:    { type: Sequelize.UUID, allowNull: false },
      content:    { type: Sequelize.TEXT, allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_community_group_message', ['group_id']);
    await queryInterface.addIndex('app_community_group_message', ['created_at']);
    await queryInterface.addConstraint('app_community_group_message', {
      fields: ['group_id'],
      type: 'foreign key',
      references: { table: 'app_community_group', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('app_community_group_message', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_community_group_message');
  },
};
