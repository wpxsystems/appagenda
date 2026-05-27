'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_waitlist_entry', {
      id:           { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      email:        { type: Sequelize.STRING(255), allowNull: false },
      cidade_nome:  { type: Sequelize.STRING(120), allowNull: false },
      sport:        { type: Sequelize.ENUM('padel', 'beach_tennis', 'tennis') },
      created_at:   { type: Sequelize.DATE, allowNull: false },
      updated_at:   { type: Sequelize.DATE, allowNull: false },
      deleted_at:   { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_waitlist_entry', ['email']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_waitlist_entry');
  },
};
