'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_favorite_player', {
      id:                { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id:           { type: Sequelize.UUID, allowNull: false },
      favorite_user_id:  { type: Sequelize.UUID, allowNull: false },
      created_at:        { type: Sequelize.DATE, allowNull: false },
      updated_at:        { type: Sequelize.DATE, allowNull: false },
      deleted_at:        { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_favorite_player', ['user_id']);
    await queryInterface.addIndex('app_favorite_player', {
      fields: ['user_id', 'favorite_user_id'],
      unique: true,
      where: { deleted_at: null },
    });
    await queryInterface.addConstraint('app_favorite_player', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('app_favorite_player', {
      fields: ['favorite_user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_favorite_player');
  },
};
