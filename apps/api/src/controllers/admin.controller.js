const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const { Cidade, Venue, Court } = require('../models');
const AppError = require('../utils/AppError');

const citySchema = z.object({
  nome:     z.string().min(1).max(120),
  estado:   z.string().length(2),
  pais:     z.string().default('BRA'),
  slug:     z.string().optional(),
  is_active: z.boolean().default(false),
});

const venueSchema = z.object({
  nome:      z.string().min(1).max(200),
  endereco:  z.string().min(1),
  cidade_id: z.string().uuid(),
  telefone:  z.string().optional(),
  website:   z.string().url().optional(),
  esportes:  z.array(z.enum(['padel', 'beach_tennis', 'tennis'])).optional(),
});

const courtSchema = z.object({
  nome:      z.string().min(1).max(100),
  sport:     z.enum(['padel', 'beach_tennis', 'tennis']),
  surface:   z.string().optional(),
  is_indoor: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

// Cidades
exports.listCidades = asyncHandler(async (_req, res) => {
  res.json(await Cidade.findAll({ order: [['nome', 'ASC']] }));
});

exports.createCidade = asyncHandler(async (req, res) => {
  const data = citySchema.parse(req.body);
  const cidade = await Cidade.create(data);
  res.status(201).json(cidade);
});

exports.updateCidade = asyncHandler(async (req, res) => {
  const cidade = await Cidade.findByPk(req.params.id);
  if (!cidade) throw new AppError('Cidade não encontrada', 404);
  const data = citySchema.partial().parse(req.body);
  await cidade.update(data);
  res.json(cidade);
});

// Venues
exports.listVenues = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.cidade_id) where.cidade_id = req.query.cidade_id;
  res.json(await Venue.findAll({ where, order: [['nome', 'ASC']] }));
});

exports.createVenue = asyncHandler(async (req, res) => {
  const data = venueSchema.parse(req.body);
  const venue = await Venue.create(data);
  res.status(201).json(venue);
});

exports.updateVenue = asyncHandler(async (req, res) => {
  const venue = await Venue.findByPk(req.params.id);
  if (!venue) throw new AppError('Venue não encontrado', 404);
  const data = venueSchema.partial().parse(req.body);
  await venue.update(data);
  res.json(venue);
});

// Courts
exports.listCourts = asyncHandler(async (req, res) => {
  res.json(await Court.findAll({ where: { venue_id: req.params.venueId }, order: [['nome', 'ASC']] }));
});

exports.createCourt = asyncHandler(async (req, res) => {
  const data = courtSchema.parse(req.body);
  const court = await Court.create({ ...data, venue_id: req.params.venueId });
  res.status(201).json(court);
});

exports.updateCourt = asyncHandler(async (req, res) => {
  const court = await Court.findByPk(req.params.id);
  if (!court) throw new AppError('Quadra não encontrada', 404);
  const data = courtSchema.partial().parse(req.body);
  await court.update(data);
  res.json(court);
});
