import React from 'react';
import styles from './MapControls.module.css';

export interface MapFilters {
    showLocations: boolean;
    showTokens: boolean;
    showMyPins: boolean;
}

interface MapControlsProps {
    filters: MapFilters;
    onFiltersChange: (filters: MapFilters) => void;
    isGM?: boolean;
}

const MapControls: React.FC<MapControlsProps> = ({
    filters,
    onFiltersChange,
    isGM = false,
}) => {
    const handleToggle = (key: keyof MapFilters) => {
        onFiltersChange({
            ...filters,
            [key]: !filters[key],
        });
    };

    return (
        <div className={styles.controlsPanel}>
            <div className={styles.header}>
                <span className={styles.icon}>🗺️</span>
                Map Filters
            </div>
            <div className={styles.filterList}>
                <label className={styles.filterItem}>
                    <input
                        type="checkbox"
                        checked={filters.showLocations}
                        onChange={() => handleToggle('showLocations')}
                        className={styles.checkbox}
                    />
                    <span className={styles.filterIcon}>📍</span>
                    <span className={styles.filterLabel}>
                        {isGM ? 'All Locations' : 'Discovered Locations'}
                    </span>
                </label>

                <label className={styles.filterItem}>
                    <input
                        type="checkbox"
                        checked={filters.showTokens}
                        onChange={() => handleToggle('showTokens')}
                        className={styles.checkbox}
                    />
                    <span className={styles.filterIcon}>👤</span>
                    <span className={styles.filterLabel}>Player Tokens</span>
                </label>

                <label className={styles.filterItem}>
                    <input
                        type="checkbox"
                        checked={filters.showMyPins}
                        onChange={() => handleToggle('showMyPins')}
                        className={styles.checkbox}
                    />
                    <span className={styles.filterIcon}>📌</span>
                    <span className={styles.filterLabel}>My Notes</span>
                </label>
            </div>
        </div>
    );
};

export default MapControls;
