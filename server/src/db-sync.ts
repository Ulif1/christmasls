import { createSchemaDriver } from './db/tooling';
import { assertSchema, syncSchema } from './db/schema';

const db = createSchemaDriver();

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  await db.connect();
  if (check) {
    await assertSchema(db);
    console.log('Database schema is up to date');
  } else {
    await syncSchema(db);
    console.log('Database synchronized');
  }
}

main()
  .then(async () => {
    await db.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Error synchronizing database:', error);
    try {
      await db.close();
    } catch {
      // ignore close failures; the original error is what matters
    }
    process.exit(1);
  });
