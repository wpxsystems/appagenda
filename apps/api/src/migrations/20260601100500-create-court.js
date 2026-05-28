'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_court', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      venue_id:   { type: Sequelize.UUID, allowNull: false },
      nome:       { type: Sequelize.STRING(100), allowNull: false },
      sport:      { type: Sequelize.ENUM('padel', 'beach_tennis', 'tennis'), allowNull: false },
      surface:    { type: Sequelize.STRING(60) },
      is_indoor:  { type: Sequelize.BOOLEAN, defaultValue: true },
      is_active:  { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_court', ['venue_id']);
    await queryInterface.addConstraint('app_court', {
      fields: ['venue_id'],
      type: 'foreign key',
      references: { table: 'app_venue', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_court');
  },
};
