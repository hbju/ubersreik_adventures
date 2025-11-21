import React, { useState, useMemo } from 'react';
import { Armor, Weapon, Item, useGameData } from '@wfrp/shared';
import styles from './ItemSelectorModal.module.css'; // Reuse styles for now

type ShopItem = (Armor | Weapon | Item) & { category: 'armor' | 'weapon' | 'item' };

interface ItemSelectorModalProps {
    onClose: () => void;
    onSelect: (item: Armor | Weapon | Item) => void;
}

export const ItemSelectorModal: React.FC<ItemSelectorModalProps> = ({ onClose, onSelect }) => {
    const gameData = useGameData();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<'all' | 'armor' | 'weapon' | 'item'>('all');

    // Combine all items with category tags
    const allItems = useMemo<ShopItem[]>(() => {
        const armor = (gameData.armor as Armor[]).map(item => ({ ...item, category: 'armor' as const }));
        const weapons = (gameData.weapons as Weapon[]).map(item => ({ ...item, category: 'weapon' as const }));
        const items = (gameData.items as Item[]).map(item => ({ ...item, category: 'item' as const }));
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

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                <div className={styles.header}>
                    <h2>Select Item</h2>
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
                            autoFocus
                        />
                    </div>

                    <div className={styles.categoryFilters}>
                        <button
                            className={selectedCategory === 'all' ? styles.active : ''}
                            onClick={() => setSelectedCategory('all')}
                        >
                            All
                        </button>
                        <button
                            className={selectedCategory === 'armor' ? styles.active : ''}
                            onClick={() => setSelectedCategory('armor')}
                        >
                            Armor
                        </button>
                        <button
                            className={selectedCategory === 'weapon' ? styles.active : ''}
                            onClick={() => setSelectedCategory('weapon')}
                        >
                            Weapons
                        </button>
                        <button
                            className={selectedCategory === 'item' ? styles.active : ''}
                            onClick={() => setSelectedCategory('item')}
                        >
                            Items
                        </button>
                    </div>
                </div>

                <div className={styles.mainLayout} style={{ gridTemplateColumns: '1fr' }}>
                    <div className={styles.itemsPanel}>
                        <div className={styles.itemsList}>
                            {filteredItems.length === 0 ? (
                                <p className={styles.noItems}>No items found</p>
                            ) : (
                                filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        className={styles.itemCard}
                                        onClick={() => onSelect(item)}
                                        style={{ cursor: 'pointer' }}
                                    >
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
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
