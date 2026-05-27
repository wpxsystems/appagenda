'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_user', {
      id:                    { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      nome:                  { type: Sequelize.STRING(120), allowNull: false },
      nickname:              { type: Sequelize.STRING(60) },
      email:                 { type: Sequelize.STRING(255), allowNull: false },
      password_hash:         { type: Sequelize.STRING(72) },
      google_id:             { type: Sequelize.STRING(100) },
      phone:                 { type: Sequelize.STRING(20) },
      data_nascimento:       { type: Sequelize.DATEONLY },
      avatar_url:            { type: Sequelize.STRING(500) },
      bio:                   { type: Sequelize.TEXT },
      cidade_id:             { type: Sequelize.UUID },
      genero:                { type: Sequelize.ENUM('male', 'female', 'other') },
      role:                  { type: Sequelize.ENUM('player', 'professor', 'venue_admin', 'admin', 'superadmin'), defaultValue: 'player' },
      status:                { type: Sequelize.ENUM('active', 'suspended', 'banned'), defaultValue: 'active' },
      push_token:            { type: Sequelize.STRING(255) },
      notifications_enabled: { type: Sequelize.BOOLEAN, defaultValue: true },
      availability_json:     { type: Sequelize.TEXT },
      created_at:            { type: Sequelize.DATE, allowNull: false },
      updated_at:            { type: Sequelize.DATE, allowNull: false },
      deleted_at:            { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_user', ['cidade_id']);
    await queryInterface.addIndex('app_user', { fields: ['email'], unique: true, where: { deleted_at: null } });
    await queryInterface.addIndex('app_user', { fields: ['google_id'], unique: true, where: { deleted_at: null } });
    await queryInterface.addConstraint('app_user', {
      fields: ['cidade_id'],
      type: 'foreign key',
      references: { table: 'app_cidade', field: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_user');
  },
};
