'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_participacao', {
      id:         { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      jogo_id:    { type: Sequelize.UUID, allowNull: false },
      user_id:    { type: Sequelize.UUID, allowNull: false },
      status:     { type: Sequelize.ENUM('registered', 'confirmed', 'attended', 'absent', 'removed'), defaultValue: 'registered' },
      joined_at:  { type: Sequelize.DATE, defaultValue: Sequelize.literal('now()') },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
      deleted_at: { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_participacao', ['jogo_id']);
    await queryInterface.addIndex('app_participacao', ['user_id']);
    await queryInterface.addIndex('app_participacao', {
      fields: ['jogo_id', 'user_id'],
      unique: true,
      where: { deleted_at: null },
    });
    await queryInterface.addConstraint('app_participacao', {
      fields: ['jogo_id'],
      type: 'foreign key',
      references: { table: 'app_jogo', field: 'id' },
      onDelete: 'CASCADE',
    });
    await queryInterface.addConstraint('app_participacao', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_participacao');
  },
};
