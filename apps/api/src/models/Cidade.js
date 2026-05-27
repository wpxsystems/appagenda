module.exports = (sequelize, DataTypes) => {
  const Cidade = sequelize.define('Cidade', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    nome:      { type: DataTypes.STRING(120), allowNull: false },
    estado:    { type: DataTypes.STRING(2), allowNull: false },
    pais:      { type: DataTypes.STRING(3), defaultValue: 'BRA' },
    slug:      { type: DataTypes.STRING(120), unique: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: false },
  }, { tableName: 'app_cidade', paranoid: true, timestamps: true, underscored: true });

  Cidade.associate = (m) => {
    Cidade.hasMany(m.User,         { foreignKey: 'cidade_id', as: 'usuarios' });
    Cidade.hasMany(m.Venue,        { foreignKey: 'cidade_id', as: 'venues' });
    Cidade.hasMany(m.Jogo,         { foreignKey: 'cidade_id', as: 'jogos' });
    Cidade.hasMany(m.UserLocation, { foreignKey: 'cidade_id', as: 'userLocations' });
  };

  return Cidade;
};
