import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './MapTransitionOverlay.module.css';

interface MapTransitionOverlayProps {
    isVisible: boolean;
    destinationName?: string;
    onTransitionComplete?: () => void;
}

export const MapTransitionOverlay: React.FC<MapTransitionOverlayProps> = ({
    isVisible,
    destinationName,
    onTransitionComplete,
}) => {
    const { t } = useTranslation();
    const [isFadingOut, setIsFadingOut] = useState(false);

    useEffect(() => {
        if (isVisible && !isFadingOut) {
            return;
        }
        
        if (isVisible && isFadingOut) {
            console.log('Starting fade out transition');
            const timer = setTimeout(() => {
                setIsFadingOut(false);
                onTransitionComplete?.();
                console.log('Transition complete callback executed');
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isVisible, isFadingOut, onTransitionComplete]);

    // When becoming invisible, trigger fade out
    useEffect(() => {
        if (isVisible) {
            setIsFadingOut(true);
        }
    }, [isVisible]);

    if (!isVisible && !isFadingOut) {
        return null;
    }

    return (
        <div className={`${styles.transitionOverlay} ${isFadingOut ? styles.fadeOut : ''}`}>
            <div className={styles.transitionContent}>
                <div className={styles.travelIcon}>🚶</div>
                <div className={styles.travelText}>
                    {t('map.transition.traveling', 'Traveling...')}
                </div>
                {destinationName && (
                    <div className={styles.destinationText}>
                        {t('map.transition.destination', 'Destination')}: {destinationName}
                    </div>
                )}
                <div className={styles.spinner} />
            </div>
        </div>
    );
};

export default MapTransitionOverlay;
