'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_user_location', {
      id:               { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id:          { type: Sequelize.UUID, allowNull: false, unique: true },
      cidade_id:        { type: Sequelize.UUID, allowNull: false },
      search_radius_km: { type: Sequelize.INTEGER, defaultValue: 15 },
      created_at:       { type: Sequelize.DATE, allowNull: false },
      updated_at:       { type: Sequelize.DATE, allowNull: false },
      deleted_at:       { type: Sequelize.DATE },
    });

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE app_user_location ADD COLUMN device_location geography(Point, 4326);
      `);
    } catch (e) { console.warn('PostGIS not available, skipping geography column'); }

    await queryInterface.addIndex('app_user_location', ['cidade_id']);
    await queryInterface.addConstraint('app_user_location', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('app_user_location', {
      fields: ['cidade_id'],
      type: 'foreign key',
      references: { table: 'app_cidade', field: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_user_location');
  },
};
