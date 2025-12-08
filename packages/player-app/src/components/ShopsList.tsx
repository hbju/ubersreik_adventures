import React from 'react';
import { ShopState, ShopDefinition, useGameData, Location } from '@wfrp/shared';
import styles from './ShopsList.module.css';

interface ShopsListProps {
    shops: ShopState[];
    onSelectShop: (shopId: string) => void;
}

export const ShopsList: React.FC<ShopsListProps> = ({ shops, onSelectShop }) => {
    const { gameData, shops: shopDefinitions } = useGameData();

    // Get shop definition for a shop state
    const getShopDefinition = (shopId: string): ShopDefinition | undefined => {
        return shopDefinitions?.find(s => s.id === shopId);
    };

    // Get location name for a shop
    const getLocationName = (locationId: string): string => {
        const location = gameData.locations.find((l: Location) => l.id === locationId);
        return location?.name || locationId;
    };

    if (shops.length === 0) {
        return (
            <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>🏪</div>
                <h3>No Shops Available</h3>
                <p>You haven't discovered any shops yet. Explore the city to find merchants!</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>Available Shops</h2>
            <div className={styles.shopsList}>
                {shops.map(shop => {
                    const definition = getShopDefinition(shop.shopId);
                    const shopName = definition?.name || shop.shopId;
                    const locationName = definition?.locationId ? getLocationName(definition.locationId) : '';
                    const itemCount = shop.inventory.length;

                    return (
                        <button
                            key={shop.shopId}
                            className={styles.shopCard}
                            onClick={() => onSelectShop(shop.shopId)}
                        >
                            <div className={styles.shopHeader}>
                                <span className={styles.shopIcon}>🏪</span>
                                <div className={styles.shopInfo}>
                                    <h3 className={styles.shopName}>{shopName}</h3>
                                    {locationName && (
                                        <span className={styles.shopLocation}>📍 {locationName}</span>
                                    )}
                                </div>
                            </div>
                            <div className={styles.shopMeta}>
                                <span className={styles.itemCount}>{itemCount} items</span>
                                <span className={styles.viewButton}>View Wares →</span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default ShopsList;
