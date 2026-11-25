import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import jwtDecode from 'jwt-decode';
import {
  AppShell,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Spinner,
  confirmDialog,
  promptDialog,
  toast,
} from './components';
import { cx } from './lib/cx';
import styles from './pages/home.module.css';

interface Item {
  id: number;
  name: string;
  description?: string;
  price?: number;
  purchased?: boolean;
}

interface User {
  id: number;
  username: string;
}

interface ChristmasList {
  id: number;
  name: string;
  items: Item[];
  sharedWith?: User[];
  user?: User;
}

interface DecodedToken {
  username?: string;
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ChristmasList[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [loadingLists, setLoadingLists] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [addPending, setAddPending] = useState(false);
  const [shareUsername, setShareUsername] = useState('');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState('');

  const fetchUsers = async () => {
    const token = sessionStorage.getItem('token');
    const response = await fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const users: string[] = await response.json();
      setAllUsers(users);
    }
  };

  const fetchLists = async (showLoading = false) => {
    if (showLoading) {
      setLoadingLists(true);
    }
    setLoadError(null);

    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/lists', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const fetchedLists: ChristmasList[] = await response.json();
        setLists(fetchedLists);
        setSelectedListId((current) => {
          if (current !== null && fetchedLists.some((l) => l.id === current)) {
            return current;
          }
          const owned = fetchedLists.filter((l) => !l.user);
          return owned[0]?.id ?? fetchedLists[0]?.id ?? null;
        });
      } else {
        setLoadError('Could not load your lists.');
      }
    } catch {
      setLoadError('Could not load your lists.');
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      const decoded = jwtDecode<DecodedToken>(token);
      setCurrentUser(decoded.username || '');
    }
    fetchLists(true);
    fetchUsers();
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleCreateList = async () => {
    const token = sessionStorage.getItem('token');
    const response = await fetch('/api/lists', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: 'New List' }),
    });
    if (response.ok) {
      const created: { id: number; name: string } = await response.json();
      await fetchLists();
      setSelectedListId(created.id);
    }
  };

  const handleRenameList = async (list: ChristmasList) => {
    const newName = await promptDialog({
      title: 'Rename list',
      label: 'List name',
      defaultValue: list.name,
      required: true,
    });
    if (newName === null) {
      return;
    }
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/lists/${list.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ name: newName }),
    });
    if (response.ok) {
      setLists(
        lists.map((l) => (l.id === list.id ? { ...l, name: newName } : l)),
      );
    }
  };

  const handleDeleteList = async (list: ChristmasList) => {
    const confirmed = await confirmDialog({
      title: 'Delete list?',
      body: (
        <>
          Delete <strong>{list.name}</strong> and all of its items?
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/lists/${list.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      await fetchLists();
    }
  };

  const handleAddItem = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedList || selectedList.user) {
      return;
    }

    setAddPending(true);
    try {
      const token = sessionStorage.getItem('token');
      const response = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: itemName,
          description: itemDesc,
          price: parseFloat(itemPrice) || undefined,
          listId: selectedList.id,
        }),
      });
      if (response.ok) {
        const newItem: Item = await response.json();
        setLists(
          lists.map((list) =>
            list.id === selectedList.id
              ? { ...list, items: [...list.items, newItem] }
              : list,
          ),
        );
        setItemName('');
        setItemDesc('');
        setItemPrice('');
      }
    } finally {
      setAddPending(false);
    }
  };

  const handleEditItem = async (item: Item) => {
    const nameResult = await promptDialog({
      title: 'Edit item name',
      label: 'Name',
      defaultValue: item.name,
    });
    if (nameResult === null) {
      return;
    }
    const newName = nameResult || item.name;

    const descResult = await promptDialog({
      title: 'Edit item description',
      label: 'Description',
      defaultValue: item.description || '',
    });
    if (descResult === null) {
      return;
    }
    const newDesc = descResult || item.description;

    const priceResult = await promptDialog({
      title: 'Edit item price',
      label: 'Price',
      defaultValue: item.price?.toString() || '',
    });
    if (priceResult === null) {
      return;
    }
    const newPrice = priceResult || item.price;

    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/items/${item.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: newName,
        description: newDesc,
        price: newPrice ? parseFloat(newPrice as string) : undefined,
      }),
    });
    if (response.ok) {
      const updatedItem: Item = await response.json();
      setLists(
        lists.map((list) => ({
          ...list,
          items: list.items.map((i) => (i.id === item.id ? updatedItem : i)),
        })),
      );
    }
  };

  const handleDeleteItem = async (item: Item) => {
    const confirmed = await confirmDialog({
      title: 'Delete item?',
      body: (
        <>
          Delete <strong>{item.name}</strong> from this list?
        </>
      ),
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    const token = sessionStorage.getItem('token');
    await fetch(`/api/items/${item.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setLists(
      lists.map((list) => ({
        ...list,
        items: list.items.filter((i) => i.id !== item.id),
      })),
    );
  };

  const handleTogglePurchased = async (item: Item, purchased: boolean) => {
    const token = sessionStorage.getItem('token');
    await fetch(`/api/items/${item.id}/purchase`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ purchased }),
    });
    fetchLists();
  };

  const handleShare = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedList || selectedList.user) {
      return;
    }
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/lists/${selectedList.id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: shareUsername }),
    });
    if (response.ok) {
      setShareUsername('');
      fetchLists();
      toast.success('List shared');
    } else {
      toast.error('Could not share the list');
    }
  };

  const handleShareAll = async () => {
    if (!selectedList || selectedList.user) {
      return;
    }
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/lists/${selectedList.id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: 'all' }),
    });
    if (response.ok) {
      fetchLists();
      toast.success('Shared with everyone');
    } else {
      toast.error('Could not share the list');
    }
  };

  const handleRemoveShare = async (user: User) => {
    if (!selectedList || selectedList.user) {
      return;
    }
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/lists/${selectedList.id}/unshare`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: user.username }),
    });
    if (response.ok) {
      setLists(
        lists.map((list) =>
          list.id === selectedList.id
            ? {
                ...list,
                sharedWith: list.sharedWith?.filter((u) => u.id !== user.id),
              }
            : list,
        ),
      );
    }
  };

  const handleRetry = () => {
    void fetchLists(true);
    void fetchUsers();
  };

  const ownedLists = lists.filter((list) => !list.user);
  const sharedLists = lists.filter((list) => list.user);
  const selectedList =
    lists.find((list) => list.id === selectedListId) ?? null;
  const selectedIsOwned = selectedList != null && !selectedList.user;
  const sortedItems = selectedList
    ? [...selectedList.items].sort((a, b) => a.id - b.id)
    : [];

  return (
    <AppShell
      username={currentUser}
      listCount={lists.length}
      onLogout={handleLogout}
    >
      <main className={styles.main}>
        {loadingLists ? (
          <div className={styles.loadingState}>
            <Spinner size={24} label="Loading lists" />
          </div>
        ) : loadError ? (
          <Card className={styles.errorCard} role="alert">
            <p className={styles.errorText}>{loadError}</p>
            <Button variant="secondary" onClick={handleRetry}>
              Try again
            </Button>
          </Card>
        ) : (
          <div className={styles.content}>
            <nav className={styles.rail} aria-label="Lists">
              <section className={styles.group}>
                <div className={styles.groupHeader}>
                  <h2 className={styles.groupTitle}>My lists</h2>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      void handleCreateList();
                    }}
                  >
                    New list
                  </Button>
                </div>
                {ownedLists.length === 0 ? (
                  <p className={styles.emptyGroup}>No lists yet</p>
                ) : (
                  ownedLists.map((list) => {
                    const selected = list.id === selectedListId;
                    return (
                      <div
                        key={list.id}
                        className={cx(
                          styles.railItem,
                          selected && styles.railItemSelected,
                        )}
                      >
                        <button
                          type="button"
                          className={styles.railButton}
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => setSelectedListId(list.id)}
                        >
                          <span className={styles.railName}>{list.name}</span>
                        </button>
                        <div className={styles.rowActions}>
                          <IconButton
                            label={`Rename ${list.name}`}
                            icon="edit"
                            size="sm"
                            onClick={() => {
                              void handleRenameList(list);
                            }}
                          />
                          <IconButton
                            label={`Delete ${list.name}`}
                            icon="trash"
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              void handleDeleteList(list);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
              <section className={styles.group}>
                <h2 className={styles.groupTitle}>Shared with me</h2>
                {sharedLists.length === 0 ? (
                  <p className={styles.emptyGroup}>No lists yet</p>
                ) : (
                  sharedLists.map((list) => {
                    const selected = list.id === selectedListId;
                    return (
                      <div
                        key={list.id}
                        className={cx(
                          styles.railItem,
                          selected && styles.railItemSelected,
                        )}
                      >
                        <button
                          type="button"
                          className={styles.railButton}
                          aria-current={selected ? 'true' : undefined}
                          onClick={() => setSelectedListId(list.id)}
                        >
                          <span className={styles.railName}>{list.name}</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </section>
            </nav>

            {lists.length > 0 ? (
              <div className={styles.mobileSelect}>
                <Select
                  aria-label="Selected list"
                  value={selectedListId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedListId(value ? Number(value) : null);
                  }}
                >
                  {ownedLists.length > 0 ? (
                    <optgroup label="My lists">
                      {ownedLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {sharedLists.length > 0 ? (
                    <optgroup label="Shared with me">
                      {sharedLists.map((list) => (
                        <option key={list.id} value={list.id}>
                          {list.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </Select>
              </div>
            ) : null}

            <section className={styles.panel}>
              {lists.length === 0 ? (
                <Card padding="none" className={styles.emptyCard}>
                  <EmptyState
                    title="Create your first list"
                    body="Start a list for gifts, groceries, or anything else."
                    action={
                      <Button
                        onClick={() => {
                          void handleCreateList();
                        }}
                      >
                        Create list
                      </Button>
                    }
                  />
                </Card>
              ) : selectedList ? (
                <>
                  <div className={styles.panelHeader}>
                    <div className={styles.panelTitleGroup}>
                      <h2 className={styles.panelTitle}>{selectedList.name}</h2>
                      {selectedList.user ? (
                        <span className={styles.badge}>
                          Shared by {selectedList.user.username}
                        </span>
                      ) : null}
                      <span className={styles.itemCount}>
                        {selectedList.items.length} items
                      </span>
                    </div>
                    {selectedIsOwned ? (
                      <div className={styles.panelActions}>
                        <IconButton
                          label={`Rename ${selectedList.name}`}
                          icon="edit"
                          onClick={() => {
                            void handleRenameList(selectedList);
                          }}
                        />
                        <IconButton
                          label={`Delete ${selectedList.name}`}
                          icon="trash"
                          variant="danger"
                          onClick={() => {
                            void handleDeleteList(selectedList);
                          }}
                        />
                      </div>
                    ) : null}
                  </div>

                  {selectedIsOwned ? (
                    <Card
                      className={styles.addCard}
                      header={<h3 className={styles.cardTitle}>Add item</h3>}
                    >
                      <form className={styles.addForm} onSubmit={handleAddItem}>
                        <div className={styles.addFields}>
                          <Field
                            className={styles.addFieldWide}
                            label="Name"
                            htmlFor="item-name"
                            required
                          >
                            <Input
                              id="item-name"
                              type="text"
                              placeholder="Item name"
                              value={itemName}
                              onChange={(event) =>
                                setItemName(event.target.value)
                              }
                              required
                            />
                          </Field>
                          <Field label="Description" htmlFor="item-description">
                            <Input
                              id="item-description"
                              type="text"
                              placeholder="Description"
                              value={itemDesc}
                              onChange={(event) =>
                                setItemDesc(event.target.value)
                              }
                            />
                          </Field>
                          <Field label="Price" htmlFor="item-price">
                            <Input
                              id="item-price"
                              type="number"
                              placeholder="Price"
                              value={itemPrice}
                              onChange={(event) =>
                                setItemPrice(event.target.value)
                              }
                              step="0.01"
                            />
                          </Field>
                        </div>
                        <Button
                          type="submit"
                          variant="primary"
                          loading={addPending}
                          disabled={addPending}
                        >
                          Add item
                        </Button>
                      </form>
                    </Card>
                  ) : null}

                  {sortedItems.length === 0 ? (
                    <Card padding="none" className={styles.emptyCard}>
                      <EmptyState
                        title="No items yet"
                        body={
                          selectedIsOwned
                            ? 'Add the first gift to this list.'
                            : 'This list is still empty.'
                        }
                      />
                    </Card>
                  ) : (
                    <Card
                      header={<h3 className={styles.cardTitle}>Items</h3>}
                      padding="sm"
                    >
                      <ul className={styles.itemList}>
                        {sortedItems.map((item) => (
                          <li
                            key={item.id}
                            className={cx(
                              styles.itemRow,
                              item.purchased && styles.itemRowPurchased,
                            )}
                          >
                            <div className={styles.itemRowMain}>
                              {!selectedIsOwned ? (
                                <Checkbox
                                  className={styles.purchaseCheckbox}
                                  label={
                                    <span className={styles.srOnly}>
                                      Mark {item.name} as purchased
                                    </span>
                                  }
                                  checked={item.purchased || false}
                                  onChange={(event) => {
                                    void handleTogglePurchased(
                                      item,
                                      event.target.checked,
                                    );
                                  }}
                                />
                              ) : null}
                              <div className={styles.itemText}>
                                <span
                                  className={cx(
                                    styles.itemName,
                                    item.purchased && styles.itemNamePurchased,
                                  )}
                                >
                                  {item.name}
                                </span>
                                {item.description ? (
                                  <span className={styles.itemDescription}>
                                    {item.description}
                                  </span>
                                ) : null}
                              </div>
                              {item.price ? (
                                <span className={styles.itemPrice}>
                                  ${item.price}
                                </span>
                              ) : null}
                              {selectedIsOwned ? (
                                <div className={styles.itemActions}>
                                  <IconButton
                                    label={`Edit ${item.name}`}
                                    icon="edit"
                                    size="sm"
                                    onClick={() => {
                                      void handleEditItem(item);
                                    }}
                                  />
                                  <IconButton
                                    label={`Delete ${item.name}`}
                                    icon="trash"
                                    size="sm"
                                    variant="danger"
                                    onClick={() => {
                                      void handleDeleteItem(item);
                                    }}
                                  />
                                </div>
                              ) : null}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}

                  {selectedIsOwned ? (
                    <Card
                      className={styles.shareCard}
                      header={<h3 className={styles.cardTitle}>Share</h3>}
                    >
                      <form className={styles.shareForm} onSubmit={handleShare}>
                        <Field label="Share with" htmlFor="share-user">
                          <Select
                            id="share-user"
                            value={shareUsername}
                            onChange={(event) =>
                              setShareUsername(event.target.value)
                            }
                          >
                            <option value="">Select user</option>
                            {allUsers
                              .filter((user) => user !== currentUser)
                              .map((user) => (
                                <option key={user} value={user}>
                                  {user}
                                </option>
                              ))}
                          </Select>
                        </Field>
                        <Button type="submit" variant="secondary">
                          Share
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            void handleShareAll();
                          }}
                        >
                          Share all
                        </Button>
                      </form>
                      {selectedList.sharedWith &&
                      selectedList.sharedWith.length > 0 ? (
                        <div className={styles.chips}>
                          {selectedList.sharedWith.map((user) => (
                            <span key={user.id} className={styles.chip}>
                              {user.username}
                              <IconButton
                                label={`Remove ${user.username}`}
                                icon="x"
                                size="sm"
                                onClick={() => {
                                  void handleRemoveShare(user);
                                }}
                              />
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </Card>
                  ) : null}
                </>
              ) : (
                <Card padding="none" className={styles.emptyCard}>
                  <EmptyState
                    title="Select a list"
                    body="Choose a list from the rail or picker."
                  />
                </Card>
              )}
            </section>
          </div>
        )}
      </main>
    </AppShell>
  );
};

export default Home;
