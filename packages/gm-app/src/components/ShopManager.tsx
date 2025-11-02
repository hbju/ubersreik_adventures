import React, { useState, useMemo } from 'react';
import { Armor, Weapon, Item } from '@wfrp/shared';
import { ArmorData, WeaponData, ItemData } from '@wfrp/shared';
import styles from './ShopManager.module.css';
import useLocalStorageState from '@/hooks/useLocalStorageState';

type ShopItem = (Armor | Weapon | Item) & { category: 'armor' | 'weapon' | 'item' };

interface ShopBookmark {
  name: string;
  itemIds: string[];
}

const DEFAULT_BOOKMARKS: ShopBookmark[] = [
  {
    name: 'Blacksmith',
    itemIds: [
      'armour_leather_jack', 'armour_leather_jerkin', 'armour_leather_leggings',
      'armour_mail_coat', 'armour_mail_coif', 'armour_plate_breastplate',
      'weapon_basic_axe', 'weapon_basic_dagger', 'weapon_basic_sword',
      'weapon_cavalry_lance', 'weapon_basic_shield',
    ]
  },
  {
    name: 'Potion Shop',
    itemIds: [
      'item_healing_poultice', 'item_healing_draught', 'item_antitoxin',
      'item_bandages', 'item_salve', 'item_herbs',
    ]
  },
  {
    name: 'Library',
    itemIds: [
      'item_book', 'item_pamphlet', 'item_map', 'item_parchment',
      'item_quill_and_ink', 'item_scroll_case',
    ]
  },
  {
    name: 'General Store',
    itemIds: [
      'item_backpack', 'item_blanket', 'item_bottle', 'item_candle',
      'item_clothing', 'item_rope', 'item_sack', 'item_torch',
    ]
  },
  {
    name: 'Tavern Supplies',
    itemIds: [
      'item_ale', 'item_wine', 'item_spirits', 'item_rations',
      'item_meal', 'item_waterskin',
    ]
  },
];

interface ShopManagerProps {
  onClose: () => void;
}

export const ShopManager: React.FC<ShopManagerProps> = ({ onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'armor' | 'weapon' | 'item'>('all');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [customBookmarks, setCustomBookmarks] = useLocalStorageState<ShopBookmark[]>("wfrp-shop-bookmarks", []);
  const [bookmarkName, setBookmarkName] = useState('');

  // Combine all items with category tags
  const allItems = useMemo<ShopItem[]>(() => {
    const armor = (ArmorData as Armor[]).map(item => ({ ...item, category: 'armor' as const }));
    const weapons = (WeaponData as Weapon[]).map(item => ({ ...item, category: 'weapon' as const }));
    const items = (ItemData as Item[]).map(item => ({ ...item, category: 'item' as const }));
    return [...armor, ...weapons, ...items];
  }, []);

  // Filter items based on search and category
  const filteredItems = useMemo(() => {
    let filtered = allItems;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.id.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [allItems, searchTerm, selectedCategory]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleToggleAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedItems(new Set());
  };

  const handleLoadBookmark = (bookmark: ShopBookmark) => {
    setSelectedItems(new Set(bookmark.itemIds));
  };

  const handleSaveBookmark = () => {
    if (!bookmarkName.trim()) return;

    const newBookmark: ShopBookmark = {
      name: bookmarkName.trim(),
      itemIds: Array.from(selectedItems),
    };

    setCustomBookmarks(prev => [...prev, newBookmark]);
    setBookmarkName('');
  };

  const handleDeleteBookmark = (index: number) => {
    setCustomBookmarks(prev => prev.filter((_, i) => i !== index));
  };

  const handlePublishToPlayers = () => {
    if (selectedItems.size === 0) {
      alert('No items selected to publish!');
      return;
    }

    // Create inventory map with item IDs and quantities (default to 1 for shop availability)
    const inventory: Record<string, number> = {};
    selectedItems.forEach(itemId => {
      inventory[itemId] = 1; // Quantity 1 means available in shop
    });

    const message = {
      type: 'UPDATE_SHOP_INVENTORY' as const,
      payload: { items: inventory },
    };

    // Broadcast to all players
    if (window.ipcRenderer?.sendToAllPlayers) {
      window.ipcRenderer.sendToAllPlayers(message);
      alert(`Shop published with ${selectedItems.size} items to all players!`);
    } else {
      console.error('sendToAllPlayers not available');
      alert('Error: Unable to broadcast to players. Check server connection.');
    }
  };

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Shop Manager</h2>
          <button className={styles.closeButton} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.controls}>
          <div className={styles.searchBar}>
            <input
              type="text"
              placeholder="Search items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.categoryFilters}>
            <button
              className={selectedCategory === 'all' ? styles.active : ''}
              onClick={() => setSelectedCategory('all')}
            >
              All ({allItems.length})
            </button>
            <button
              className={selectedCategory === 'armor' ? styles.active : ''}
              onClick={() => setSelectedCategory('armor')}
            >
              Armor ({ArmorData.length})
            </button>
            <button
              className={selectedCategory === 'weapon' ? styles.active : ''}
              onClick={() => setSelectedCategory('weapon')}
            >
              Weapons ({WeaponData.length})
            </button>
            <button
              className={selectedCategory === 'item' ? styles.active : ''}
              onClick={() => setSelectedCategory('item')}
            >
              Items ({ItemData.length})
            </button>
          </div>

          <div className={styles.selectionControls}>
            <span className={styles.selectionCount}>
              Selected: {selectedItems.size} items
            </span>
            <button onClick={handleToggleAll} className={styles.secondaryButton}>
              {selectedItems.size === filteredItems.length ? 'Deselect All' : 'Select All'}
            </button>
            <button onClick={handleClearSelection} className={styles.secondaryButton}>
              Clear
            </button>
          </div>
        </div>

        <div className={styles.mainLayout}>
          <div className={styles.bookmarksPanel}>
            <h3>Shop Bookmarks</h3>
            
            <div className={styles.bookmarkSection}>
              <h4>Default Shops</h4>
              {DEFAULT_BOOKMARKS.map((bookmark, index) => (
                <button
                  key={index}
                  className={styles.bookmarkButton}
                  onClick={() => handleLoadBookmark(bookmark)}
                >
                  {bookmark.name}
                </button>
              ))}
            </div>

            {customBookmarks.length > 0 && (
              <div className={styles.bookmarkSection}>
                <h4>Custom Shops</h4>
                {customBookmarks.map((bookmark, index) => (
                  <div key={index} className={styles.customBookmark}>
                    <button
                      className={styles.bookmarkButton}
                      onClick={() => handleLoadBookmark(bookmark)}
                    >
                      {bookmark.name}
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDeleteBookmark(index)}
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.bookmarkSection}>
              <h4>Save Current Selection</h4>
              <input
                type="text"
                placeholder="Bookmark name..."
                value={bookmarkName}
                onChange={(e) => setBookmarkName(e.target.value)}
                className={styles.bookmarkInput}
              />
              <button
                onClick={handleSaveBookmark}
                disabled={!bookmarkName.trim() || selectedItems.size === 0}
                className={styles.saveButton}
              >
                Save Bookmark
              </button>
            </div>
          </div>

          <div className={styles.itemsPanel}>
            <div className={styles.itemsList}>
              {filteredItems.length === 0 ? (
                <p className={styles.noItems}>No items found</p>
              ) : (
                filteredItems.map(item => (
                  <div key={item.id} className={styles.itemCard}>
                    <label className={styles.itemLabel}>
                      <input
                        type="checkbox"
                        checked={selectedItems.has(item.id)}
                        onChange={() => handleToggleItem(item.id)}
                        className={styles.checkbox}
                      />
                      <div className={styles.itemInfo}>
                        <div className={styles.itemHeader}>
                          <span className={styles.itemName}>{item.name}</span>
                          <span className={styles.itemPrice}>{item.price}</span>
                        </div>
                        <div className={styles.itemMeta}>
                          <span className={styles.itemCategory}>{item.category}</span>
                          <span className={styles.itemAvailability}>{item.availability}</span>
                          {'group' in item && <span className={styles.itemGroup}>{item.group}</span>}
                        </div>
                      </div>
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button
            onClick={handlePublishToPlayers}
            disabled={selectedItems.size === 0}
            className={styles.publishButton}
          >
            Publish Shop to Players ({selectedItems.size} items)
          </button>
        </div>
      </div>
    </div>
  );
};
