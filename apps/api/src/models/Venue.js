module.exports = (sequelize, DataTypes) => {
  const Venue = sequelize.define('Venue', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nome:      { type: DataTypes.STRING(200), allowNull: false },
    endereco:  { type: DataTypes.STRING(255), allowNull: false },
    cidade_id: { type: DataTypes.UUID, allowNull: false },
    telefone:  { type: DataTypes.STRING(20) },
    website:   { type: DataTypes.STRING(500) },
    foto_url:  { type: DataTypes.STRING(500) },
    esportes:  { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'app_venue', paranoid: true, timestamps: true, underscored: true });

  Venue.associate = (m) => {
    Venue.belongsTo(m.Cidade, { foreignKey: 'cidade_id', as: 'cidade' });
    Venue.hasMany(m.Court,    { foreignKey: 'venue_id', as: 'courts' });
    Venue.hasMany(m.Jogo,     { foreignKey: 'venue_id', as: 'jogos' });
  };

  return Venue;
};
