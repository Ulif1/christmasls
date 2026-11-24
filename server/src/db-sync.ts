import { driver } from './db';
import { assertSchema, syncSchema } from './db/schema';

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  await driver.connect();
  if (check) {
    await assertSchema(driver);
    console.log('Database schema is up to date');
  } else {
    await syncSchema(driver);
    console.log('Database synchronized');
  }
}

main()
  .then(async () => {
    await driver.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Error synchronizing database:', error);
    try {
      await driver.close();
    } catch {
      // ignore close failures; the original error is what matters
    }
    process.exit(1);
  });
