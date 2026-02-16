import React from 'react';
import { Location, ShopState, Faction, LocationTerritory } from '../types/wfrp.types';
import styles from './LocationInfoPanel.module.css';

interface LocationInfoPanelProps {
    location: Location;
    onClose: () => void;
    isGM?: boolean; 
    shops?: ShopState[];
    onViewWares?: (shopId: string) => void;
    factions?: Faction[];
    onUpdateLocation?: (location: Location) => void;
    locationTerritories?: Record<string, LocationTerritory>;
    onUpdateTerritory?: (locationId: string, territory: LocationTerritory | null) => void;
}

const LocationInfoPanel: React.FC<LocationInfoPanelProps> = ({
    location,
    onClose,
    isGM = false,
    shops = [],
    onViewWares,
    factions = [],
    onUpdateLocation,
    locationTerritories = {},
    onUpdateTerritory,
}) => {

    const locationShop = shops.find(shop => shop.shopId.includes(location.id.toLowerCase().replace(/\s+/g, '_')));
    const hasAccessibleShop = !!locationShop;

    const territory = locationTerritories[location.id];
    const currentFactionId = territory?.controllingFactionId || '';
    const currentWeight = territory?.influenceWeight ?? 1;

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

                        {/* Faction Territory Controls */}
                        {factions.length > 0 && onUpdateTerritory && (
                            <div className={styles.gmSection}>
                                <h3>🏰 Territory</h3>
                                <div className={styles.territoryControls}>
                                    <label className={styles.territoryLabel}>
                                        Controlling Faction
                                        <select
                                            className={styles.territorySelect}
                                            value={currentFactionId}
                                            onChange={(e) => {
                                                const factionId = e.target.value;
                                                if (factionId) {
                                                    onUpdateTerritory(location.id, {
                                                        controllingFactionId: factionId,
                                                        influenceWeight: currentWeight,
                                                    });
                                                } else {
                                                    onUpdateTerritory(location.id, null);
                                                }
                                            }}
                                        >
                                            <option value="">— None —</option>
                                            {factions.map(f => (
                                                <option key={f.id} value={f.id}>
                                                    {f.name}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    {currentFactionId && (
                                        <label className={styles.territoryLabel}>
                                            Influence Weight: {currentWeight}
                                            <input
                                                type="range"
                                                min="1"
                                                max="5"
                                                value={currentWeight}
                                                className={styles.territorySlider}
                                                onChange={(e) => {
                                                    onUpdateTerritory(location.id, {
                                                        controllingFactionId: currentFactionId,
                                                        influenceWeight: parseInt(e.target.value, 10),
                                                    });
                                                }}
                                            />
                                            <div className={styles.territoryScale}>
                                                <span>1 — Shop</span>
                                                <span>3 — HQ</span>
                                                <span>5 — Stronghold</span>
                                            </div>
                                        </label>
                                    )}
                                </div>
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
