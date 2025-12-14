import React, { useState } from 'react';
import { MapData } from '@wfrp/shared';
import { useTranslation } from 'react-i18next';
import styles from './MapSelector.module.css';

interface MapSelectorProps {
    maps: MapData[];
    activeMapId: string;
    onSwitchMap: (mapId: string, moveTokens: boolean) => void;
    onClose: () => void;
}

export const MapSelector: React.FC<MapSelectorProps> = ({
    maps,
    activeMapId,
    onSwitchMap,
    onClose,
}) => {
    const { t } = useTranslation();
    const [confirmMap, setConfirmMap] = useState<MapData | null>(null);

    const activeMap = maps.find(m => m.id === activeMapId);

    const handleMapClick = (map: MapData) => {
        if (map.id === activeMapId) return;
        setConfirmMap(map);
    };

    const handleConfirmSwitch = (moveTokens: boolean) => {
        if (confirmMap) {
            onSwitchMap(confirmMap.id, moveTokens);
            setConfirmMap(null);
            onClose();
        }
    };

    const getMapImagePath = (map: MapData): string => {
        return map.imagePath || map.mapImage || '';
    };

    return (
        <div className={styles.mapSelectorOverlay} onClick={onClose}>
            <div className={styles.mapSelectorPanel} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>{t('map.selector.title', 'Map Selector')}</h2>
                    <button className={styles.closeButton} onClick={onClose}>×</button>
                </div>

                {activeMap && (
                    <div className={styles.currentMapSection}>
                        <div className={styles.currentMapLabel}>
                            {t('map.selector.currentMap', 'Current Map')}
                        </div>
                        <div className={styles.currentMapName}>{activeMap.name}</div>
                    </div>
                )}

                <div className={styles.sectionTitle}>
                    {t('map.selector.availableMaps', 'Available Maps')}
                </div>

                <div className={styles.mapsGrid}>
                    {maps.map(map => (
                        <div
                            key={map.id}
                            className={`${styles.mapCard} ${map.id === activeMapId ? styles.active : ''}`}
                            onClick={() => handleMapClick(map)}
                        >
                            {getMapImagePath(map) ? (
                                <img
                                    src={getMapImagePath(map)}
                                    alt={map.name}
                                    className={styles.mapThumbnail}
                                    onError={(e) => {
                                        // If image fails to load, show placeholder
                                        (e.target as HTMLImageElement).style.display = 'none';
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove(styles.hidden);
                                    }}
                                />
                            ) : (
                                <div className={styles.mapThumbnailPlaceholder}>🗺️</div>
                            )}
                            <div className={styles.mapInfo}>
                                <div className={styles.mapName}>{map.name}</div>
                                <div className={styles.mapMeta}>
                                    <span className={styles.mapMetaItem}>
                                        📍 {map.locations?.length || 0} {t('map.selector.locations', 'locations')}
                                    </span>
                                    <span className={styles.mapMetaItem}>
                                        📏 {map.gridSize}x {t('map.selector.scale', 'scale')}
                                    </span>
                                </div>
                                {map.id === activeMapId ? (
                                    <span className={styles.activeIndicator}>
                                        {t('map.selector.active', 'Active')}
                                    </span>
                                ) : (
                                    <button
                                        className={styles.activateButton}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMapClick(map);
                                        }}
                                    >
                                        {t('map.selector.activateScene', 'Activate Scene')}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <button className={styles.importButton}>
                    + {t('map.selector.importNewMap', 'Import New Map')}
                </button>
            </div>

            {/* Confirmation Modal */}
            {confirmMap && (
                <div className={styles.confirmModal} onClick={() => setConfirmMap(null)}>
                    <div className={styles.confirmContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.confirmTitle}>
                            {t('map.selector.switchTo', 'Switch to')} "{confirmMap.name}"?
                        </div>
                        <div className={styles.confirmText}>
                            {t('map.selector.moveTokensQuestion', 'Would you like to move all player tokens to this map?')}
                        </div>
                        <div className={styles.confirmButtons}>
                            <button
                                className={`${styles.confirmButton} ${styles.confirmYes}`}
                                onClick={() => handleConfirmSwitch(true)}
                            >
                                {t('map.selector.yesMove', 'Yes, Move Tokens')}
                            </button>
                            <button
                                className={`${styles.confirmButton} ${styles.confirmNo}`}
                                onClick={() => handleConfirmSwitch(false)}
                            >
                                {t('map.selector.noKeep', 'No, Keep Positions')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapSelector;
