import { expect, test } from '@playwright/test';
import { mockApi } from './fixtures/api';
import { loginAs } from './fixtures/auth';

test.beforeEach(async ({ page }) => {
  await mockApi(page);
  await loginAs(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
});

test('rail and mobile select switch at the 960 breakpoint', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  const nav = page.getByRole('navigation', { name: 'Lists' });
  await expect(nav).toBeHidden();

  const select = page.getByLabel('Selected list');
  await expect(select).toBeVisible();
  await select.selectOption('2');
  await expect(
    page.getByRole('heading', { name: 'Holiday gifts' }),
  ).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(nav).toBeVisible();
  await expect(page.getByLabel('Selected list')).toBeHidden();
});

test('has no horizontal overflow at 375, 768, 1024 and 1440', async ({
  page,
}) => {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const metrics = await page.evaluate(() => {
      const maxRight = Math.max(
        ...Array.from(document.querySelectorAll('*')).map(
          (element) => element.getBoundingClientRect().right,
        ),
      );
      return {
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
        maxRight,
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.innerWidth);
    expect(metrics.maxRight).toBeLessThanOrEqual(metrics.innerWidth + 1);
  }
});
