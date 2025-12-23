import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jwtDecode from 'jwt-decode';
import './styles/home.less';

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

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [lists, setLists] = useState<ChristmasList[]>([]);
  const [selectedOwnedList, setSelectedOwnedList] = useState<ChristmasList | null>(null);
  const [activeSharedTab, setActiveSharedTab] = useState<number>(0);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');
  const [shareUsername, setShareUsername] = useState('');
  const [renameName, setRenameName] = useState('');
  const [allUsers, setAllUsers] = useState<string[]>([]);
  const [currentUser, setCurrentUser] = useState<string>('');

  useEffect(() => {
    const token = sessionStorage.getItem('token');
    if (token) {
      const decoded: any = jwtDecode(token);
      setCurrentUser(decoded.username || '');
    }
    fetchLists();
    fetchUsers();
  }, []);

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

  const fetchLists = async () => {
    const token = sessionStorage.getItem('token');
    const response = await fetch('/api/lists', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const fetchedLists: ChristmasList[] = await response.json();
      setLists(fetchedLists);
      const owned = fetchedLists.filter(l => !l.user);
      if (owned.length > 0 && !selectedOwnedList) {
        setSelectedOwnedList(owned[0]);
      }
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    navigate('/');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnedList) return;
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
        listId: selectedOwnedList.id,
      }),
    });
    if (response.ok) {
      const newItem = await response.json();
      setLists(lists.map(list =>
        list.id === selectedOwnedList.id
          ? { ...list, items: [...list.items, newItem] }
          : list
      ));
      setSelectedOwnedList({ ...selectedOwnedList, items: [...selectedOwnedList.items, newItem] });
      setItemName('');
      setItemDesc('');
      setItemPrice('');
    }
  };

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOwnedList) return;
    const token = sessionStorage.getItem('token');
    const response = await fetch(`/api/lists/${selectedOwnedList.id}/share`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ username: shareUsername }),
    });
    if (response.ok) {
      setShareUsername('');
      fetchLists(); // Refresh to update sharedWith
      alert('List shared');
    } else {
      alert('Failed to share');
    }
  };

  const ownedLists = lists.filter(list => !list.user);
  const sharedLists = lists.filter(list => list.user);

  return (
    <div className="home">
      <h1 className="home__title">🎅 Welcome Home! 🎅</h1>
      <div className="home__columns">
        <div>
          <h2>My Lists</h2>
          {ownedLists.map(list => (
            <div key={list.id} style={{ display: 'flex', alignItems: 'center', margin: '5px' }}>
              <button onClick={() => setSelectedOwnedList(list)} className={`home__tab-button ${selectedOwnedList?.id === list.id ? 'home__tab-button--active' : ''}`} style={{ flex: 1 }}>
                {list.name}
              </button>
              <button onClick={async () => {
                const newName = prompt('New name:', list.name);
                if (newName) {
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
                    setLists(lists.map(l => l.id === list.id ? { ...l, name: newName } : l));
                    if (selectedOwnedList?.id === list.id) {
                      setSelectedOwnedList({ ...selectedOwnedList, name: newName });
                    }
                  }
                }
              }} className="home__edit-button" style={{ marginLeft: '5px' }}>✏️</button>
              <button onClick={async () => {
                if (window.confirm('Delete this list?')) {
                  const token = sessionStorage.getItem('token');
                  const response = await fetch(`/api/lists/${list.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                  });
                  if (response.ok) {
                    fetchLists();
                    if (selectedOwnedList?.id === list.id) {
                      setSelectedOwnedList(null);
                    }
                  }
                }
              }} className="home__delete-button" style={{ marginLeft: '5px' }}>❌</button>
            </div>
          ))}
          <button onClick={async () => {
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
              fetchLists();
            }
          }} className="home__create-button">🎄 Create New List 🎄</button>
          {selectedOwnedList && (
            <div>
              <div>
                {selectedOwnedList.items?.sort((a, b) => a.id - b.id).map(item => (
                  <div key={item.id} className="home__list-item">
                    <div className="home__item-text">
                      {item.name} - {item.description}{!!item.price && ` - $${item.price}`}
                    </div>
                    <div className="home__item-buttons">
                      <button onClick={async () => {
                        const newName = prompt('New name:', item.name) || item.name;
                        const newDesc = prompt('New description:', item.description || '') || item.description;
                        const newPrice = prompt('New price:', item.price?.toString() || '') || item.price;
                        const token = sessionStorage.getItem('token');
                        const response = await fetch(`/api/items/${item.id}`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ name: newName, description: newDesc, price: newPrice ? parseFloat(newPrice as string) : undefined }),
                        });
                        if (response.ok) {
                          const updatedItem = await response.json();
                          setLists(lists.map(list => ({
                            ...list,
                            items: list.items.map(i => i.id === item.id ? updatedItem : i)
                          })));
                          if (selectedOwnedList) {
                            setSelectedOwnedList({
                              ...selectedOwnedList,
                              items: selectedOwnedList.items.map(i => i.id === item.id ? updatedItem : i)
                            });
                          }
                        }
                      }} className="home__edit-button">✏️</button>
                      <button onClick={async () => {
                        if (window.confirm('Delete this item?')) {
                          const token = sessionStorage.getItem('token');
                          await fetch(`/api/items/${item.id}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          setLists(lists.map(list => ({
                            ...list,
                            items: list.items.filter(i => i.id !== item.id)
                          })));
                          if (selectedOwnedList) {
                            setSelectedOwnedList({
                              ...selectedOwnedList,
                              items: selectedOwnedList.items.filter(i => i.id !== item.id)
                            });
                          }
                        }
                      }} className="home__delete-button">❌</button>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleAddItem} className="home__form">
                <input
                  type="text"
                  placeholder="Item name"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  required
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={itemDesc}
                  onChange={(e) => setItemDesc(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Price"
                  value={itemPrice}
                  onChange={(e) => setItemPrice(e.target.value)}
                  step="0.01"
                />
                <button type="submit" className="home__button">Add Item</button>
              </form>
              <form onSubmit={handleShare} className="home__form">
                <select
                  value={shareUsername}
                  onChange={(e) => setShareUsername(e.target.value)}
                >
                  <option value="">Select user</option>
                  {allUsers.filter(u => u !== currentUser).map(user => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
                <button type="submit" className="home__button">Share</button>
              </form>
              <button onClick={async () => {
                const token = sessionStorage.getItem('token');
                const response = await fetch(`/api/lists/${selectedOwnedList.id}/share`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({ username: 'all' }),
                });
                if (response.ok) {
                  fetchLists();
                  alert('Shared with all users');
                } else {
                  alert('Failed to share');
                }
              }} className="home__button">Share to All Users</button>
              <div>
                <h4>Shared with:</h4>
                {selectedOwnedList.sharedWith?.map(user => (
                  <div key={user.id} className="home__shared-user">
                    {user.username}
                    <button onClick={async () => {
                      const token = sessionStorage.getItem('token');
                      const response = await fetch(`/api/lists/${selectedOwnedList.id}/unshare`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ username: user.username }),
                      });
                      if (response.ok) {
                        const updatedSharedWith = selectedOwnedList.sharedWith?.filter(u => u.id !== user.id);
                        setLists(lists.map(list => list.id === selectedOwnedList.id ? { ...list, sharedWith: updatedSharedWith } : list));
                        setSelectedOwnedList({ ...selectedOwnedList, sharedWith: updatedSharedWith });
                      }
                    }} className="home__button" style={{ background: 'linear-gradient(145deg, #dc3545, #c82333)', marginLeft: '10px' }}>Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <h2>Shared Lists</h2>
          <div>
            {sharedLists.map((list, index) => (
              <button key={list.id} onClick={() => setActiveSharedTab(index)} className={`home__tab-button ${activeSharedTab === index ? 'home__tab-button--active' : ''}`}>
                {list.name} (by {list.user?.username})
              </button>
            ))}
          </div>
          {sharedLists[activeSharedTab] && (
            <div>
              <h3>{sharedLists[activeSharedTab].name} (by {sharedLists[activeSharedTab].user?.username})</h3>
              <ul>
                {sharedLists[activeSharedTab].items?.sort((a, b) => a.id - b.id).map(item => (
                  <li key={item.id} className="home__list-item">
                    <input
                      type="checkbox"
                      checked={item.purchased || false}
                      onChange={async (e) => {
                        const token = sessionStorage.getItem('token');
                        await fetch(`/api/items/${item.id}/purchase`, {
                          method: 'PUT',
                          headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({ purchased: e.target.checked }),
                        });
                        fetchLists(); // Refresh
                      }}
                    />
                    {item.name} - {item.description}{!!item.price && ` - $${item.price}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <button onClick={handleLogout} className="home__button">Logout</button>
    </div>
  );
};

export default Home;