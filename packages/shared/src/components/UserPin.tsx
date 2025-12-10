import React from 'react';
import styles from './UserPin.module.css';

interface UserPinProps {
    x: number;
    y: number;
    label: string;
    color?: string;
    onClick?: () => void;
    onDelete?: () => void;
}

const UserPin: React.FC<UserPinProps> = ({
    x,
    y,
    label,
    color = '#4a90d9',
    onClick,
    onDelete,
}) => {
    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onDelete) {
            // Simple confirmation for now
            if (window.confirm(`Delete note "${label}"?`)) {
                onDelete();
            }
        }
    };

    return (
        <div
            className={styles.userPin}
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
            onClick={onClick}
            onContextMenu={handleContextMenu}
            title={label}
        >
            <div className={styles.pinIcon} style={{ backgroundColor: color }}>
                📌
            </div>
            <div className={styles.pinLabel} style={{ borderColor: color }}>
                {label}
            </div>
        </div>
    );
};

export default UserPin;
