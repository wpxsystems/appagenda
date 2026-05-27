module.exports = (sequelize, DataTypes) => {
  const Court = sequelize.define('Court', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    venue_id:  { type: DataTypes.UUID, allowNull: false },
    nome:      { type: DataTypes.STRING(100), allowNull: false },
    sport:     { type: DataTypes.ENUM('padel', 'beach_tennis', 'tennis'), allowNull: false },
    surface:   { type: DataTypes.STRING(60) },
    is_indoor: { type: DataTypes.BOOLEAN, defaultValue: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  }, { tableName: 'app_court', paranoid: true, timestamps: true, underscored: true });

  Court.associate = (m) => {
    Court.belongsTo(m.Venue, { foreignKey: 'venue_id', as: 'venue' });
    Court.hasMany(m.Jogo,    { foreignKey: 'court_id', as: 'jogos' });
  };

  return Court;
};
