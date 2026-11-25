import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mockApi } from './fixtures/api';
import { loginAs } from './fixtures/auth';

async function focused(page: Page): Promise<string> {
  return page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    return (
      element.getAttribute('aria-label') ||
      element.id ||
      (element.textContent || '').trim()
    );
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await loginAs(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
});

test('keyboard order reaches rail actions before the item form and shows a focus ring', async ({
  page,
}) => {
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toHaveAttribute('aria-haspopup', 'true');

  const ring = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement;
    const style = getComputedStyle(element);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(ring).toEqual({ width: '2px', style: 'solid' });

  const stops: string[] = [];
  for (let index = 0; index < 9; index += 1) {
    stops.push(await focused(page));
    await page.keyboard.press('Tab');
  }

  expect(stops[0]).toBe('alice');
  expect(stops[3]).toBe('Rename Groceries');
  expect(stops[4]).toBe('Delete Groceries');
  expect(stops.indexOf('item-name')).toBeGreaterThan(4);

  await expect(
    page.locator('nav[aria-label="Lists"] button[aria-current="true"]'),
  ).toHaveCount(1);
  await expect(page.locator('[role="status"]')).toHaveCount(1);
  await expect(page.locator('[role="alert"]')).toHaveCount(1);
  await expect(
    page.locator('[role="status"] [role="alert"], [role="alert"] [role="status"]'),
  ).toHaveCount(0);
});

test('rename dialog closes on Escape and returns focus', async ({ page }) => {
  for (let index = 0; index < 4; index += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(page.locator(':focus')).toHaveAttribute(
    'aria-label',
    'Rename Groceries',
  );
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Rename list' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.locator(':focus')).toHaveAttribute(
    'aria-label',
    'Rename Groceries',
  );
});

test('delete dialog can be cancelled with the keyboard', async ({ page }) => {
  for (let index = 0; index < 5; index += 1) {
    await page.keyboard.press('Tab');
  }
  await expect(page.locator(':focus')).toHaveAttribute(
    'aria-label',
    'Delete Groceries',
  );
  await page.keyboard.press('Enter');

  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Delete list?' }),
  ).toBeVisible();
  const cancelButton = dialog.getByRole('button', { name: 'Cancel' });
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(dialog).toBeHidden();
  await expect(
    page
      .getByRole('navigation', { name: 'Lists' })
      .getByRole('button', { name: 'Groceries', exact: true }),
  ).toBeVisible();
  await expect(page.locator(':focus')).toHaveAttribute(
    'aria-label',
    'Delete Groceries',
  );
});
