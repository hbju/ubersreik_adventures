import React from 'react';
import { Location, ShopState } from '@wfrp/shared';
import styles from './LocationInfoPanel.module.css';

interface LocationInfoPanelProps {
  location: Location;
  onClose: () => void;
  shops?: ShopState[];
  onViewWares?: (shopId: string) => void;
}

const LocationInfoPanel: React.FC<LocationInfoPanelProps> = ({ 
  location, 
  onClose, 
  shops = [],
  onViewWares
}) => {
  // Check if this location has an accessible shop
  const locationShop = shops.find(shop => shop.shopId.includes(location.id.toLowerCase().replace(/\s+/g, '_')));
  const hasAccessibleShop = !!locationShop;

  return (
    <div className={styles.panel}>
        <button className={styles.closeButton} onClick={onClose}>
            &times;
        </button>
        <img src={location.image} alt={location.name} className={styles.locationImage} />

        <div className={styles.content}>
            <h2 className={styles.locationName}>{location.name}</h2>
            <p className={styles.description}>{location.playerDescription}</p>

            {location.hooks && location.hooks.length > 0 && (
                <div className={styles.hooks}>
                    <h3>Adventure Hooks</h3>
                    <ul>
                        {location.hooks.map((hook, index) => (
                            <li key={index}>{hook}</li>
                        ))}
                    </ul>
                </div>
            )}

            {hasAccessibleShop && onViewWares && locationShop && (
                <div className={styles.shopSection}>
                    <button 
                        className={styles.viewWaresButton}
                        onClick={() => onViewWares(locationShop.shopId)}
                    >
                        🛒 View Wares
                    </button>
                </div>
            )}
        </div>
    </div>
    );
};

export default LocationInfoPanel;