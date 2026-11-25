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
  await expect(page.getByRole('heading', { name: 'Groceries' })).toBeVisible();
});

function withSharedWith(sharedWith: Array<{ id: number; username: string }>) {
  return DEFAULT_LISTS.map((list) =>
    list.id === 1 ? { ...list, sharedWith } : list,
  );
}

test('shares with one user, shows the chip and success toast', async ({
  page,
}) => {
  overrides.push({
    method: 'GET',
    path: '/api/lists',
    handle: (route) =>
      jsonResponse(route, withSharedWith([{ id: 201, username: 'bob' }])),
  });

  await page.getByLabel('Share with').selectOption('bob');
  await page.getByRole('button', { name: 'Share', exact: true }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' &&
            request.path === '/api/lists/1/share',
        ).length,
    )
    .toBe(1);
  const post = requests.find(
    (request) =>
      request.method === 'POST' && request.path === '/api/lists/1/share',
  );
  expect(post?.body).toEqual({ username: 'bob' });
  await expect(page.getByRole('button', { name: 'Remove bob' })).toBeVisible();
  await expect(page.getByText('List shared')).toBeVisible();
});

test('shares all, updates chips and shows the toast', async ({ page }) => {
  overrides.push({
    method: 'GET',
    path: '/api/lists',
    handle: (route) =>
      jsonResponse(
        route,
        withSharedWith([
          { id: 201, username: 'bob' },
          { id: 202, username: 'carol' },
        ]),
      ),
  });

  await page.getByRole('button', { name: 'Share all' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' &&
            request.path === '/api/lists/1/share',
        ).length,
    )
    .toBe(1);
  const post = requests.find(
    (request) =>
      request.method === 'POST' && request.path === '/api/lists/1/share',
  );
  expect(post?.body).toEqual({ username: 'all' });
  await expect(page.getByRole('button', { name: 'Remove bob' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Remove carol' }),
  ).toBeVisible();
  await expect(page.getByText('Shared with everyone')).toBeVisible();
});

test('removes a shared-user chip', async ({ page }) => {
  overrides.push({
    method: 'GET',
    path: '/api/lists',
    handle: (route) =>
      jsonResponse(
        route,
        withSharedWith([
          { id: 201, username: 'bob' },
          { id: 202, username: 'carol' },
        ]),
      ),
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'Remove bob' })).toBeVisible();

  await page.getByRole('button', { name: 'Remove bob' }).click();

  await expect
    .poll(
      () =>
        requests.filter(
          (request) =>
            request.method === 'POST' &&
            request.path === '/api/lists/1/unshare',
        ).length,
    )
    .toBe(1);
  const post = requests.find(
    (request) =>
      request.method === 'POST' && request.path === '/api/lists/1/unshare',
  );
  expect(post?.body).toEqual({ username: 'bob' });
  await expect(page.getByRole('button', { name: 'Remove bob' })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Remove carol' }),
  ).toBeVisible();
});

test('share failure shows the error toast', async ({ page }) => {
  overrides.push({
    method: 'POST',
    path: '/api/lists/1/share',
    handle: (route) =>
      jsonResponse(route, { error: 'nope' }, 500),
  });

  await page.getByLabel('Share with').selectOption('bob');
  await page.getByRole('button', { name: 'Share', exact: true }).click();

  await expect(page.getByText('Could not share the list')).toBeVisible();
});
