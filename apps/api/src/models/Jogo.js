module.exports = (sequelize, DataTypes) => {
  const Jogo = sequelize.define('Jogo', {
    id:                 { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sport:              { type: DataTypes.ENUM('padel', 'beach_tennis', 'tennis'), allowNull: false },
    creator_id:         { type: DataTypes.UUID, allowNull: false },
    venue_id:           { type: DataTypes.UUID },
    court_id:           { type: DataTypes.UUID },
    cidade_id:          { type: DataTypes.UUID, allowNull: false },
    scheduled_at:       { type: DataTypes.DATE, allowNull: false },
    duration_minutes:   { type: DataTypes.INTEGER, defaultValue: 90 },
    vacancies_total:    { type: DataTypes.INTEGER, allowNull: false },
    gender_type:        { type: DataTypes.ENUM('mixed', 'male', 'female'), defaultValue: 'mixed' },
    status:             { type: DataTypes.ENUM('open', 'full', 'cancelled', 'completed'), defaultValue: 'open' },
    court_reserved:          { type: DataTypes.BOOLEAN, defaultValue: false },
    court_price_per_person:  { type: DataTypes.DECIMAL(8, 2) },
    notes:              { type: DataTypes.TEXT },
    target_category:    { type: DataTypes.ENUM('C', 'B', 'A', '8a', '7a', '6a', '5a', '4a', '3a', '2a', 'Open') },
    target_skill_level: { type: DataTypes.ENUM('beginner', 'intermediate', 'advanced', 'competitive') },
    target_side:        { type: DataTypes.ENUM('left', 'right', 'both') },
    target_play_format: { type: DataTypes.ENUM('singles', 'doubles', 'both') },
  }, { tableName: 'app_jogo', paranoid: true, timestamps: true, underscored: true });

  Jogo.associate = (m) => {
    Jogo.belongsTo(m.User,         { foreignKey: 'creator_id', as: 'creator' });
    Jogo.belongsTo(m.Venue,        { foreignKey: 'venue_id', as: 'venue' });
    Jogo.belongsTo(m.Court,        { foreignKey: 'court_id', as: 'court' });
    Jogo.belongsTo(m.Cidade,       { foreignKey: 'cidade_id', as: 'cidade' });
    Jogo.hasMany(m.Participacao,   { foreignKey: 'jogo_id', as: 'participacoes' });
    Jogo.hasMany(m.GameMessage,    { foreignKey: 'jogo_id', as: 'messages' });
    Jogo.hasMany(m.Notification,   { foreignKey: 'jogo_id', as: 'notifications' });
  };

  return Jogo;
};
