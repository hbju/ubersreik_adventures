import React, { useState, useMemo } from 'react';
import { 
    Armor, 
    Weapon, 
    Item, 
    useGameData, 
    ShopDefinition, 
    ShopState, 
    ShopInventoryItem,
    ShopInventoryState,
    generateAllShopsStock,
    generateDailyStock,
    formatPriceFromBrass,
    Character,
    QualityTooltip
} from '@wfrp/shared';
import styles from './ShopManager.module.css';

interface ShopManagerProps {
    onClose: () => void;
    shopInventory: ShopInventoryState | undefined;
    onShopInventoryChange: (inventory: ShopInventoryState) => void;
    characters: Character[];
}

export const ShopManager: React.FC<ShopManagerProps> = ({ 
    onClose, 
    shopInventory,
    onShopInventoryChange,
    characters 
}) => {
    const gameData = useGameData();
    const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
    const [expandedShops, setExpandedShops] = useState<Set<string>>(new Set());

    // Get shops from game data
    const shops = gameData.shops || [];

    // Create lookup maps for items
    const weaponsById = useMemo(() => new Map(gameData.weapons.map(w => [w.id, w])), [gameData.weapons]);
    const armorById = useMemo(() => new Map(gameData.armor.map(a => [a.id, a])), [gameData.armor]);
    const itemsById = useMemo(() => new Map(gameData.items.map(i => [i.id, i])), [gameData.items]);
    const qualitiesById = useMemo(() => new Map(gameData.qualities.map(q => [q.id, q])), [gameData.qualities]);

    // Get item name from ID
    const getItemName = (itemId: string): string => {
        return weaponsById.get(itemId)?.name || 
               armorById.get(itemId)?.name || 
               itemsById.get(itemId)?.name || 
               itemId;
    };

    // Get quality/flaw name from ID
    const getQualityFlawName = (id: string): string => {
        return qualitiesById.get(id)?.name || id;
    };

    // Handle restock all shops
    const handleRestockAll = () => {
        const generatorData = {
            weapons: gameData.weapons,
            armor: gameData.armor,
            items: gameData.items,
            qualitiesFlaws: gameData.qualities
        };

        const newShopStates = generateAllShopsStock(shops, generatorData);
        
        // Preserve player access from existing inventory
        if (shopInventory?.shops) {
            for (const [shopId, oldState] of Object.entries(shopInventory.shops)) {
                if (newShopStates[shopId]) {
                    newShopStates[shopId].playerAccess = oldState.playerAccess;
                }
            }
        }

        const newInventory: ShopInventoryState = {
            shops: newShopStates,
            lastGlobalRestock: new Date().toISOString()
        };

        onShopInventoryChange(newInventory);

        // Broadcast to players
        broadcastShopUpdate(newInventory);
    };

    // Handle restock single shop
    const handleRestockShop = (shop: ShopDefinition) => {
        const generatorData = {
            weapons: gameData.weapons,
            armor: gameData.armor,
            items: gameData.items,
            qualitiesFlaws: gameData.qualities
        };

        const newInventory = generateDailyStock(shop, generatorData);
        
        const existingAccess = shopInventory?.shops?.[shop.id]?.playerAccess || [];

        const newShopState: ShopState = {
            shopId: shop.id,
            lastRestockDate: new Date().toISOString(),
            inventory: newInventory,
            playerAccess: existingAccess
        };

        const updatedShops = {
            ...(shopInventory?.shops || {}),
            [shop.id]: newShopState
        };

        const newInventoryState: ShopInventoryState = {
            shops: updatedShops,
            lastGlobalRestock: shopInventory?.lastGlobalRestock || new Date().toISOString()
        };

        onShopInventoryChange(newInventoryState);
        broadcastShopUpdate(newInventoryState);
    };

    // Toggle player access to a shop
    const handleTogglePlayerAccess = (shopId: string, characterId: string) => {
        if (!shopInventory?.shops?.[shopId]) return;

        const currentAccess = shopInventory.shops[shopId].playerAccess;
        const hasAccess = currentAccess.includes(characterId);

        const newAccess = hasAccess
            ? currentAccess.filter(id => id !== characterId)
            : [...currentAccess, characterId];

        const updatedShops = {
            ...shopInventory.shops,
            [shopId]: {
                ...shopInventory.shops[shopId],
                playerAccess: newAccess
            }
        };

        const newInventoryState: ShopInventoryState = {
            ...shopInventory,
            shops: updatedShops
        };

        onShopInventoryChange(newInventoryState);
        broadcastShopUpdate(newInventoryState);
    };

    // Toggle item identification (reveal to players)
    const handleToggleIdentified = (shopId: string, instanceId: string) => {
        if (!shopInventory?.shops?.[shopId]) return;

        const shopState = shopInventory.shops[shopId];
        const updatedInventory = shopState.inventory.map(item => {
            if (item.instanceId === instanceId) {
                return { ...item, isIdentified: !item.isIdentified };
            }
            return item;
        });

        const updatedShops = {
            ...shopInventory.shops,
            [shopId]: {
                ...shopState,
                inventory: updatedInventory
            }
        };

        const newInventoryState: ShopInventoryState = {
            ...shopInventory,
            shops: updatedShops
        };

        onShopInventoryChange(newInventoryState);
        broadcastShopUpdate(newInventoryState);
    };

    // Remove item from shop inventory
    const handleRemoveItem = (shopId: string, instanceId: string) => {
        if (!shopInventory?.shops?.[shopId]) return;

        const shopState = shopInventory.shops[shopId];
        const updatedInventory = shopState.inventory.filter(item => item.instanceId !== instanceId);

        const updatedShops = {
            ...shopInventory.shops,
            [shopId]: {
                ...shopState,
                inventory: updatedInventory
            }
        };

        const newInventoryState: ShopInventoryState = {
            ...shopInventory,
            shops: updatedShops
        };

        onShopInventoryChange(newInventoryState);
        broadcastShopUpdate(newInventoryState);
    };

    // Adjust item quantity
    const handleAdjustQuantity = (shopId: string, instanceId: string, delta: number) => {
        if (!shopInventory?.shops?.[shopId]) return;

        const shopState = shopInventory.shops[shopId];
        const updatedInventory = shopState.inventory.map(item => {
            if (item.instanceId === instanceId) {
                const newQuantity = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQuantity };
            }
            return item;
        }).filter(item => item.quantity > 0);

        const updatedShops = {
            ...shopInventory.shops,
            [shopId]: {
                ...shopState,
                inventory: updatedInventory
            }
        };

        const newInventoryState: ShopInventoryState = {
            ...shopInventory,
            shops: updatedShops
        };

        onShopInventoryChange(newInventoryState);
        broadcastShopUpdate(newInventoryState);
    };

    // Toggle shop expansion
    const toggleShopExpanded = (shopId: string) => {
        setExpandedShops(prev => {
            const newSet = new Set(prev);
            if (newSet.has(shopId)) {
                newSet.delete(shopId);
            } else {
                newSet.add(shopId);
            }
            return newSet;
        });
    };

    // Broadcast shop update to players
    const broadcastShopUpdate = (inventory: ShopInventoryState) => {
        // Send filtered shop data to each player based on their access
        characters.forEach(character => {
            const accessibleShops: ShopState[] = [];
            
            for (const [shopId, shopState] of Object.entries(inventory.shops)) {
                if (shopState.playerAccess.includes(character.id)) {
                    accessibleShops.push(shopState);
                }
            }

            if (accessibleShops.length > 0 && window.ipcRenderer) {
                const message = {
                    type: 'SHOP_STATE_UPDATE' as const,
                    payload: { shops: accessibleShops }
                };
                
                // Find user ID for this character
                // Note: This would need the user ID, for now broadcast to all
            }
        });

        // Broadcast to all players
        if (window.ipcRenderer?.sendToAllPlayers) {
            const allShops = Object.values(inventory.shops);
            const message = {
                type: 'SHOP_STATE_UPDATE' as const,
                payload: { shops: allShops }
            };
            window.ipcRenderer.sendToAllPlayers(message);
        }
    };

    // Get shop state
    const getShopState = (shopId: string): ShopState | undefined => {
        return shopInventory?.shops?.[shopId];
    };

    // Render item row
    const renderInventoryItem = (shopId: string, item: ShopInventoryItem) => {
        const baseName = getItemName(item.baseItemId);
        const displayName = item.nameOverride || baseName;
        const priceDisplay = formatPriceFromBrass(item.basePrice);

        return (
            <div key={item.instanceId} className={styles.inventoryItem}>
                <div className={styles.itemDetails}>
                    <div className={styles.itemMainInfo}>
                        <span className={`${styles.itemName} ${item.modification !== 'standard' ? styles[item.modification] : ''}`}>
                            {displayName}
                        </span>
                        {item.modification !== 'standard' && (
                            <span className={`${styles.modificationBadge} ${styles[item.modification]}`}>
                                {item.modification === 'quality' ? '★ Quality' : '⚠ Flawed'}
                            </span>
                        )}
                    </div>
                    <div className={styles.itemMeta}>
                        <span className={styles.quantity}>Qty: {item.quantity}</span>
                        <span className={styles.price}>{priceDisplay}</span>
                        {item.qualities.length > 0 && (
                            <span className={styles.qualities}>
                                + {item.qualities.map(q => 
                                    <QualityTooltip
                                        key={q}
                                        qualityString={getQualityFlawName(q)}
                                        />
                                )}
                            </span>
                        )}
                        {item.flaws.length > 0 && (
                            <span className={styles.flaws}>
                                - {item.flaws.map(f => 
                                    <QualityTooltip
                                        key={f}
                                        qualityString={getQualityFlawName(f)}
                                        />
                                )}
                            </span>
                        )}
                    </div>
                </div>
                <div className={styles.itemActions}>
                    <button
                        className={`${styles.actionButton} ${item.isIdentified ? styles.identified : ''}`}
                        onClick={() => handleToggleIdentified(shopId, item.instanceId)}
                        title={item.isIdentified ? 'Hide from players' : 'Reveal to players'}
                    >
                        {item.isIdentified ? '👁️ Revealed' : '🔒 Hidden'}
                    </button>
                    <div className={styles.quantityControls}>
                        <button
                            className={styles.quantityButton}
                            onClick={() => handleAdjustQuantity(shopId, item.instanceId, -1)}
                        >
                            -
                        </button>
                        <button
                            className={styles.quantityButton}
                            onClick={() => handleAdjustQuantity(shopId, item.instanceId, 1)}
                        >
                            +
                        </button>
                    </div>
                    <button
                        className={styles.removeButton}
                        onClick={() => handleRemoveItem(shopId, item.instanceId)}
                        title="Remove from inventory"
                    >
                        ✕
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Shop Manager</h2>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.controls}>
                    <div className={styles.globalControls}>
                        <button 
                            className={styles.restockAllButton}
                            onClick={handleRestockAll}
                        >
                            🔄 Restock Day (All Shops)
                        </button>
                        {shopInventory?.lastGlobalRestock && (
                            <span className={styles.lastRestock}>
                                Last restock: {new Date(shopInventory.lastGlobalRestock).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>

                <div className={styles.shopsContainer}>
                    {shops.map(shop => {
                        const shopState = getShopState(shop.id);
                        const isExpanded = expandedShops.has(shop.id);
                        const itemCount = shopState?.inventory.length || 0;
                        const hasAccess = characters.some(c => shopState?.playerAccess.includes(c.id));

                        return (
                            <div key={shop.id} className={styles.shopCard}>
                                <div 
                                    className={styles.shopHeader}
                                    onClick={() => toggleShopExpanded(shop.id)}
                                >
                                    <div className={styles.shopInfo}>
                                        <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                                        <h3 className={styles.shopName}>{shop.name}</h3>
                                        <span className={styles.shopCategory}>{shop.category}</span>
                                        <span className={styles.itemCount}>
                                            {itemCount} items
                                        </span>
                                        {hasAccess && (
                                            <span className={styles.accessBadge}>Players have access</span>
                                        )}
                                    </div>
                                    <div className={styles.shopActions}>
                                        <button
                                            className={styles.restockButton}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRestockShop(shop);
                                            }}
                                            title="Restock this shop"
                                        >
                                            🔄
                                        </button>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className={styles.shopContent}>
                                        <div className={styles.accessControl}>
                                            <h4>Player Access:</h4>
                                            <div className={styles.characterCheckboxes}>
                                                {characters.map(character => (
                                                    <label key={character.id} className={styles.characterLabel}>
                                                        <input
                                                            type="checkbox"
                                                            checked={shopState?.playerAccess.includes(character.id) || false}
                                                            onChange={() => handleTogglePlayerAccess(shop.id, character.id)}
                                                        />
                                                        {character.name}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className={styles.inventoryList}>
                                            <h4>Current Inventory:</h4>
                                            {!shopState || shopState.inventory.length === 0 ? (
                                                <p className={styles.emptyInventory}>
                                                    No items in stock. Click restock to generate inventory.
                                                </p>
                                            ) : (
                                                shopState.inventory.map(item => 
                                                    renderInventoryItem(shop.id, item)
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
