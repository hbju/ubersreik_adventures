import React, { useState, useMemo } from 'react';
import { Item, Weapon, Armor, useGameData } from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import styles from './ItemCatalog.module.css';

type CatalogItem = {
    id: string;
    name: string;
    type: 'weapon' | 'armor' | 'item';
    price: string;
    availability?: string;
    category?: string; // For weapons: group, for armor: type
};

interface ItemCatalogProps {
    onSelectItem: (itemId: string) => void;
    excludeItemIds?: string[]; // Items already in stock that should be excluded
}

type FilterCategory = 'all' | 'weapon' | 'armor' | 'item';

export const ItemCatalog: React.FC<ItemCatalogProps> = ({
    onSelectItem,
    excludeItemIds = []
}) => {
    const { t } = useTranslation();
    const gameData = useGameData();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');

    // Combine all items into a single catalog
    const catalogItems = useMemo(() => {
        const items: CatalogItem[] = [];

        // Add weapons
        gameData.weapons.forEach((weapon: Weapon) => {
            items.push({
                id: weapon.id,
                name: weapon.name,
                type: 'weapon',
                price: weapon.price || '-',
                availability: weapon.availability,
                category: weapon.group
            });
        });

        // Add armor
        gameData.armor.forEach((armor: Armor) => {
            items.push({
                id: armor.id,
                name: armor.name,
                type: 'armor',
                price: armor.price || '-',
                availability: armor.availability,
                category: armor.type
            });
        });

        // Add general items
        gameData.items.forEach((item: Item) => {
            items.push({
                id: item.id,
                name: item.name,
                type: 'item',
                price: item.price || '-',
                availability: item.availability
            });
        });

        return items;
    }, [gameData.weapons, gameData.armor, gameData.items]);

    // Filter items based on search and category
    const filteredItems = useMemo(() => {
        return catalogItems.filter(item => {
            // Exclude items already in stock
            if (excludeItemIds.includes(item.id)) {
                return false;
            }

            // Filter by category
            if (filterCategory !== 'all' && item.type !== filterCategory) {
                return false;
            }

            // Filter by search term
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                return (
                    item.name.toLowerCase().includes(searchLower) ||
                    item.id.toLowerCase().includes(searchLower) ||
                    (item.category && item.category.toLowerCase().includes(searchLower))
                );
            }

            return true;
        });
    }, [catalogItems, excludeItemIds, filterCategory, searchTerm]);

    const getTypeIcon = (type: 'weapon' | 'armor' | 'item') => {
        switch (type) {
            case 'weapon': return '⚔️';
            case 'armor': return '🛡️';
            case 'item': return '📦';
        }
    };

    return (
        <div className={styles.catalogContainer}>
            <div className={styles.catalogHeader}>
                <h4>{t('shops.config.itemCatalog', 'Item Catalog')}</h4>
            </div>

            <div className={styles.filters}>
                <input
                    type="text"
                    className={styles.searchInput}
                    placeholder={t('shops.config.searchItems', 'Search items...')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                <select
                    className={styles.categorySelect}
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as FilterCategory)}
                >
                    <option value="all">{t('shops.config.allTypes', 'All Types')}</option>
                    <option value="weapon">{t('shops.config.weapons', 'Weapons')}</option>
                    <option value="armor">{t('shops.config.armor', 'Armor')}</option>
                    <option value="item">{t('shops.config.items', 'Items')}</option>
                </select>
            </div>

            <div className={styles.itemList}>
                {filteredItems.length === 0 ? (
                    <div className={styles.emptyMessage}>
                        {searchTerm
                            ? t('shops.config.noMatchingItems', 'No matching items found')
                            : t('shops.config.allItemsInStock', 'All available items are in stock')
                        }
                    </div>
                ) : (
                    filteredItems.map(item => (
                        <div key={item.id} className={styles.catalogItem}>
                            <div className={styles.itemInfo}>
                                <span className={styles.typeIcon}>{getTypeIcon(item.type)}</span>
                                <div className={styles.itemDetails}>
                                    <span className={styles.itemName}>{item.name}</span>
                                    <span className={styles.itemMeta}>
                                        {item.price} {item.availability && `• ${item.availability}`}
                                    </span>
                                </div>
                            </div>
                            <button
                                className={styles.addButton}
                                onClick={() => onSelectItem(item.id)}
                                title={t('shops.config.addToStock', 'Add to Stock')}
                            >
                                +
                            </button>
                        </div>
                    ))
                )}
            </div>

            <div className={styles.catalogFooter}>
                <span className={styles.itemCount}>
                    {t('shops.config.itemsShown', '{{count}} items', { count: filteredItems.length })}
                </span>
            </div>
        </div>
    );
};

export default ItemCatalog;
