import React, { useState, useRef, useEffect } from 'react';
import styles from './MapDisplay.module.css';
import { MapData, MapPinState, Character } from '../types/wfrp.types';
import LocationPin from './LocationPin';
import LocationInfoPanel from './LocationInfoPanel';

interface MapDisplayProps {
    mapData: MapData;
    mapPinStates?: Record<string, MapPinState>;
    locationTags?: string[];
    onPinContextMenu?: (event: React.MouseEvent, locationId: string) => void;
    isGM?: boolean;
    onClickPin?: (locationId: string) => void;
    scale: number;
}

const MapDisplay: React.FC<MapDisplayProps> = ({
    mapData,
    mapPinStates = {},
    locationTags = [],
    onPinContextMenu,
    isGM = false,
    onClickPin,
    scale=1,
}) => {
    const [dimensions, setDimensions] = useState({
        scale: scale,
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
                src={mapData.mapImage}
                alt="Map of Ubersreik"
                className={styles.mapImage}
                ref={imageRef}
            />

            {mapData.locations
                .map((location) => {
                    // Use raw coordinates when internal scaling is disabled (MapView handles it)
                    const scaledX = location.coords.x 
                    const scaledY = location.coords.y 
                    const pinState = mapPinStates[location.id];
                    const anyDiscovered = pinState?.playerDiscovered && pinState.playerDiscovered.length > 0;
                    const matchesTagFilter = locationTags.length === 0 || locationTags.includes(location.tag);
                    
                    return (
                        <LocationPin
                            key={location.id}
                            x={scaledX}
                            y={scaledY}
                            onClick={() => (isGM || anyDiscovered) && onClickPin && onClickPin(location.id)}
                            onContextMenu={isGM && onPinContextMenu ? (e) => onPinContextMenu(e, location.id) : undefined}
                            isDiscovered={anyDiscovered && matchesTagFilter}
                            locationName={location.name}
                            tag={location.tag}
                            isGm={isGM}
                            scale={scale}
                        />
                    );
                })}
        </div>
    );
};

export default MapDisplay;
