import React from 'react';
import { Location, ShopState } from '../types/wfrp.types';
import styles from './LocationInfoPanel.module.css';

interface LocationInfoPanelProps {
    location: Location;
    onClose: () => void;
    isGM?: boolean; 
    shops?: ShopState[];
    onViewWares?: (shopId: string) => void;
}

const LocationInfoPanel: React.FC<LocationInfoPanelProps> = ({
    location,
    onClose,
    isGM = false,
    shops = [],
    onViewWares 
}) => {

    const locationShop = shops.find(shop => shop.shopId.includes(location.id.toLowerCase().replace(/\s+/g, '_')));
    const hasAccessibleShop = !!locationShop;

    return (
        <div className={styles.panel}>
            <button className={styles.closeButton} onClick={onClose}>
                &times;
            </button>
            {location.image && location.image != '' &&
                <img src={location.image} alt={location.name} className={styles.locationImage} />
            }
            <div className={styles.content}>
                <h2 className={styles.locationName}>{location.name}</h2>
                <p className={styles.description}>{location.playerDescription}</p>
                
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
                {isGM && (
                    <>
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

                        <hr className={styles.divider} />
                        <div className={styles.gmSection}>
                            <h3>GM Notes</h3>
                            <p className={styles.gmNotes}>{location.gmNotes}</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LocationInfoPanel;
