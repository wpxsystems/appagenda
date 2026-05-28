'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_notification', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id:    { type: Sequelize.UUID, allowNull: false },
      type:       { type: Sequelize.STRING(60), allowNull: false },
      title:      { type: Sequelize.STRING(255), allowNull: false },
      body:       { type: Sequelize.TEXT, allowNull: false },
      jogo_id:    { type: Sequelize.UUID },
      read:       { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_notification', ['user_id']);
    await queryInterface.addIndex('app_notification', ['read']);
    await queryInterface.addConstraint('app_notification', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('app_notification', {
      fields: ['jogo_id'],
      type: 'foreign key',
      references: { table: 'app_jogo', field: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_notification');
  },
};
