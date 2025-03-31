import { DataTypes } from 'sequelize';
import sequelize from '../db';

const File = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
  },
  { timestamps: true },
);

export default File;
