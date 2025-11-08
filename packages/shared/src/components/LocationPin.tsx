import React from 'react';
import styles from './LocationPin.module.css';

interface LocationPinProps {
    x: number;
    y: number;
    onClick: () => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    isDiscovered?: boolean; // Visual indicator for GM
    locationName: string;
}

const LocationPin: React.FC<LocationPinProps> = ({ x, y, onClick, onContextMenu, isDiscovered = false, locationName }) => {
    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        if (onContextMenu) {
            onContextMenu(event);
        }
    };

    return (
        <div
            className={`${styles.pin} ${isDiscovered ? styles.discovered : styles.hidden}`}
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            title={isDiscovered ? locationName : "Not Discovered"}
        />
    );
};

export default LocationPin;
