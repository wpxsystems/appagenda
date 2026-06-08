'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_game_rating', {
      id:             { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      jogo_id:        { type: Sequelize.UUID, allowNull: false, references: { model: 'app_jogo', key: 'id' }, onDelete: 'CASCADE' },
      rater_id:       { type: Sequelize.UUID, allowNull: false, references: { model: 'app_user', key: 'id' }, onDelete: 'CASCADE' },
      rated_user_id:  { type: Sequelize.UUID, allowNull: false, references: { model: 'app_user', key: 'id' }, onDelete: 'CASCADE' },
      score:          { type: Sequelize.SMALLINT, allowNull: false },
      badges:         { type: Sequelize.JSONB, defaultValue: [] },
      created_at:     { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
      updated_at:     { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('NOW()') },
    });

    await queryInterface.addConstraint('app_game_rating', {
      fields: ['jogo_id', 'rater_id', 'rated_user_id'],
      type: 'unique',
      name: 'uq_game_rating_jogo_rater_rated',
    });

    await queryInterface.addIndex('app_game_rating', ['rated_user_id']);
    await queryInterface.addIndex('app_game_rating', ['rater_id', 'jogo_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_game_rating');
  },
};
