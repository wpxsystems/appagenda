const asyncHandler = require('../utils/asyncHandler');
const { Cidade } = require('../models');
const AppError = require('../utils/AppError');

exports.list = asyncHandler(async (_req, res) => {
  const cidades = await Cidade.findAll({
    where: { is_active: true },
    attributes: ['id', 'nome', 'estado', 'slug'],
    order: [['nome', 'ASC']],
  });
  res.json(cidades);
});

exports.getById = asyncHandler(async (req, res) => {
  const cidade = await Cidade.findByPk(req.params.id);
  if (!cidade) throw new AppError('Cidade não encontrada', 404);
  res.json(cidade);
});
