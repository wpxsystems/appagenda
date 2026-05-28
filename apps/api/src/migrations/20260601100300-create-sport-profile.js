'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_sport_profile', {
      id:              { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      user_id:         { type: Sequelize.UUID, allowNull: false },
      sport:           { type: Sequelize.ENUM('padel', 'beach_tennis', 'tennis'), allowNull: false },
      is_active:       { type: Sequelize.BOOLEAN, defaultValue: true },
      category:        { type: Sequelize.ENUM('C', 'B', 'A', 'Open') },
      side_preference: { type: Sequelize.ENUM('left', 'right', 'both') },
      skill_level:     { type: Sequelize.ENUM('beginner', 'intermediate', 'advanced', 'competitive') },
      play_format:     { type: Sequelize.ENUM('singles', 'doubles', 'both') },
      created_at:      { type: Sequelize.DATE, allowNull: false },
      updated_at:      { type: Sequelize.DATE, allowNull: false },
      deleted_at:      { type: Sequelize.DATE },
    });

    await queryInterface.addIndex('app_sport_profile', ['user_id']);
    await queryInterface.addIndex('app_sport_profile', {
      fields: ['user_id', 'sport'],
      unique: true,
      where: { deleted_at: null },
    });
    await queryInterface.addConstraint('app_sport_profile', {
      fields: ['user_id'],
      type: 'foreign key',
      references: { table: 'app_user', field: 'id' },
      onDelete: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_sport_profile');
  },
};
