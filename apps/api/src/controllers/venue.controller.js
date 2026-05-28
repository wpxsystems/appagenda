const asyncHandler = require('../utils/asyncHandler');
const { Venue, Court } = require('../models');
const AppError = require('../utils/AppError');

exports.list = asyncHandler(async (req, res) => {
  const where = { is_active: true };
  if (req.query.cidade_id) where.cidade_id = req.query.cidade_id;
  const venues = await Venue.findAll({
    where,
    attributes: ['id', 'nome', 'endereco', 'esportes'],
    order: [['nome', 'ASC']],
  });
  res.json(venues);
});

exports.getCourts = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const courts = await Court.findAll({
    where: { venue_id: id, is_active: true },
    attributes: ['id', 'nome', 'sport', 'surface', 'is_indoor'],
  });
  res.json(courts);
});
