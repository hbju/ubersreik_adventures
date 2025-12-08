import React, { useState, useMemo, useEffect } from 'react';
import { ShopDefinition, Location, useGameData } from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import { ItemCatalog } from './ItemCatalog';
import styles from './ShopEditor.module.css';

type ShopCategory = ShopDefinition['category'];

interface ShopEditorProps {
    shop: ShopDefinition | null;
    locations: Location[];
    onSave: (shop: ShopDefinition) => void;
    onCancel: () => void;
    onDelete?: (shopId: string) => void;
    isNew?: boolean;
}

const SHOP_CATEGORIES: { value: ShopCategory; label: string }[] = [
    { value: 'weapon', label: 'shops.categories.weapon' },
    { value: 'armor', label: 'shops.categories.armor' },
    { value: 'general', label: 'shops.categories.general' },
    { value: 'apothecary', label: 'shops.categories.apothecary' },
    { value: 'tavern', label: 'shops.categories.tavern' },
    { value: 'specialty', label: 'shops.categories.specialty' },
];

export const ShopEditor: React.FC<ShopEditorProps> = ({
    shop,
    locations,
    onSave,
    onCancel,
    onDelete,
    isNew = false
}) => {
    const { t } = useTranslation();
    const gameData = useGameData();

    // Local state for editing
    const [name, setName] = useState(shop?.name || '');
    const [locationId, setLocationId] = useState(shop?.locationId || '');
    const [category, setCategory] = useState<ShopCategory>(shop?.category || 'general');
    const [baseStock, setBaseStock] = useState<string[]>(shop?.baseStock || []);
    const [hasChanges, setHasChanges] = useState(false);

    // Create lookup maps for items
    const weaponsById = useMemo(() => new Map(gameData.weapons.map(w => [w.id, w])), [gameData.weapons]);
    const armorById = useMemo(() => new Map(gameData.armor.map(a => [a.id, a])), [gameData.armor]);
    const itemsById = useMemo(() => new Map(gameData.items.map(i => [i.id, i])), [gameData.items]);

    // Reset form when shop changes
    useEffect(() => {
        setName(shop?.name || '');
        setLocationId(shop?.locationId || '');
        setCategory(shop?.category || 'general');
        setBaseStock(shop?.baseStock || []);
        setHasChanges(false);
    }, [shop]);

    // Track changes
    useEffect(() => {
        if (!shop && !isNew) {
            setHasChanges(false);
            return;
        }

        const original = shop || { name: '', locationId: '', category: 'general' as ShopCategory, baseStock: [] };
        const changed = 
            name !== original.name ||
            locationId !== original.locationId ||
            category !== original.category ||
            JSON.stringify(baseStock) !== JSON.stringify(original.baseStock);
        
        setHasChanges(changed || isNew);
    }, [shop, name, locationId, category, baseStock, isNew]);

    // Get item name from ID
    const getItemName = (itemId: string): string => {
        return weaponsById.get(itemId)?.name || 
               armorById.get(itemId)?.name || 
               itemsById.get(itemId)?.name || 
               itemId;
    };

    // Get item type icon
    const getItemTypeIcon = (itemId: string): string => {
        if (weaponsById.has(itemId)) return '⚔️';
        if (armorById.has(itemId)) return '🛡️';
        return '📦';
    };

    // Handle adding item to stock
    const handleAddItem = (itemId: string) => {
        if (!baseStock.includes(itemId)) {
            setBaseStock([...baseStock, itemId]);
        }
    };

    // Handle removing item from stock
    const handleRemoveItem = (itemId: string) => {
        setBaseStock(baseStock.filter(id => id !== itemId));
    };

    // Handle save
    const handleSave = () => {
        if (!name.trim()) {
            alert(t('shops.config.nameRequired', 'Shop name is required'));
            return;
        }

        const shopId = shop?.id || `shop_${name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;

        const updatedShop: ShopDefinition = {
            id: shopId,
            name: name.trim(),
            locationId,
            category,
            baseStock
        };

        onSave(updatedShop);
    };

    // Handle delete
    const handleDelete = () => {
        if (!shop || !onDelete) return;
        
        if (window.confirm(t('shops.config.confirmDelete', 'Are you sure you want to delete this shop?'))) {
            onDelete(shop.id);
        }
    };

    if (!shop && !isNew) {
        return (
            <div className={styles.editorContainer}>
                <div className={styles.emptyState}>
                    <p>{t('shops.config.selectShop', 'Select a shop to edit or create a new one')}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.editorContainer}>
            <div className={styles.editorHeader}>
                <h3>
                    {isNew 
                        ? t('shops.config.newShop', 'New Shop')
                        : t('shops.config.editing', 'Editing: {{name}}', { name: shop?.name })
                    }
                </h3>
            </div>

            <div className={styles.editorContent}>
                {/* Shop Details Form */}
                <div className={styles.formSection}>
                    <div className={styles.formGroup}>
                        <label>{t('shops.config.shopName', 'Name')}</label>
                        <input
                            type="text"
                            className={styles.textInput}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t('shops.config.enterName', 'Enter shop name...')}
                        />
                    </div>

                    <div className={styles.formRow}>
                        <div className={styles.formGroup}>
                            <label>{t('shops.config.location', 'Location')}</label>
                            <select
                                className={styles.selectInput}
                                value={locationId}
                                onChange={(e) => setLocationId(e.target.value)}
                            >
                                <option value="">{t('shops.config.selectLocation', '-- Select Location --')}</option>
                                {locations.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                        {loc.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className={styles.formGroup}>
                            <label>{t('shops.config.category', 'Category')}</label>
                            <select
                                className={styles.selectInput}
                                value={category}
                                onChange={(e) => setCategory(e.target.value as ShopCategory)}
                            >
                                {SHOP_CATEGORIES.map(cat => (
                                    <option key={cat.value} value={cat.value}>
                                        {t(cat.label, cat.value)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Stock Management */}
                <div className={styles.stockSection}>
                    <div className={styles.stockColumns}>
                        {/* Current Stock */}
                        <div className={styles.currentStock}>
                            <div className={styles.stockHeader}>
                                <h4>{t('shops.config.currentStock', 'Current Base Stock')}</h4>
                                <span className={styles.stockCount}>
                                    {baseStock.length} {t('shops.config.items', 'items')}
                                </span>
                            </div>
                            <div className={styles.stockList}>
                                {baseStock.length === 0 ? (
                                    <div className={styles.emptyStock}>
                                        {t('shops.config.noItems', 'No items in stock. Add items from the catalog.')}
                                    </div>
                                ) : (
                                    baseStock.map(itemId => (
                                        <div key={itemId} className={styles.stockItem}>
                                            <span className={styles.itemIcon}>{getItemTypeIcon(itemId)}</span>
                                            <span className={styles.itemName}>{getItemName(itemId)}</span>
                                            <button
                                                className={styles.removeButton}
                                                onClick={() => handleRemoveItem(itemId)}
                                                title={t('shops.config.removeItem', 'Remove from stock')}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Item Catalog */}
                        <div className={styles.catalogPanel}>
                            <ItemCatalog
                                onSelectItem={handleAddItem}
                                excludeItemIds={baseStock}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Buttons */}
            <div className={styles.editorFooter}>
                <div className={styles.leftActions}>
                    {!isNew && onDelete && (
                        <button 
                            className={styles.deleteButton}
                            onClick={handleDelete}
                        >
                            {t('common.delete', 'Delete')}
                        </button>
                    )}
                </div>
                <div className={styles.rightActions}>
                    <button 
                        className={styles.cancelButton}
                        onClick={onCancel}
                    >
                        {t('common.cancel', 'Cancel')}
                    </button>
                    <button 
                        className={styles.saveButton}
                        onClick={handleSave}
                        disabled={!hasChanges}
                    >
                        {t('shops.config.saveShop', 'Save Shop')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ShopEditor;
