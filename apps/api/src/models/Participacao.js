module.exports = (sequelize, DataTypes) => {
  const Participacao = sequelize.define('Participacao', {
    id:        { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    jogo_id:   { type: DataTypes.UUID, allowNull: false },
    user_id:   { type: DataTypes.UUID, allowNull: false },
    status:    { type: DataTypes.ENUM('registered', 'confirmed', 'attended', 'absent', 'removed'), defaultValue: 'registered' },
    joined_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  }, { tableName: 'app_participacao', paranoid: true, timestamps: true, underscored: true });

  Participacao.associate = (m) => {
    Participacao.belongsTo(m.Jogo, { foreignKey: 'jogo_id', as: 'jogo' });
    Participacao.belongsTo(m.User, { foreignKey: 'user_id', as: 'user' });
  };

  return Participacao;
};
