import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/home.less';

interface Item {
  id: number;
  name: string;
  description?: string;
  price?: number;
}

interface ChristmasList {
  id: number;
  name: string;
  items: Item[];
}

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<ChristmasList | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemDesc, setItemDesc] = useState('');
  const [itemPrice, setItemPrice] = useState('');

  useEffect(() => {
    fetchLists();
  }, []);

  const fetchLists = async () => {
    const token = localStorage.getItem('token');
    const response = await fetch('/api/lists', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const lists: ChristmasList[] = await response.json();
      if (lists.length === 0) {
        // Create default list
        const createResponse = await fetch('/api/lists', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ name: 'My Christmas List' }),
        });
        if (createResponse.ok) {
          const newList = await createResponse.json();
          setList(newList);
        }
      } else {
        setList(lists[0]);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/');
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!list) return;
    const token = localStorage.getItem('token');
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
        listId: list.id,
      }),
    });
    if (response.ok) {
      setItemName('');
      setItemDesc('');
      setItemPrice('');
      fetchLists(); // Refresh
    }
  };

  return (
    <div className="home">
      <h1 className="home__title">🎅 Welcome Home! 🎅</h1>
      <p>Your Christmas List</p>
      {list && (
        <div>
          <h2>{list.name}</h2>
          <ul>
            {list.items?.map(item => (
              <li key={item.id}>
                {item.name} - {item.description} - ${item.price}
              </li>
            ))}
          </ul>
          <form onSubmit={handleAddItem}>
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
            <button type="submit">Add Item</button>
          </form>
        </div>
      )}
      <button onClick={handleLogout} className="home__button">Logout</button>
    </div>
  );
};

export default Home;