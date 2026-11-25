import { expect, test } from '@playwright/test';
import { jsonResponse, mockApi } from './fixtures/api';
import type { ApiOverride } from './fixtures/api';
import { loginAs } from './fixtures/auth';

let overrides: ApiOverride[];

test.beforeEach(async ({ page }) => {
  overrides = [];
  await mockApi(page, overrides);
  await loginAs(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
});

test('reduced motion disables spinner/dialog animation and toasts still work', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  overrides.push({
    method: 'POST',
    path: '/api/items',
    handle: async (route, request) => {
      const body = request.body as {
        name?: string;
        description?: string;
        price?: number;
      };
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await jsonResponse(route, {
        id: 13,
        name: body.name,
        description: body.description,
        price: body.price,
        purchased: false,
      });
    },
  });

  await page.locator('#item-name').fill('Candy');
  await page.locator('#item-description').fill('Peppermint');
  await page.locator('#item-price').fill('2');
  await page.getByRole('button', { name: 'Add item' }).click();

  const busy = page.locator('button[aria-busy="true"]');
  await expect(busy).toBeVisible();
  const spinnerAnimation = await busy.locator('svg').first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(
    spinnerAnimation.name === 'none' ||
      parseFloat(spinnerAnimation.duration) < 0.001,
  ).toBe(true);
  await expect(page.getByText('Candy', { exact: true })).toBeVisible();

  await page
    .getByRole('navigation', { name: 'Lists' })
    .getByRole('button', { name: 'Delete Groceries' })
    .click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const dialogAnimation = await dialog.evaluate((element) => {
    const style = getComputedStyle(element);
    return { name: style.animationName, duration: style.animationDuration };
  });
  expect(
    dialogAnimation.name === 'none' ||
      parseFloat(dialogAnimation.duration) < 0.001,
  ).toBe(true);
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();

  await page.getByLabel('Share with').selectOption('bob');
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await expect(page.getByText('List shared')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.getByText('List shared')).toBeHidden({ timeout: 7000 });
});
