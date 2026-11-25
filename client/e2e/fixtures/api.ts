import type { Page, Route } from '@playwright/test';
import { makeFakeJwt, USERS } from './auth';

export interface ApiRequestRecord {
  method: string;
  path: string;
  url: string;
  body: unknown;
}

export interface ApiOverride {
  method?: string;
  path: string | RegExp;
  handle: (
    route: Route,
    request: ApiRequestRecord,
    matchIndex: number,
  ) => Promise<void> | void;
}

export interface MockApiResult {
  requests: ApiRequestRecord[];
}

export const DEFAULT_LISTS = [
  {
    id: 1,
    name: 'Groceries',
    items: [
      {
        id: 11,
        name: 'Milk',
        description: 'Semi-skimmed',
        price: 1.2,
        purchased: false,
      },
      {
        id: 12,
        name: 'Bread',
        description: null,
        price: 2,
        purchased: true,
      },
    ],
  },
  {
    id: 2,
    name: 'Holiday gifts',
    user: 'bob',
    sharedWith: ['alice'],
    items: [
      { id: 21, name: 'Scarf', description: 'Wool', price: 25, purchased: true },
    ],
  },
];

export const DEFAULT_USERS = [...USERS];

export function jsonResponse(
  route: Route,
  data: unknown,
  status = 200,
): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

function matchesOverride(
  override: ApiOverride,
  method: string,
  path: string,
): boolean {
  if (override.method && override.method !== method) {
    return false;
  }
  return typeof override.path === 'string'
    ? override.path === path
    : override.path.test(path);
}

async function handleDefault(
  route: Route,
  request: ApiRequestRecord,
): Promise<void> {
  const { method, path } = request;

  if (method === 'POST' && path === '/api/login') {
    return jsonResponse(route, { token: makeFakeJwt('alice') });
  }
  if (method === 'GET' && path === '/api/lists') {
    return jsonResponse(route, DEFAULT_LISTS);
  }
  if (method === 'GET' && path === '/api/users') {
    return jsonResponse(route, DEFAULT_USERS);
  }
  if (method === 'POST' && path === '/api/lists') {
    return jsonResponse(route, { id: 99, name: 'New list' });
  }
  if (method === 'POST' && /^\/api\/lists\/\d+\/(share|unshare)$/.test(path)) {
    return jsonResponse(route, {});
  }
  if (method === 'PUT' && /^\/api\/lists\/\d+$/.test(path)) {
    return jsonResponse(route, {});
  }
  if (method === 'DELETE' && /^\/api\/lists\/\d+$/.test(path)) {
    return jsonResponse(route, {});
  }
  if (method === 'POST' && path === '/api/items') {
    return jsonResponse(route, {});
  }
  if (method === 'PUT' && /^\/api\/items\/\d+(\/purchase)?$/.test(path)) {
    return jsonResponse(route, {});
  }
  if (method === 'DELETE' && /^\/api\/items\/\d+$/.test(path)) {
    return jsonResponse(route, {});
  }

  return jsonResponse(
    route,
    { error: `No mock for ${method} ${path}` },
    500,
  );
}

export async function mockApi(
  page: Page,
  overrides: ApiOverride[] = [],
): Promise<MockApiResult> {
  const requests: ApiRequestRecord[] = [];
  const matchCounts = new Map<ApiOverride, number>();

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const path = url.pathname;
    const rawBody = request.postData();
    let body: unknown = null;

    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }

    const record: ApiRequestRecord = {
      method,
      path,
      url: request.url(),
      body,
    };
    requests.push(record);

    for (const override of overrides) {
      if (!matchesOverride(override, method, path)) {
        continue;
      }
      const matchIndex = matchCounts.get(override) ?? 0;
      matchCounts.set(override, matchIndex + 1);
      await override.handle(route, record, matchIndex);
      return;
    }

    await handleDefault(route, record);
  });

  return { requests };
}
