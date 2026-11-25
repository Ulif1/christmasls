import type { Page } from '@playwright/test';

export const USERS = ['bob', 'carol'] as const;

function toBase64Url(value: string): string {
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function makeFakeJwt(username = 'alice'): string {
  const header = toBase64Url(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = toBase64Url(JSON.stringify({ username }));
  return `${header}.${payload}.eA`;
}

export async function loginAs(page: Page, username = 'alice'): Promise<string> {
  const token = makeFakeJwt(username);
  await page.addInitScript((value: string) => {
    sessionStorage.setItem('token', value);
  }, token);
  return token;
}
