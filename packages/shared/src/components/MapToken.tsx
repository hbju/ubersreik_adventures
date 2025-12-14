import React, { useState, useCallback, useEffect, useRef } from 'react';
import styles from './MapToken.module.css';

interface MapTokenProps {
    id: string;
    x: number;
    y: number;
    avatarUrl?: string;
    characterName: string;
    color: string;
    isDraggable: boolean;
    isCurrentUser?: boolean;
    onMove?: (tokenId: string, x: number, y: number) => void;
    scale?: number; // View scale for coordinate transformations
    tokenScale?: number; // Visual scale for token size (from map's gridSize)
}

const MapToken: React.FC<MapTokenProps> = ({
    id,
    x,
    y,
    avatarUrl,
    characterName,
    color,
    isDraggable,
    isCurrentUser = false,
    onMove,
    scale = 1,
    tokenScale = 1,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [localPosition, setLocalPosition] = useState({ x, y });
    const tokenRef = useRef<HTMLDivElement>(null);

    // Update local position when props change (e.g., from server updates)
    useEffect(() => {
        if (!isDragging) {
            console.log('Updating local position to:', { x, y });
            setLocalPosition({ x, y });
        }
    }, [x, y]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isDraggable) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = tokenRef.current?.getBoundingClientRect();
        if (rect) {
            setDragOffset({
                x: e.clientX - rect.left - rect.width / 2,
                y: e.clientY - rect.top - rect.height / 2,
            });
        }
        setIsDragging(true);
    }, [isDraggable]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !tokenRef.current) return;

        // Get the map content container (parent's parent)
        const mapContent = tokenRef.current.closest('[class*="mapContent"]');
        if (!mapContent) return;

        const mapRect = mapContent.getBoundingClientRect();
        
        // Calculate new position in map coordinates
        const newX = (e.clientX - mapRect.left - dragOffset.x) / scale;
        const newY = (e.clientY - mapRect.top - dragOffset.y) / scale;

        setLocalPosition({ x: newX, y: newY });
    }, [isDragging, dragOffset, scale]);

    const handleMouseUp = useCallback(() => {
        if (isDragging && onMove) {
            onMove(id, localPosition.x, localPosition.y);
        }
        setIsDragging(false);
    }, [isDragging, onMove, id, localPosition]);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Get initials from character name for fallback avatar
    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(word => word[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div
            ref={tokenRef}
            className={`${styles.token} ${isDragging ? styles.dragging : ''} ${isCurrentUser ? styles.currentUser : ''}`}
            style={{
                left: `${localPosition.x}px`,
                top: `${localPosition.y}px`,
                borderColor: color,
                cursor: isDraggable ? (isDragging ? 'grabbing' : 'grab') : 'default',
                transform: `translate(-50%, -50%) scale(${tokenScale})`,
            }}
            onMouseDown={handleMouseDown}
            title={characterName}
        >
            {avatarUrl ? (
                <img src={avatarUrl} alt={characterName} className={styles.avatar} />
            ) : (
                <div className={styles.initials} style={{ backgroundColor: color }}>
                    {getInitials(characterName)}
                </div>
            )}
            <div className={styles.nameLabel}>{characterName}</div>
            {isCurrentUser && <div className={styles.youIndicator}>YOU</div>}
        </div>
    );
};

export default MapToken;
