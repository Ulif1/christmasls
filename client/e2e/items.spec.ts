import { expect, test } from '@playwright/test';
import { jsonResponse, mockApi } from './fixtures/api';
import type { ApiOverride, ApiRequestRecord } from './fixtures/api';
import { loginAs } from './fixtures/auth';

let requests: ApiRequestRecord[];
let overrides: ApiOverride[];

test.beforeEach(async ({ page }) => {
  overrides = [];
  ({ requests } = await mockApi(page, overrides));
  await loginAs(page);
  await page.goto('/home');
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
});

test('adds an item with the exact payload and resets the form', async ({
  page,
}) => {
  const newItem = {
    id: 13,
    name: 'Eggs',
    description: 'Free range',
    price: 6.25,
    purchased: false,
  };
  overrides.push({
    method: 'POST',
    path: '/api/items',
    handle: (route) => jsonResponse(route, newItem),
  });

  await page.locator('#item-name').fill('Eggs');
  await page.locator('#item-description').fill('Free range');
  await page.locator('#item-price').fill('6.25');
  await page.getByRole('button', { name: 'Add item' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' && request.path === '/api/items',
        ).length,
    )
    .toBe(1);
  const post = requests.find(
    (request) =>
      request.method === 'POST' && request.path === '/api/items',
  );
  expect(post?.body).toEqual({
    name: 'Eggs',
    description: 'Free range',
    price: 6.25,
    listId: 1,
  });
  await expect(page.getByText('Eggs', { exact: true })).toBeVisible();
  await expect(page.getByText('Free range')).toBeVisible();
  await expect(page.getByText('$6.25')).toBeVisible();
  await expect(page.locator('#item-name')).toHaveValue('');
});

test('edits an item through the prompt sequence', async ({ page }) => {
  overrides.push({
    method: 'PUT',
    path: '/api/items/11',
    handle: (route, request) => {
      const body = request.body as {
        name?: string;
        description?: string;
        price?: number;
      };
      return jsonResponse(route, {
        id: 11,
        name: body.name,
        description: body.description,
        price: body.price,
        purchased: false,
      });
    },
  });

  await page.getByRole('button', { name: 'Edit Milk' }).click();
  const dialog = page.getByRole('dialog');

  await expect(
    dialog.getByRole('heading', { name: 'Edit item name' }),
  ).toBeVisible();
  await dialog.getByLabel('Name').fill('Milk 2');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(
    dialog.getByRole('heading', { name: 'Edit item description' }),
  ).toBeVisible();
  await dialog.getByLabel('Description').fill('Organic');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(
    dialog.getByRole('heading', { name: 'Edit item price' }),
  ).toBeVisible();
  await dialog.getByLabel('Price').fill('1.5');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'PUT' && request.path === '/api/items/11',
        ).length,
    )
    .toBe(1);
  const put = requests.find(
    (request) =>
      request.method === 'PUT' && request.path === '/api/items/11',
  );
  expect(put?.body).toEqual({
    name: 'Milk 2',
    description: 'Organic',
    price: 1.5,
  });
  await expect(page.getByText('Milk 2')).toBeVisible();
  await expect(page.getByText('Organic')).toBeVisible();
  await expect(page.getByText('$1.5')).toBeVisible();
});

test('deletes an item after confirmation', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete Milk' }).click();
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByRole('heading', { name: 'Delete item?' }),
  ).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'DELETE' &&
            request.path === '/api/items/11',
        ).length,
    )
    .toBe(1);
  await expect(page.getByText('Milk', { exact: true })).toHaveCount(0);
});

test('purchase checkbox is shared-only and toggles the purchase endpoint', async ({
  page,
}) => {
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Holiday gifts' }).click();
  await expect(
    page.getByRole('heading', { name: 'Holiday gifts' }),
  ).toBeVisible();
  await expect(page.locator('input[type="checkbox"]')).toHaveCount(1);

  const checkbox = page.getByLabel('Mark Scarf as purchased');
  await expect(checkbox).toBeChecked();
  await checkbox.click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'PUT' &&
            request.path === '/api/items/21/purchase',
        ).length,
    )
    .toBe(1);
  const put = requests.find(
    (request) =>
      request.method === 'PUT' &&
      request.path === '/api/items/21/purchase',
  );
  expect(put?.body).toEqual({ purchased: false });
});
