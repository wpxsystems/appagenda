require('dotenv').config();

const common = {
  dialect: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: { underscored: true, timestamps: true, paranoid: true },
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 },
  dialectOptions: process.env.DB_SSL === 'true'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
};

module.exports = {
  development: common,
  test: { ...common, database: `${process.env.DB_NAME}_test` },
  production: common,
};
