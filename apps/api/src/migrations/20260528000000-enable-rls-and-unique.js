'use strict';

const TABELAS_RLS = [
  'app_user_location',
  'app_notification',
  'app_favorite_player',
];

const INDICES_FK = [
  { nome: 'app_jogo_court_id',                       tabela: 'app_jogo',                       coluna: 'court_id' },
  { nome: 'app_jogo_venue_id',                       tabela: 'app_jogo',                       coluna: 'venue_id' },
  { nome: 'app_game_message_user_id',                tabela: 'app_game_message',               coluna: 'user_id' },
  { nome: 'app_notification_jogo_id',                tabela: 'app_notification',               coluna: 'jogo_id' },
  { nome: 'app_community_group_message_user_id',     tabela: 'app_community_group_message',    coluna: 'user_id' },
];

module.exports = {
  async up(queryInterface) {
    // ========== 1. Índices em FKs faltantes ==========
    for (const i of INDICES_FK) {
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${i.nome} ON ${i.tabela}(${i.coluna});`
      );
    }

    // ========== 2. RLS por user_id (3 tabelas) ==========
    for (const t of TABELAS_RLS) {
      await queryInterface.sequelize.query(`
        ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY;
        ALTER TABLE ${t} FORCE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS user_isolation ON ${t};
        CREATE POLICY user_isolation ON ${t}
          USING      (user_id::text = current_setting('app.current_user', true))
          WITH CHECK (user_id::text = current_setting('app.current_user', true));
      `);
      // appagenda_auth (BYPASSRLS) precisa de acesso explícito pra cron/admin
      await queryInterface.sequelize.query(`
        GRANT SELECT, INSERT, UPDATE, DELETE ON ${t} TO appagenda_auth;
      `);
    }

    // ========== 3. UNIQUE parcial em email/nickname (respeita soft delete) ==========
    await queryInterface.sequelize.query(`
      ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_email_key;
      ALTER TABLE app_user DROP CONSTRAINT IF EXISTS app_user_nickname_key;
      DROP INDEX IF EXISTS app_user_email_key;
      DROP INDEX IF EXISTS app_user_nickname_key;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX app_user_email_unique_active
        ON app_user (LOWER(email))
        WHERE deleted_at IS NULL;

      CREATE UNIQUE INDEX app_user_nickname_unique_active
        ON app_user (LOWER(nickname))
        WHERE deleted_at IS NULL AND nickname IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS app_user_email_unique_active;
      DROP INDEX IF EXISTS app_user_nickname_unique_active;
    `);

    for (const t of TABELAS_RLS) {
      await queryInterface.sequelize.query(`
        DROP POLICY IF EXISTS user_isolation ON ${t};
        ALTER TABLE ${t} DISABLE ROW LEVEL SECURITY;
      `);
    }

    for (const i of INDICES_FK) {
      await queryInterface.sequelize.query(`DROP INDEX IF EXISTS ${i.nome};`);
    }
  },
};
