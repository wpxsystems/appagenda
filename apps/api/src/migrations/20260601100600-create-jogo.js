'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_jogo', {
      id:                { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      sport:             { type: Sequelize.ENUM('padel', 'beach_tennis', 'tennis'), allowNull: false },
      creator_id:        { type: Sequelize.UUID, allowNull: false },
      venue_id:          { type: Sequelize.UUID },
      court_id:          { type: Sequelize.UUID },
      cidade_id:         { type: Sequelize.UUID, allowNull: false },
      scheduled_at:      { type: Sequelize.DATE, allowNull: false },
      duration_minutes:  { type: Sequelize.INTEGER, defaultValue: 90 },
      vacancies_total:   { type: Sequelize.INTEGER, allowNull: false },
      gender_type:       { type: Sequelize.ENUM('mixed', 'male', 'female'), defaultValue: 'mixed' },
      status:            { type: Sequelize.ENUM('open', 'full', 'cancelled', 'completed'), defaultValue: 'open' },
      court_reserved:    { type: Sequelize.BOOLEAN, defaultValue: false },
      notes:             { type: Sequelize.TEXT },
      target_category:   { type: Sequelize.ENUM('C', 'B', 'A', 'Open') },
      target_skill_level:{ type: Sequelize.ENUM('beginner', 'intermediate', 'advanced', 'competitive') },
      target_side:       { type: Sequelize.ENUM('left', 'right', 'both') },
      target_play_format:{ type: Sequelize.ENUM('singles', 'doubles', 'both') },
      created_at:        { type: Sequelize.DATE, allowNull: false },
      updated_at:        { type: Sequelize.DATE, allowNull: false },
      deleted_at:        { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_jogo', ['cidade_id']);
    await queryInterface.addIndex('app_jogo', ['creator_id']);
    await queryInterface.addIndex('app_jogo', ['status']);
    await queryInterface.addIndex('app_jogo', ['scheduled_at']);
    await queryInterface.addConstraint('app_jogo', {
      fields: ['creator_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
    });
    await queryInterface.addConstraint('app_jogo', {
      fields: ['venue_id'],
      type: 'foreign key',
      references: { table: 'app_venue', field: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addConstraint('app_jogo', {
      fields: ['court_id'],
      type: 'foreign key',
      references: { table: 'app_court', field: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addConstraint('app_jogo', {
      fields: ['cidade_id'],
      type: 'foreign key',
      references: { table: 'app_cidade', field: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_jogo');
  },
};
