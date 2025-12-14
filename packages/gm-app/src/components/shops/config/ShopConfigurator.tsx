import React, { useState, useMemo } from 'react';
import { ShopDefinition, Location, useGameData } from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import { ShopEditor } from './ShopEditor';
import styles from './ShopConfigurator.module.css';

interface ShopConfiguratorProps {
    shops: ShopDefinition[];
    onUpdateShops: (shops: ShopDefinition[]) => void;
    onClose: () => void;
}

const getCategoryIcon = (category: ShopDefinition['category']): string => {
    switch (category) {
        case 'weapon': return '⚔️';
        case 'armor': return '🛡️';
        case 'general': return '🏪';
        case 'apothecary': return '⚗️';
        case 'tavern': return '🍺';
        case 'specialty': return '✨';
        default: return '🏬';
    }
};

export const ShopConfigurator: React.FC<ShopConfiguratorProps> = ({
    shops,
    onUpdateShops,
    onClose
}) => {
    const { t } = useTranslation();
    const gameData = useGameData();
    const locations = gameData.mapData?.locations || [];

    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
    const [isCreatingNew, setIsCreatingNew] = useState(false);
    const [filterCategory, setFilterCategory] = useState<ShopDefinition['category'] | 'all'>('all');
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    // Create a map of locationId to location name
    const locationMap = useMemo(() => {
        const map = new Map<string, string>();
        locations.forEach((loc: Location) => {
            map.set(loc.id, loc.name);
        });
        return map;
    }, [locations]);

    // Filter shops by category
    const filteredShops = useMemo(() => {
        if (filterCategory === 'all') return shops;
        return shops.filter(shop => shop.category === filterCategory);
    }, [shops, filterCategory]);

    // Get the currently selected shop
    const selectedShop = useMemo(() => {
        if (isCreatingNew) return null;
        return shops.find(shop => shop.id === selectedShopId) || null;
    }, [shops, selectedShopId, isCreatingNew]);

    // Handle selecting a shop
    const handleSelectShop = (shopId: string) => {
        if (hasUnsavedChanges && !window.confirm(t('shops.config.unsavedChanges', 'You have unsaved changes. Are you sure you want to switch?'))) {
            return;
        }
        setSelectedShopId(shopId);
        setIsCreatingNew(false);
        setHasUnsavedChanges(false);
    };

    // Handle creating a new shop
    const handleCreateNew = () => {
        if (hasUnsavedChanges && !window.confirm(t('shops.config.unsavedChanges', 'You have unsaved changes. Are you sure you want to switch?'))) {
            return;
        }
        setSelectedShopId(null);
        setIsCreatingNew(true);
        setHasUnsavedChanges(false);
    };

    // Handle saving a shop
    const handleSaveShop = (shop: ShopDefinition) => {
        const existingIndex = shops.findIndex(s => s.id === shop.id);
        let updatedShops: ShopDefinition[];

        if (existingIndex >= 0) {
            // Update existing shop
            updatedShops = shops.map(s => s.id === shop.id ? shop : s);
        } else {
            // Add new shop
            updatedShops = [...shops, shop];
        }

        onUpdateShops(updatedShops);
        setSelectedShopId(shop.id);
        setIsCreatingNew(false);
        setHasUnsavedChanges(false);
    };

    // Handle deleting a shop
    const handleDeleteShop = (shopId: string) => {
        const updatedShops = shops.filter(s => s.id !== shopId);
        onUpdateShops(updatedShops);
        setSelectedShopId(null);
        setHasUnsavedChanges(false);
    };

    // Handle canceling edit
    const handleCancel = () => {
        if (hasUnsavedChanges && !window.confirm(t('shops.config.discardChanges', 'Discard unsaved changes?'))) {
            return;
        }
        setIsCreatingNew(false);
        setHasUnsavedChanges(false);
    };

    // Handle close with confirmation
    const handleClose = () => {
        if (hasUnsavedChanges && !window.confirm(t('shops.config.unsavedChanges', 'You have unsaved changes. Are you sure you want to close?'))) {
            return;
        }
        onClose();
    };

    return (
        <>
            <div className={styles.overlay} onClick={handleClose} />
            <div className={styles.configurator}>
                <div className={styles.header}>
                    <h2>🏪 {t('shops.config.title', 'Shop Configuration')}</h2>
                    <button className={styles.closeButton} onClick={handleClose}>
                        {t('common.close', 'Close')}
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Sidebar with shop list */}
                    <div className={styles.sidebar}>
                        <div className={styles.sidebarHeader}>
                            <button 
                                className={styles.createButton}
                                onClick={handleCreateNew}
                            >
                                ➕ {t('shops.config.createNew', 'Create New')}
                            </button>

                            <select
                                className={styles.filterSelect}
                                value={filterCategory}
                                onChange={(e) => setFilterCategory(e.target.value as ShopDefinition['category'] | 'all')}
                            >
                                <option value="all">{t('shops.config.allCategories', 'All Categories')}</option>
                                <option value="weapon">{getCategoryIcon('weapon')} {t('shops.categories.weapon', 'Weapon')}</option>
                                <option value="armor">{getCategoryIcon('armor')} {t('shops.categories.armor', 'Armor')}</option>
                                <option value="general">{getCategoryIcon('general')} {t('shops.categories.general', 'General')}</option>
                                <option value="apothecary">{getCategoryIcon('apothecary')} {t('shops.categories.apothecary', 'Apothecary')}</option>
                                <option value="tavern">{getCategoryIcon('tavern')} {t('shops.categories.tavern', 'Tavern')}</option>
                                <option value="specialty">{getCategoryIcon('specialty')} {t('shops.categories.specialty', 'Specialty')}</option>
                            </select>
                        </div>

                        <div className={styles.shopList}>
                            {filteredShops.map(shop => (
                                <div
                                    key={shop.id}
                                    className={`${styles.shopItem} ${selectedShopId === shop.id && !isCreatingNew ? styles.selected : ''}`}
                                    onClick={() => handleSelectShop(shop.id)}
                                >
                                    <div className={styles.shopIcon}>
                                        {getCategoryIcon(shop.category)}
                                    </div>
                                    <div className={styles.shopInfo}>
                                        <div className={styles.shopName}>{shop.name}</div>
                                        <div className={styles.shopLocation}>
                                            {locationMap.get(shop.locationId) || shop.locationId || t('shops.config.noLocation', 'No location')}
                                        </div>
                                    </div>
                                    <div className={styles.stockBadge}>
                                        {shop.baseStock.length}
                                    </div>
                                </div>
                            ))}

                            {filteredShops.length === 0 && (
                                <div className={styles.emptyMessage}>
                                    {t('shops.config.noShops', 'No shops found')}
                                </div>
                            )}
                        </div>

                        <div className={styles.sidebarFooter}>
                            <span className={styles.shopCount}>
                                {t('shops.config.shopCount', '{{count}} shops', { count: shops.length })}
                            </span>
                        </div>
                    </div>

                    {/* Editor panel */}
                    <div className={styles.editorPanel}>
                        <ShopEditor
                            shop={selectedShop}
                            locations={locations}
                            onSave={handleSaveShop}
                            onCancel={handleCancel}
                            onDelete={handleDeleteShop}
                            isNew={isCreatingNew}
                        />
                    </div>
                </div>
            </div>
        </>
    );
};

export default ShopConfigurator;
