import React, { useMemo } from 'react';
import { 
    ShopState, 
    ShopInventoryItem, 
    useGameData, 
    formatPriceFromBrass,
    ShopDefinition,
    Character,
} from '@wfrp/shared';
import styles from './ShopBrowser.module.css';

interface ShopBrowserProps {
    shop: ShopState;
    shopDefinition?: ShopDefinition;
    onClose: () => void;
    isGm?: boolean;
    characters?: Character[];
    onGiveItemToPlayer?: (item: ShopInventoryItem, charId: string) => void;
}

export const ShopBrowser: React.FC<ShopBrowserProps> = ({
    shop,
    shopDefinition,
    onClose,
    isGm = false,
    characters,
    onGiveItemToPlayer,
}) => {
    const gameData = useGameData();

    const weaponsById = useMemo(() => new Map(gameData.weapons.map(w => [w.id, w])), [gameData.weapons]);
    const armorById = useMemo(() => new Map(gameData.armor.map(a => [a.id, a])), [gameData.armor]);
    const itemsById = useMemo(() => new Map(gameData.items.map(i => [i.id, i])), [gameData.items]);
    const qualitiesById = useMemo(() => new Map(gameData.qualities.map(q => [q.id, q])), [gameData.qualities]);

    const getItemName = (itemId: string): string => {
        return weaponsById.get(itemId)?.name || 
               armorById.get(itemId)?.name || 
               itemsById.get(itemId)?.name || 
               itemId;
    };

    const getQualityFlawName = (id: string): string => {
        return qualitiesById.get(id)?.name || id;
    };

    const getBaseItem = (itemId: string) => {
        return weaponsById.get(itemId) || armorById.get(itemId) || itemsById.get(itemId);
    };

    const renderInventoryItem = (item: ShopInventoryItem) => {
        const baseItem = getBaseItem(item.baseItemId);
        const displayName = item.nameOverride || getItemName(item.baseItemId);
        const priceDisplay = formatPriceFromBrass(item.basePrice);

        console.log("Rendering item:", item, "Base item:", baseItem);

        return (
            <div key={item.instanceId} className={styles.shopItem}>
                <div className={styles.itemHeader}>
                    <h3 className={styles.itemName}>{displayName}</h3>
                    <span className={styles.itemPrice}>
                        {priceDisplay}
                    </span>
                </div>

                <div className={styles.itemInfo}>
                    <span className={styles.itemType}>{item.baseItemType}</span>
                    <span className={styles.itemQuantity}>Qty: {item.quantity}</span>
                </div>

                {(isGm || item.isIdentified) && item.modification !== 'standard' && (
                    <div className={`${styles.modification} ${styles[item.modification]}`}>
                        {item.modification === 'quality' ? (
                            <>
                                <span className={styles.modLabel}>★ Quality</span>
                                {item.qualities.length > 0 && (
                                    <span className={styles.modDetail}>
                                        {item.qualities.map(q => getQualityFlawName(q)).join(', ')}
                                    </span>
                                )}
                            </>
                        ) : (
                            <>
                                <span className={styles.modLabel}>⚠ Flawed</span>
                                {item.flaws.length > 0 && (
                                    <span className={styles.modDetail}>
                                        {item.flaws.map(f => getQualityFlawName(f)).join(', ')}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                )}

                {!item.isIdentified && !isGm && (
                    <div className={styles.unidentified}>
                        <span className={styles.mysteryText}>? Quality Unknown</span>
                    </div>
                )}
            </div>
        );
    };

    const shopName = shopDefinition?.name || shop.shopId;

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{shopName}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.inventory}>
                    {shop.inventory.length === 0 ? (
                        <div className={styles.emptyShop}>
                            <p>This shop has no wares available.</p>
                        </div>
                    ) : (
                        shop.inventory.map(item => renderInventoryItem(item))
                    )}
                </div>
            </div>
        </div>
    );
};

export default ShopBrowser;
