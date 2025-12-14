import React, {useState, useRef, useEffect} from 'react';
import styles from './MapDisplay.module.css';
import { MapData, MapPinState, Character } from '@wfrp/shared';
import LocationPin from './LocationPin';
import LocationInfoPanel from './LocationInfoPanel';

interface MapDisplayProps {
  mapData: MapData;
  mapPinStates?: Record<string, MapPinState>;
  characters?: Character[];
  onTogglePinDiscovery?: (locationId: string, characterId: string) => void;
  isGM?: boolean;
}

interface ContextMenu {
  locationId: string;
  x: number;
  y: number;
}

const MapDisplay: React.FC<MapDisplayProps> = ({ 
  mapData, 
  mapPinStates = {}, 
  characters = [],
  onTogglePinDiscovery,
  isGM = false 
}) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

  const [dimensions, setDimensions] = useState({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handlePinClick = (locationId: string) => {
    selectedLocationId === locationId ? setSelectedLocationId(null) : setSelectedLocationId(locationId);
  };

  const handlePinContextMenu = (event: React.MouseEvent, locationId: string) => {
    if (!isGM) return; // Context menu only for GM
    event.preventDefault();
    setContextMenu({
      locationId,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleToggleDiscoveryForAll = () => {
    if (!contextMenu || !onTogglePinDiscovery) return;
    
    const pinState = mapPinStates[contextMenu.locationId];
    const allDiscovered = characters.every(char => 
      pinState?.playerDiscovered.includes(char.id)
    );

    // Toggle all: if all discovered, remove all; if any not discovered, add all
    characters.forEach(char => {
      if (allDiscovered) {
        // Remove all
        if (pinState?.playerDiscovered.includes(char.id)) {
          onTogglePinDiscovery(contextMenu.locationId, char.id);
        }
      } else {
        // Add all
        if (!pinState?.playerDiscovered.includes(char.id)) {
          onTogglePinDiscovery(contextMenu.locationId, char.id);
        }
      }
    });

    setContextMenu(null);
  };

  const handleToggleDiscoveryForPlayer = (characterId: string) => {
    if (!contextMenu || !onTogglePinDiscovery) return;
    onTogglePinDiscovery(contextMenu.locationId, characterId);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleClosePanel = () => {
    setSelectedLocationId(null);
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const selectedLocation = selectedLocationId ? mapData.locations.find(loc => loc.id === selectedLocationId) : null;

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

      {mapData.locations.map((location) => {
        const scaledX = location.coords.x * dimensions.scale + dimensions.offsetX;
        const scaledY = location.coords.y * dimensions.scale + dimensions.offsetY;
        const pinState = mapPinStates[location.id];
        const anyDiscovered = pinState?.playerDiscovered && pinState.playerDiscovered.length > 0;
        
        return (
        <LocationPin
          key={location.id}
          x={scaledX}
          y={scaledY}
          onClick={() => handlePinClick(location.id)}
          onContextMenu={isGM ? (e) => handlePinContextMenu(e, location.id) : undefined}
          isDiscovered={anyDiscovered}
        />
        );
      })}

      {/* Context Menu for GM */}
      {isGM && contextMenu && (
        <div
          className={styles.contextMenu}
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.contextMenuHeader}>
            {mapData.locations.find(l => l.id === contextMenu.locationId)?.name}
          </div>
          <button
            className={styles.contextMenuItem}
            onClick={handleToggleDiscoveryForAll}
          >
            {mapPinStates[contextMenu.locationId]?.playerDiscovered.length === characters.length
              ? '🔒 Hide from All'
              : '🌟 Reveal to All'}
          </button>
          <div className={styles.contextMenuDivider} />
          {characters.map((character) => {
            const isDiscovered = mapPinStates[contextMenu.locationId]?.playerDiscovered.includes(character.id);
            return (
              <button
                key={character.id}
                className={styles.contextMenuItem}
                onClick={() => handleToggleDiscoveryForPlayer(character.id)}
              >
                {isDiscovered ? '✓' : '○'} {character.name}
              </button>
            );
          })}
        </div>
      )}

      {selectedLocation && (
        <LocationInfoPanel
          location={selectedLocation}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
};

export default MapDisplay;