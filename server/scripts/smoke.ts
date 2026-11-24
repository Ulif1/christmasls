/**
 * Black-box HTTP smoke test for the Christmas list API.
 *
 * Deliberately imports nothing from `server/src`: it exercises the server the
 * same way the browser does. Run with the server already listening:
 *
 *   BASE_URL=http://localhost:3001 npm run smoke
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3001';

interface CallOptions {
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

interface CallResult {
  status: number;
  json: any;
  text: string;
}

let leaked = false;

/** Recursively rejects any `password`/`passwordHash` key at any depth. */
function containsPasswordKey(value: unknown, seen: Set<unknown> = new Set()): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((entry) => containsPasswordKey(entry, seen));
  }

  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) => /^password(hash)?$/i.test(key) || containsPasswordKey(entry, seen),
  );
}

async function call(method: string, path: string, options: CallOptions = {}): Promise<CallResult> {
  const headers: Record<string, string> = { ...(options.headers ?? {}) };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json';
    body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${BASE}${path}`, { method, headers, body });
    const text = await response.text();

    let json: any;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }

    if (json !== undefined && containsPasswordKey(json)) {
      leaked = true;
    }

    return { status: response.status, json, text };
  } catch (error) {
    // Keep the run alive so every assertion is reported.
    return {
      status: 0,
      json: undefined,
      text: error instanceof Error ? error.message : String(error),
    };
  }
}

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`✓ ${label}`);
  } else {
    failed += 1;
    console.log(`✗ ${label}${detail ? ` (${detail})` : ''}`);
  }
}

async function main(): Promise<void> {
  const stamp = Date.now().toString(36);
  const userA = `smoke_a_${stamp}`;
  const userB = `smoke_b_${stamp}`;
  const userC = `smoke_c_${stamp}`;
  const password = 'smoke-pass-123';

  // 1
  const health = await call('GET', '/api/health');
  check(
    'health returns ok',
    health.status === 200 && health.json?.status === 'ok' && health.json?.message === 'Server is running',
    `${health.status}`,
  );

  // 2
  const noToken = await call('GET', '/api/lists');
  check(
    'GET /lists without a token is 401 No token',
    noToken.status === 401 && noToken.json?.message === 'No token',
    `${noToken.status}`,
  );

  // 3
  const badToken = await call('GET', '/api/lists', { token: 'garbage' });
  check(
    'GET /lists with a garbage token is 401 Invalid token',
    badToken.status === 401 && badToken.json?.message === 'Invalid token',
    `${badToken.status}`,
  );

  // 4
  const registerA = await call('POST', '/api/register', { body: { username: userA, password } });
  check(
    'register A succeeds',
    registerA.status === 200 && registerA.json?.message === 'User registered',
    `${registerA.status}`,
  );

  // 5
  const duplicateA = await call('POST', '/api/register', { body: { username: userA, password } });
  check(
    'registering A twice is 400',
    duplicateA.status === 400 && duplicateA.json?.message === 'User already exists or error',
    `${duplicateA.status}`,
  );

  // 6
  const wrongLogin = await call('POST', '/api/login', {
    body: { username: userA, password: 'definitely-wrong' },
  });
  check(
    'login with the wrong password is 401',
    wrongLogin.status === 401 && wrongLogin.json?.message === 'Invalid credentials',
    `${wrongLogin.status}`,
  );

  // 7
  const loginA = await call('POST', '/api/login', { body: { username: userA, password } });
  const tokenA = loginA.json?.token;
  check(
    'login A returns a token',
    loginA.status === 200 && loginA.json?.message === 'Login successful' && typeof tokenA === 'string',
    `${loginA.status}`,
  );

  // Setup only: register and log in B and C, and give B an owned list.
  await call('POST', '/api/register', { body: { username: userB, password } });
  await call('POST', '/api/register', { body: { username: userC, password } });
  const loginB = await call('POST', '/api/login', { body: { username: userB, password } });
  const loginC = await call('POST', '/api/login', { body: { username: userC, password } });
  const tokenB = loginB.json?.token;
  const tokenC = loginC.json?.token;
  const listB = await call('POST', '/api/lists', { token: tokenB, body: { name: 'Smoke B list' } });
  const listBId = listB.json?.id;

  // 8
  const createList = await call('POST', '/api/lists', {
    token: tokenA,
    body: { name: 'Smoke A list' },
  });
  const listId = createList.json?.id;
  check(
    'POST /lists returns {id,name} without a user key',
    createList.status === 200 &&
      typeof listId === 'number' &&
      typeof createList.json?.name === 'string' &&
      !('user' in (createList.json ?? {})),
    `${createList.status}`,
  );

  // 9
  const listsA = await call('GET', '/api/lists', { token: tokenA });
  const entriesA: any[] = Array.isArray(listsA.json) ? listsA.json : [];
  const ownedEntry = entriesA.find((entry) => entry.id === listId);
  check(
    'GET /lists A shows the owned list once, without a user key',
    listsA.status === 200 &&
      Array.isArray(listsA.json) &&
      entriesA.filter((entry) => entry.id === listId).length === 1 &&
      ownedEntry !== undefined &&
      !('user' in ownedEntry) &&
      Array.isArray(ownedEntry.items) &&
      Array.isArray(ownedEntry.sharedWith) &&
      new Set(entriesA.map((entry) => entry.id)).size === entriesA.length,
    `${listsA.status}`,
  );

  // 10
  const createItem = await call('POST', '/api/items', {
    token: tokenA,
    body: { name: 'Smoke item', description: 'initial', price: 12.34, listId },
  });
  const itemId = createItem.json?.id;
  check(
    'POST /items returns a numeric price of 12.34',
    createItem.status === 200 &&
      typeof createItem.json?.price === 'number' &&
      createItem.json?.price === 12.34,
    `${createItem.status}`,
  );

  // 11
  const listsAfterItem = await call('GET', '/api/lists', { token: tokenA });
  const itemList = (Array.isArray(listsAfterItem.json) ? listsAfterItem.json : []).find(
    (entry: any) => entry.id === listId,
  );
  const roundTripItem = itemList?.items?.find((item: any) => item.id === itemId);
  check(
    'GET /lists decodes the item price back to a number',
    listsAfterItem.status === 200 &&
      roundTripItem !== undefined &&
      typeof roundTripItem.price === 'number' &&
      roundTripItem.price === 12.34,
    `${listsAfterItem.status}`,
  );

  // 12
  const noPrice = await call('POST', '/api/items', {
    token: tokenA,
    body: { name: 'Priceless item', listId },
  });
  check(
    'POST /items without a price stores null',
    noPrice.status === 200 && noPrice.json?.price === null,
    `${noPrice.status}`,
  );

  // 13
  const foreignItem = await call('POST', '/api/items', {
    token: tokenA,
    body: { name: 'Foreign item', listId: listBId },
  });
  check(
    "POST /items into another user's list is 404",
    foreignItem.status === 404 && foreignItem.json?.message === 'List not found',
    `${foreignItem.status}`,
  );

  // 14
  const updateByC = await call('PUT', `/api/items/${itemId}`, {
    token: tokenC,
    body: { name: 'Hijacked' },
  });
  check(
    'PUT /items/:id as a non-owner is 403',
    updateByC.status === 403 && updateByC.json?.message === 'Not authorized',
    `${updateByC.status}`,
  );

  // 15
  const updateByA = await call('PUT', `/api/items/${itemId}`, {
    token: tokenA,
    body: { name: 'Renamed item', price: 99.5 },
  });
  check(
    'PUT /items/:id as the owner updates name and price',
    updateByA.status === 200 &&
      updateByA.json?.name === 'Renamed item' &&
      typeof updateByA.json?.price === 'number' &&
      updateByA.json?.price === 99.5,
    `${updateByA.status}`,
  );

  // 16
  const ownerPurchase = await call('PUT', `/api/items/${itemId}/purchase`, {
    token: tokenA,
    body: { purchased: true },
  });
  check(
    'purchasing as the list owner is 403',
    ownerPurchase.status === 403 && ownerPurchase.json?.message === 'Not authorized',
    `${ownerPurchase.status}`,
  );

  // 17
  const selfShare = await call('POST', `/api/lists/${listId}/share`, {
    token: tokenA,
    body: { username: userA },
  });
  check(
    'sharing with yourself is 400',
    selfShare.status === 400 &&
      typeof selfShare.json?.message === 'string' &&
      selfShare.json.message.toLowerCase().includes('yourself'),
    `${selfShare.status}`,
  );

  // 18
  const shareB = await call('POST', `/api/lists/${listId}/share`, {
    token: tokenA,
    body: { username: userB },
  });
  const shareBAgain = await call('POST', `/api/lists/${listId}/share`, {
    token: tokenA,
    body: { username: userB },
  });
  check(
    'sharing with B is idempotent',
    shareB.status === 200 &&
      shareB.json?.message === 'List shared' &&
      shareBAgain.status === 200 &&
      shareBAgain.json?.message === 'List shared',
    `${shareB.status}/${shareBAgain.status}`,
  );

  // 19
  const listsB = await call('GET', '/api/lists', { token: tokenB });
  const sharedForB = (Array.isArray(listsB.json) ? listsB.json : []).find(
    (entry: any) => entry.id === listId,
  );
  check(
    'GET /lists B shows the shared list with user {id,username}',
    listsB.status === 200 &&
      sharedForB !== undefined &&
      sharedForB.user !== undefined &&
      Object.keys(sharedForB.user).sort().join(',') === 'id,username' &&
      Array.isArray(sharedForB.items) &&
      Array.isArray(sharedForB.sharedWith),
    `${listsB.status}`,
  );

  // 20
  const listsAAgain = await call('GET', '/api/lists', { token: tokenA });
  const entriesAAgain: any[] = Array.isArray(listsAAgain.json) ? listsAAgain.json : [];
  const ownedAgain = entriesAAgain.find((entry) => entry.id === listId);
  check(
    'GET /lists A still shows one owned entry without a user key',
    listsAAgain.status === 200 &&
      entriesAAgain.filter((entry) => entry.id === listId).length === 1 &&
      ownedAgain !== undefined &&
      !('user' in ownedAgain),
    `${listsAAgain.status}`,
  );

  // 21
  const purchaseB = await call('PUT', `/api/items/${itemId}/purchase`, {
    token: tokenB,
    body: { purchased: true },
  });
  const purchaseBAgain = await call('PUT', `/api/items/${itemId}/purchase`, {
    token: tokenB,
    body: { purchased: true },
  });
  check(
    'shared user B can purchase, twice',
    purchaseB.status === 200 &&
      purchaseB.json?.purchased === true &&
      purchaseBAgain.status === 200 &&
      purchaseBAgain.json?.purchased === true,
    `${purchaseB.status}/${purchaseBAgain.status}`,
  );

  // 22
  const purchaseC = await call('PUT', `/api/items/${itemId}/purchase`, {
    token: tokenC,
    body: { purchased: true },
  });
  check(
    'purchasing as unrelated C is 403',
    purchaseC.status === 403 && purchaseC.json?.message === 'Not authorized',
    `${purchaseC.status}`,
  );

  // 23
  const updateByB = await call('PUT', `/api/items/${itemId}`, {
    token: tokenB,
    body: { name: 'Nope' },
  });
  check(
    'PUT /items/:id as a shared reader is 403',
    updateByB.status === 403,
    `${updateByB.status}`,
  );

  // 24
  const deleteByB = await call('DELETE', `/api/items/${itemId}`, { token: tokenB });
  check(
    'DELETE /items/:id as a shared reader is 403',
    deleteByB.status === 403 && deleteByB.json?.message === 'Not authorized',
    `${deleteByB.status}`,
  );

  // 25
  const users = await call('GET', '/api/users', { token: tokenA });
  check(
    'GET /users returns a string[] containing A and B',
    users.status === 200 &&
      Array.isArray(users.json) &&
      users.json.every((entry: unknown) => typeof entry === 'string') &&
      users.json.includes(userA) &&
      users.json.includes(userB),
    `${users.status}`,
  );

  // 26
  const shareAll = await call('POST', `/api/lists/${listId}/share`, {
    token: tokenA,
    body: { username: 'all' },
  });
  const shareAllAgain = await call('POST', `/api/lists/${listId}/share`, {
    token: tokenA,
    body: { username: 'all' },
  });
  const listsC = await call('GET', '/api/lists', { token: tokenC });
  const sharedForC = (Array.isArray(listsC.json) ? listsC.json : []).filter(
    (entry: any) => entry.id === listId,
  );
  const cEntry = sharedForC[0];
  const sharedIds: number[] = Array.isArray(cEntry?.sharedWith)
    ? cEntry.sharedWith.map((member: any) => member.id)
    : [];
  check(
    'sharing with all reaches C once and excludes the owner',
    shareAll.status === 200 &&
      shareAll.json?.message === 'List shared with all users' &&
      shareAllAgain.status === 200 &&
      shareAllAgain.json?.message === 'List shared with all users' &&
      sharedForC.length === 1 &&
      cEntry?.user !== undefined &&
      new Set(sharedIds).size === sharedIds.length &&
      !sharedIds.includes(cEntry?.user?.id),
    `${shareAll.status}/${shareAllAgain.status}`,
  );

  // 27
  const unshareB = await call('POST', `/api/lists/${listId}/unshare`, {
    token: tokenA,
    body: { username: userB },
  });
  const unshareBAgain = await call('POST', `/api/lists/${listId}/unshare`, {
    token: tokenA,
    body: { username: userB },
  });
  const listsBAfter = await call('GET', '/api/lists', { token: tokenB });
  const stillSharedForB = (Array.isArray(listsBAfter.json) ? listsBAfter.json : []).some(
    (entry: any) => entry.id === listId,
  );
  check(
    'unsharing B is idempotent and removes the list from B',
    unshareB.status === 200 &&
      unshareB.json?.message === 'Sharing removed' &&
      unshareBAgain.status === 200 &&
      !stillSharedForB,
    `${unshareB.status}/${unshareBAgain.status}`,
  );

  // 28
  const renameByB = await call('PUT', `/api/lists/${listId}`, {
    token: tokenB,
    body: { name: 'Nope' },
  });
  const renameByA = await call('PUT', `/api/lists/${listId}`, {
    token: tokenA,
    body: { name: 'Renamed list' },
  });
  check(
    'renaming is owner-only',
    renameByB.status === 404 &&
      renameByA.status === 200 &&
      renameByA.json?.id === listId &&
      renameByA.json?.name === 'Renamed list',
    `${renameByB.status}/${renameByA.status}`,
  );

  // 29
  const deleteListByB = await call('DELETE', `/api/lists/${listId}`, { token: tokenB });
  const deleteListByA = await call('DELETE', `/api/lists/${listId}`, { token: tokenA });
  const purchaseDeletedItem = await call('PUT', `/api/items/${itemId}/purchase`, {
    token: tokenC,
    body: { purchased: true },
  });
  check(
    'deleting the list is owner-only and cascades its items',
    deleteListByB.status === 404 &&
      deleteListByA.status === 200 &&
      deleteListByA.json?.message === 'List deleted' &&
      purchaseDeletedItem.status === 404 &&
      purchaseDeletedItem.json?.message === 'Item not found',
    `${deleteListByB.status}/${deleteListByA.status}/${purchaseDeletedItem.status}`,
  );

  // 30
  const spareList = await call('POST', '/api/lists', {
    token: tokenA,
    body: { name: 'Spare list' },
  });
  const spareId = spareList.json?.id;
  const unknownUsername = `no_such_user_${stamp}`;
  const unknownShare = await call('POST', `/api/lists/${spareId}/share`, {
    token: tokenA,
    body: { username: unknownUsername },
  });
  const unknownUnshare = await call('POST', `/api/lists/${spareId}/unshare`, {
    token: tokenA,
    body: { username: unknownUsername },
  });
  check(
    'sharing or unsharing an unknown user is 404 User not found',
    unknownShare.status === 404 &&
      unknownShare.json?.message === 'User not found' &&
      unknownUnshare.status === 404 &&
      unknownUnshare.json?.message === 'User not found',
    `${unknownShare.status}/${unknownUnshare.status}`,
  );

  // 31
  const missingList = await call('PUT', '/api/lists/999999999', {
    token: tokenA,
    body: { name: 'x' },
  });
  check(
    'renaming a missing list is 404 List not found',
    missingList.status === 404 && missingList.json?.message === 'List not found',
    `${missingList.status}`,
  );

  // 32
  const emptyRegister = await call('POST', '/api/register', { body: {} });
  check(
    'registering with an empty body is 400 and does not crash',
    emptyRegister.status === 400,
    `${emptyRegister.status}`,
  );

  // 33
  const bodylessList = await call('POST', '/api/lists', { token: tokenA });
  const healthAfter = await call('GET', '/api/health');
  check(
    'a bodyless POST /lists does not kill the server',
    bodylessList.status < 500 && healthAfter.status === 200 && healthAfter.json?.status === 'ok',
    `${bodylessList.status}/${healthAfter.status}`,
  );

  if (leaked) {
    failed += 1;
    console.log('✗ no response contains a password key at any depth');
  }

  console.log(`smoke: ${passed} passed, ${failed} failed`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((error: unknown) => {
  console.error('smoke: unexpected failure', error);
  process.exitCode = 1;
});
