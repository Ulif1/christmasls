import { DataSource } from 'typeorm';
import { User } from './entities/User';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  synchronize: true, // For dev, auto-sync schema
});

AppDataSource.initialize()
  .then(() => {
    console.log('Database synchronized');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error synchronizing database:', error);
    process.exit(1);
  });