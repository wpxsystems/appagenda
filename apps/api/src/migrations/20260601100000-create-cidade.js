'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_cidade', {
      id:              { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      nome:            { type: Sequelize.STRING(120), allowNull: false },
      estado:          { type: Sequelize.STRING(2), allowNull: false },
      pais:            { type: Sequelize.STRING(3), defaultValue: 'BRA' },
      slug:            { type: Sequelize.STRING(120), unique: true },
      is_active:       { type: Sequelize.BOOLEAN, defaultValue: false },
      created_at:      { type: Sequelize.DATE, allowNull: false },
      updated_at:      { type: Sequelize.DATE, allowNull: false },
      deleted_at:      { type: Sequelize.DATE },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE app_cidade ADD COLUMN centro geography(Point, 4326);
      CREATE INDEX idx_cidade_centro ON app_cidade USING GIST (centro);
    `);

    await queryInterface.addIndex('app_cidade', ['is_active']);
    await queryInterface.addIndex('app_cidade', { fields: ['slug'], unique: true, where: { deleted_at: null } });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_cidade');
  },
};
