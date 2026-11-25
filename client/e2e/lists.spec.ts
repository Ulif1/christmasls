import { expect, test } from '@playwright/test';
import { DEFAULT_LISTS, jsonResponse, mockApi } from './fixtures/api';
import type { ApiOverride, ApiRequestRecord } from './fixtures/api';
import { loginAs } from './fixtures/auth';

let requests: ApiRequestRecord[];
let overrides: ApiOverride[];

test.beforeEach(async ({ page }) => {
  overrides = [];
  ({ requests } = await mockApi(page, overrides));
  await loginAs(page);
  await page.goto('/home');
  await expect(page.getByRole('navigation', { name: 'Lists' })).toBeVisible();
});

test('shows groups, owned actions, shared badge and one aria-current', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Lists' });
  await expect(nav.getByRole('heading', { name: 'My lists' })).toBeVisible();
  await expect(
    nav.getByRole('heading', { name: 'Shared with me' }),
  ).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Rename Groceries' })).toHaveCount(
    1,
  );
  await expect(nav.getByRole('button', { name: 'Delete Groceries' })).toHaveCount(
    1,
  );
  await expect(
    nav.getByRole('button', { name: 'Rename Holiday gifts' }),
  ).toHaveCount(0);
  await expect(
    page.locator('nav[aria-label="Lists"] button[aria-current="true"]'),
  ).toHaveCount(1);
  await expect(
    page.locator('nav[aria-label="Lists"] button[aria-current="true"]'),
  ).toHaveText('Groceries');

  await nav.getByRole('button', { name: 'Holiday gifts' }).click();
  await expect(
    page.getByRole('heading', { name: 'Holiday gifts' }),
  ).toBeVisible();
  await expect(page.getByText(/Shared by/)).toBeVisible();
});

test('creates a list, refetches and auto-selects it', async ({ page }) => {
  const newList = {
    id: 99,
    name: 'New list',
    items: [],
    sharedWith: [],
  };
  overrides.push({
    method: 'GET',
    path: '/api/lists',
    handle: (route) => jsonResponse(route, [...DEFAULT_LISTS, newList]),
  });

  await page.getByRole('button', { name: 'New list' }).click();

  await expect(page.getByRole('heading', { name: 'New list' })).toBeVisible();
  await expect(
    page.locator('nav[aria-label="Lists"] button[aria-current="true"]'),
  ).toHaveText('New list');
  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' && request.path === '/api/lists',
        ).length,
    )
    .toBe(1);
  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'GET' && request.path === '/api/lists',
        ).length,
    )
    .toBe(2);

  const post = requests.find(
    (request) =>
      request.method === 'POST' && request.path === '/api/lists',
  );
  expect(post?.body).toEqual({ name: 'New List' });
});

test('renames a list via the prompt and updates the rail and panel', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Lists' });
  await nav.getByRole('button', { name: 'Rename Groceries' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Rename list' })).toBeVisible();
  await dialog.getByLabel('List name').fill('Groceries 2');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'PUT' && request.path === '/api/lists/1',
        ).length,
    )
    .toBe(1);
  const put = requests.find(
    (request) =>
      request.method === 'PUT' && request.path === '/api/lists/1',
  );
  expect(put?.body).toEqual({ name: 'Groceries 2' });
  await expect(page.getByRole('heading', { name: 'Groceries 2' })).toBeVisible();
  await expect(
    nav.getByRole('button', { name: 'Groceries 2', exact: true }),
  ).toBeVisible();
});

test('cancels then deletes a list and falls back to the shared list', async ({
  page,
}) => {
  const nav = page.getByRole('navigation', { name: 'Lists' });
  overrides.push({
    method: 'GET',
    path: '/api/lists',
    handle: (route) =>
      jsonResponse(
        route,
        DEFAULT_LISTS.filter((list) => list.id !== 1),
      ),
  });

  await nav.getByRole('button', { name: 'Delete Groceries' }).click();
  let dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Delete list?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(
    nav.getByRole('button', { name: 'Groceries', exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        requests.filter((request) => request.method === 'DELETE').length,
    )
    .toBe(0);

  await nav.getByRole('button', { name: 'Delete Groceries' }).click();
  dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Delete list?' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'DELETE' && request.path === '/api/lists/1',
        ).length,
    )
    .toBe(1);
  await expect(
    nav.getByRole('button', { name: 'Groceries', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: 'Holiday gifts' }),
  ).toBeVisible();
});

test('rename prompt is required and blocks an empty save', async ({ page }) => {
  const nav = page.getByRole('navigation', { name: 'Lists' });
  await nav.getByRole('button', { name: 'Rename Groceries' }).click();

  const dialog = page.getByRole('dialog');
  const input = dialog.getByLabel('List name');
  await expect(input).toHaveAttribute('aria-required', 'true');
  await input.fill('   ');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('This field is required.');
  await expect
    .poll(
      () => requests.filter((request) => request.method === 'PUT').length,
    )
    .toBe(0);
});
