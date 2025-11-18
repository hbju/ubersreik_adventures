import React from 'react';
import styles from './LocationPin.module.css';

interface LocationPinProps {
    x: number;
    y: number;
    onClick: () => void;
    onContextMenu?: (event: React.MouseEvent) => void;
    isDiscovered?: boolean; // Visual indicator for GM
    locationName: string;
    tag: string;
    isGm? : boolean;
}

const LocationPin: React.FC<LocationPinProps> = ({ x, y, onClick, onContextMenu, isDiscovered = false, locationName, tag, isGm = false }) => {
    const handleContextMenu = (event: React.MouseEvent) => {
        event.preventDefault();
        if (onContextMenu) {
            onContextMenu(event);
        }
    };

    return (
        <div
            className={`${styles.pin} ${isDiscovered || isGm ? styles[tag] : styles.hidden}`}
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            title={isDiscovered || isGm ? locationName : "Not Discovered"}
        />
    );
};

export default LocationPin;
