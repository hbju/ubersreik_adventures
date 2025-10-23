import React from 'react';
import styles from './LocationPin.module.css';

interface LocationPinProps {
  x: number;
  y: number;
  onClick: () => void; 
}

const LocationPin: React.FC<LocationPinProps> = ({ x, y, onClick }) => {
  return (
    <div
      className={styles.pin}
      style={{
        left: `${x}px`,
        top: `${y}px`,
      }}
      onClick={onClick}
    />
  );
};

export default LocationPin;