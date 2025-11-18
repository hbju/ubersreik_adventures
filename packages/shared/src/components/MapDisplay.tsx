import React, { useState, useRef, useEffect } from 'react';
import styles from './MapDisplay.module.css';
import { GameData, MapPinState, Character } from '../types/wfrp.types';
import LocationPin from './LocationPin';
import LocationInfoPanel from './LocationInfoPanel';

interface MapDisplayProps {
    gameData: GameData;
    mapPinStates?: Record<string, MapPinState>;
    onPinContextMenu?: (event: React.MouseEvent, locationId: string) => void;
    isGM?: boolean;
    onClickPin?: (locationId: string) => void;
}

const MapDisplay: React.FC<MapDisplayProps> = ({
    gameData,
    mapPinStates = {},
    onPinContextMenu,
    isGM = false,
    onClickPin,
}) => {
    const [dimensions, setDimensions] = useState({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    });

    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);

    
    useEffect(() => {
        const calculateDimensions = () => {
            if (!containerRef.current || !imageRef.current) return;
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;

            const imageWidth = imageRef.current.naturalWidth;
            const imageHeight = imageRef.current.naturalHeight;

            if (imageWidth === 0 || imageHeight === 0) return;

            const imageRatio = imageWidth / imageHeight;
            const containerRatio = containerWidth / containerHeight;

            let offsetX = 0;
            let offsetY = 0;
            let scale = 1;

            if (imageRatio > containerRatio) {
                scale = containerWidth / imageWidth;
                offsetY = (containerHeight - imageHeight * scale) / 2;
            } else {
                scale = containerHeight / imageHeight;
                offsetX = (containerWidth - imageWidth * scale) / 2;
            }
            setDimensions({ scale, offsetX, offsetY });
        };

        const imageElement = imageRef.current;
        if (imageElement) {
            imageElement.addEventListener('load', calculateDimensions);
        }
        window.addEventListener('resize', calculateDimensions);

        calculateDimensions();

        return () => {
            if (imageElement) {
                imageElement.removeEventListener('load', calculateDimensions);
            }
            window.removeEventListener('resize', calculateDimensions);
        };
    }, []);

    return (
        <div className={styles.mapContainer} ref={containerRef}>
            <img
                src={gameData.mapImage}
                alt="Map of Ubersreik"
                className={styles.mapImage}
                ref={imageRef}
            />

            {gameData.locations
                .map((location) => {
                    // Use raw coordinates when internal scaling is disabled (MapView handles it)
                    const scaledX = location.coords.x 
                    const scaledY = location.coords.y 
                    const pinState = mapPinStates[location.id];
                    const anyDiscovered = pinState?.playerDiscovered && pinState.playerDiscovered.length > 0;

                    return (
                        <LocationPin
                            key={location.id}
                            x={scaledX}
                            y={scaledY}
                            onClick={() => (isGM || anyDiscovered) && onClickPin && onClickPin(location.id)}
                            onContextMenu={isGM && onPinContextMenu ? (e) => onPinContextMenu(e, location.id) : undefined}
                            isDiscovered={anyDiscovered}
                            locationName={location.name}
                            tag={location.tag}
                            isGm={isGM}
                        />
                    );
                })}
        </div>
    );
};

export default MapDisplay;
