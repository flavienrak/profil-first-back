import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const sequelize = new Sequelize(
  process.env.PG_DATABASE as string,
  process.env.PG_USER as string,
  process.env.PG_PASSWORD as string,
  {
    host: process.env.PG_HOST as string,
    port: parseInt(process.env.PG_PORT as string, 10) || 5432,
    dialect: 'postgres',
    logging: false,
  },
);

sequelize
  .authenticate()
  .then(() => console.log('Connected to PostgresSQL'))
  .catch((err) => console.error('Connexion with PostgresSQL error:', err));

export default sequelize;
