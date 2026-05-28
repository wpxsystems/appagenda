'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_community_group', {
      id:          { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      nome:        { type: Sequelize.STRING(120), allowNull: false },
      sport:       { type: Sequelize.ENUM('padel', 'beach_tennis', 'tennis') },
      created_by:  { type: Sequelize.UUID, allowNull: false },
      created_at:  { type: Sequelize.DATE, allowNull: false },
      updated_at:  { type: Sequelize.DATE, allowNull: false },
      deleted_at:  { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_community_group', ['created_by']);
    await queryInterface.addConstraint('app_community_group', {
      fields: ['created_by'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_community_group');
  },
};
