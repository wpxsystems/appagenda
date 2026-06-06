require('dotenv').config();
const path = require('path');
const fs = require('fs');
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

// IMPORTANTE: API está atrás do Traefik. Sem isso, req.ip vira o IP do proxy
// (127.0.0.1) e o rate-limit conta TODOS clientes como se fossem o mesmo IP.
// O '1' significa "confiar no PRIMEIRO proxy à frente" (Traefik).
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Rate-limit GLOBAL (proteção geral DDoS por IP)
app.use(rateLimit({
  windowMs: 60_000,
  max: Number(process.env.RATE_LIMIT_GENERAL) || 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));

// Serve uploaded avatars estaticamente
const uploadsDir = path.join(__dirname, '..', 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.get('/health', (_, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.use('/api/v1', routes);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
sequelize.authenticate()
  .then(() => app.listen(port, () => logger.info(`API on :${port}`)))
  .catch((err) => { logger.fatal({ err }, 'DB connection failed'); process.exit(1); });

process.on('unhandledRejection', (err) => { logger.fatal({ err }, 'unhandledRejection'); process.exit(1); });
process.on('uncaughtException', (err) => { logger.fatal({ err }, 'uncaughtException'); process.exit(1); });
