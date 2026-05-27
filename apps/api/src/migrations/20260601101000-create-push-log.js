'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_push_notification_log', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id:    { type: Sequelize.UUID, allowNull: false },
      type:       { type: Sequelize.STRING(60), allowNull: false },
      payload:    { type: Sequelize.TEXT },
      sent_at:    { type: Sequelize.DATE, defaultValue: Sequelize.literal('now()') },
      error:      { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_push_notification_log', ['user_id']);
    await queryInterface.addIndex('app_push_notification_log', ['sent_at']);
    await queryInterface.addConstraint('app_push_notification_log', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_push_notification_log');
  },
};
