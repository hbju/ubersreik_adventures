import React, {useState, useRef, useEffect} from 'react';
import styles from './MapDisplay.module.css';
import { GameData } from '@wfrp/shared';
import LocationPin from './LocationPin';
import LocationInfoPanel from './LocationInfoPanel';

interface MapDisplayProps {
  gameData: GameData;
}

const MapDisplay: React.FC<MapDisplayProps> = ({ gameData }) => {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);

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

  const handleClosePanel = () => {
    setSelectedLocationId(null);
  };

  const selectedLocation = selectedLocationId ? gameData.locations.find(loc => loc.id === selectedLocationId) : null;

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

      {gameData.locations.map((location) => {
        const scaledX = location.coords.x * dimensions.scale + dimensions.offsetX;
        const scaledY = location.coords.y * dimensions.scale + dimensions.offsetY;
        return (
        <LocationPin
          key={location.id}
          x={scaledX}
          y={scaledY}
          onClick={() => handlePinClick(location.id)}
        />
        );
      })}

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