'use strict';

const NEW_VALUES = ['8a', '7a', '6a', '5a', '4a', '3a', '2a', 'Open'];

module.exports = {
  async up(queryInterface) {
    // PostgreSQL requires adding enum values one by one
    for (const val of NEW_VALUES) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_app_sport_profile_category" ADD VALUE IF NOT EXISTS '${val}';`
        );
      } catch (e) { console.warn(`skip add ${val}:`, e.message); }
    }
    // app_jogo.target_category
    for (const val of NEW_VALUES) {
      try {
        await queryInterface.sequelize.query(
          `ALTER TYPE "enum_app_jogo_target_category" ADD VALUE IF NOT EXISTS '${val}';`
        );
      } catch (e) { console.warn(`skip add jogo ${val}:`, e.message); }
    }
  },
  async down() { /* enum values cannot be removed in PostgreSQL */ },
};
