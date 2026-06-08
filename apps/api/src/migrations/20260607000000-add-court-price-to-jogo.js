'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('app_jogo', 'court_price_per_person', {
      type: Sequelize.DECIMAL(8, 2),
      allowNull: true,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('app_jogo', 'court_price_per_person');
  },
};
