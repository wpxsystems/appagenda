module.exports = (sequelize, DataTypes) => {
  const WaitlistEntry = sequelize.define('WaitlistEntry', {
    id:          { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email:       { type: DataTypes.STRING(255), allowNull: false },
    cidade_nome: { type: DataTypes.STRING(120), allowNull: false },
    sport:       { type: DataTypes.ENUM('padel', 'beach_tennis', 'tennis') },
  }, { tableName: 'app_waitlist_entry', paranoid: true, timestamps: true, underscored: true });

  return WaitlistEntry;
};
