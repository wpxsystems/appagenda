require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const logger = require('./utils/logger');
const errorHandler = require('./middlewares/errorHandler');
const routes = require('./routes');
const { sequelize } = require('./models');

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));
app.use(rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GENERAL) || 100,
}));

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/v1', routes);

app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
sequelize.authenticate()
  .then(() => app.listen(port, () => logger.info(`API on :${port}`)))
  .catch((err) => { logger.fatal({ err }, 'DB connection failed'); process.exit(1); });

process.on('unhandledRejection', (err) => { logger.fatal({ err }, 'unhandledRejection'); process.exit(1); });
process.on('uncaughtException', (err) => { logger.fatal({ err }, 'uncaughtException'); process.exit(1); });
