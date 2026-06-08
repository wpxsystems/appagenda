'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('app_jogo', 'target_categories', {
      type: Sequelize.JSONB,
      defaultValue: [],
      allowNull: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('app_jogo', 'target_categories');
  },
};
