'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_venue', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      nome:       { type: Sequelize.STRING(200), allowNull: false },
      endereco:   { type: Sequelize.STRING(255), allowNull: false },
      cidade_id:  { type: Sequelize.UUID, allowNull: false },
      telefone:   { type: Sequelize.STRING(20) },
      website:    { type: Sequelize.STRING(500) },
      foto_url:   { type: Sequelize.STRING(500) },
      esportes:   { type: Sequelize.ARRAY(Sequelize.STRING), defaultValue: [] },
      is_active:  { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    try {
      await queryInterface.sequelize.query(`
        ALTER TABLE app_venue ADD COLUMN localizacao geography(Point, 4326);
        CREATE INDEX idx_venue_localizacao ON app_venue USING GIST (localizacao);
      `);
    } catch (e) { console.warn('PostGIS not available, skipping geography column'); }

    await queryInterface.addIndex('app_venue', ['cidade_id']);
    await queryInterface.addIndex('app_venue', ['is_active']);
    await queryInterface.addConstraint('app_venue', {
      fields: ['cidade_id'],
      type: 'foreign key',
      references: { table: 'app_cidade', field: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_venue');
  },
};
