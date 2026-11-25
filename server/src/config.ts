export interface AppConfig { databaseUrl: string; jwtSecret: string; port: number }
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    databaseUrl: env.DATABASE_URL ?? 'postgresql://user:password@localhost:5432/christmasdb',
    jwtSecret: env.JWT_SECRET ?? 'secret',
    port: Number(env.PORT ?? 3001),
  };
}
