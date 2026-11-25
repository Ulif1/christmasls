import { expect, test } from '@playwright/test';
import { jsonResponse, mockApi } from './fixtures/api';
import { makeFakeJwt } from './fixtures/auth';

test('invalid credentials show a form alert and stay on login', async ({
  page,
}) => {
  await mockApi(page, [
    {
      method: 'POST',
      path: '/api/login',
      handle: (route) =>
        jsonResponse(route, { message: 'Invalid credentials' }, 401),
    },
  ]);
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('alice');
  await page.getByLabel('Password', { exact: true }).fill('wrong');
  await page.getByRole('button', { name: 'Log in' }).click();

  const error = page.locator('#login-error');
  await expect(error).toHaveAttribute('role', 'alert');
  await expect(error).toHaveText('Invalid credentials');
  await expect(page).toHaveURL('/');
});

test('valid credentials navigate home and store the token', async ({
  page,
}) => {
  const { requests } = await mockApi(page);
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('alice');
  await page.getByLabel('Password', { exact: true }).fill('secret');
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(page).toHaveURL('/home');
  await expect(page.getByRole('navigation', { name: 'Lists' })).toBeVisible();
  const token = await page.evaluate(() => sessionStorage.getItem('token'));
  expect(token).toBeTruthy();
  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' && request.path === '/api/login',
        ).length,
    )
    .toBe(1);
});

test('double-submit sends exactly one login request', async ({ page }) => {
  const { requests } = await mockApi(page, [
    {
      method: 'POST',
      path: '/api/login',
      handle: async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 300));
        await jsonResponse(route, { token: makeFakeJwt('alice') });
      },
    },
  ]);
  await page.goto('/');
  await page.getByLabel('Username', { exact: true }).fill('alice');
  await page.getByLabel('Password', { exact: true }).fill('secret');

  await page.locator('form').evaluate((form) => {
    const button = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;
    button?.click();
    button?.click();
  });

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' && request.path === '/api/login',
        ).length,
    )
    .toBe(1);
  await expect(page).toHaveURL('/home');
});

test('labels and autocomplete attributes are correct', async ({ page }) => {
  await mockApi(page);
  await page.goto('/');

  await expect(page.getByLabel('Username', { exact: true })).toHaveAttribute(
    'autocomplete',
    'username',
  );
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  );
});
