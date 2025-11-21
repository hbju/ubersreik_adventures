import React, { useMemo } from 'react';
import { Armor, Weapon, Item, Currency, useGameData } from '@wfrp/shared';
import styles from './ShopModal.module.css';

interface ShopModalProps {
    shopItems: string[];
    playerCurrency: Currency;
    onClose: () => void;
    onRequestPurchase: (item: Armor | Weapon | Item) => void;
}

export const ShopModal: React.FC<ShopModalProps> = ({ 
    shopItems, 
    playerCurrency,
    onClose, 
    onRequestPurchase 
}) => {
    const gameData = useGameData();
    const armorsById = Object.groupBy(gameData.armor, a => a.id);
    const weaponsById = Object.groupBy(gameData.weapons, w => w.id);
    const itemsById = Object.groupBy(gameData.items, i => i.id);
    
    // Load all available items from the shop
    const availableItems = useMemo(() => {
        const items: (Armor | Weapon | Item)[] = [];
        
        shopItems.forEach(id => {
            const armor = armorsById[id]?.[0];
            const weapon = weaponsById[id]?.[0];
            const item = itemsById[id]?.[0];
            
            if (armor) items.push(armor);
            else if (weapon) items.push(weapon);
            else if (item) items.push(item);
        });
        
        return items;
    }, [shopItems]);

    // Check if player can afford an item
    const canAfford = (price: string): boolean => {
        const parts = price.split(' ');
        const amount = parseInt(parts[0]);
        const currency = parts[1];
        
        // Convert everything to brass pennies for comparison
        const playerTotal = (playerCurrency.gc * 240) + (playerCurrency.ss * 12) + playerCurrency.bp;
        let itemCost = 0;
        
        if (currency === 'GC') itemCost = amount * 240;
        else if (currency === 'S') itemCost = amount * 12;
        else if (currency === 'P') itemCost = amount;
        
        return playerTotal >= itemCost;
    };

    const getItemType = (item: Armor | Weapon | Item): string => {
        if ('ap' in item) return 'Armor';
        if ('damage' in item) return 'Weapon';
        return 'Item';
    };

    const getItemDetails = (item: Armor | Weapon | Item): React.ReactNode => {
        if ('ap' in item) {
            // It's armor
            return (
                <>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Type:</span>
                        <span className={styles.detailValue}>{item.type}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>AP:</span>
                        <span className={styles.detailValue}>{item.ap}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Locations:</span>
                        <span className={styles.detailValue}>{item.locations.join(', ')}</span>
                    </div>
                </>
            );
        } else if ('damage' in item) {
            // It's a weapon
            return (
                <>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Group:</span>
                        <span className={styles.detailValue}>{item.group}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Damage:</span>
                        <span className={styles.detailValue}>{item.damage}</span>
                    </div>
                    <div className={styles.detailRow}>
                        <span className={styles.detailLabel}>Reach:</span>
                        <span className={styles.detailValue}>{item.reach}</span>
                    </div>
                </>
            );
        }
        return null;
    };

    return (
        <div className={styles.modalBackdrop} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2>Shop Inventory</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                <div className={styles.body}>
                    <div className={styles.currencyDisplay}>
                        <span className={styles.label}>Your Currency:</span>
                        <div className={styles.currency}>
                            <span className={styles.gc}>{playerCurrency.gc} GC</span>
                            <span className={styles.ss}>{playerCurrency.ss} SS</span>
                            <span className={styles.bp}>{playerCurrency.bp} BP</span>
                        </div>
                    </div>

                    {availableItems.length === 0 ? (
                        <p className={styles.emptyMessage}>No items available in the shop right now.</p>
                    ) : (
                        <div className={styles.itemsList}>
                            {availableItems.map((item) => {
                                const affordable = canAfford(item.price);
                                return (
                                    <div key={item.id} className={styles.shopItem}>
                                        <div className={styles.itemHeader}>
                                            <div>
                                                <h3 className={styles.itemName}>{item.name}</h3>
                                                <span className={styles.itemType}>{getItemType(item)}</span>
                                            </div>
                                            <div className={styles.priceSection}>
                                                <span className={styles.price}>{item.price}</span>
                                            </div>
                                        </div>

                                        <div className={styles.itemDetails}>
                                            {getItemDetails(item)}
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailLabel}>Encumbrance:</span>
                                                <span className={styles.detailValue}>{item.enc}</span>
                                            </div>
                                            <div className={styles.detailRow}>
                                                <span className={styles.detailLabel}>Availability:</span>
                                                <span className={styles.detailValue}>{item.availability}</span>
                                            </div>
                                        </div>

                                        <button
                                            className={`${styles.purchaseButton} ${!affordable ? styles.disabled : ''}`}
                                            onClick={() => affordable && onRequestPurchase(item)}
                                            disabled={!affordable}
                                        >
                                            {affordable ? 'Request Purchase' : 'Cannot Afford'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
