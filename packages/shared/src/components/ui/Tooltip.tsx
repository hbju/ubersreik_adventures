import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
}

/**
 * Tooltip component that displays content on hover.
 * Uses a portal to render the tooltip at the document root for proper z-index handling.
 */
export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  className = '',
  position = 'top',
  delay = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    let x = rect.left + scrollX + rect.width / 2;
    let y = rect.top + scrollY;
    
    switch (position) {
      case 'bottom':
        y = rect.bottom + scrollY + 8;
        break;
      case 'left':
        x = rect.left + scrollX - 8;
        y = rect.top + scrollY + rect.height / 2;
        break;
      case 'right':
        x = rect.right + scrollX + 8;
        y = rect.top + scrollY + rect.height / 2;
        break;
      case 'top':
      default:
        y = rect.top + scrollY - 8;
        break;
    }
    
    setCoords({ x, y });
  };

  const handleMouseEnter = () => {
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsVisible(true);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // Adjust position if tooltip would overflow viewport
  useEffect(() => {
    if (!isVisible || !tooltipRef.current) return;
    
    const tooltip = tooltipRef.current;
    const rect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let adjustedX = coords.x;
    let adjustedY = coords.y;
    
    // Prevent overflow on right
    if (rect.right > viewportWidth) {
      adjustedX -= (rect.right - viewportWidth + 10);
    }
    
    // Prevent overflow on left
    if (rect.left < 0) {
      adjustedX += Math.abs(rect.left) + 10;
    }
    
    // Prevent overflow on bottom
    if (rect.bottom > viewportHeight) {
      adjustedY -= (rect.bottom - viewportHeight + 10);
    }
    
    // Prevent overflow on top
    if (rect.top < 0) {
      adjustedY += Math.abs(rect.top) + 10;
    }
    
    if (adjustedX !== coords.x || adjustedY !== coords.y) {
      setCoords({ x: adjustedX, y: adjustedY });
    }
  }, [isVisible, coords]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: position === 'left' ? `${coords.x}px` : position === 'right' ? `${coords.x}px` : `${coords.x}px`,
    top: position === 'top' ? `${coords.y}px` : position === 'bottom' ? `${coords.y}px` : `${coords.y}px`,
    transform: position === 'top' 
      ? 'translate(-50%, -100%)' 
      : position === 'bottom' 
        ? 'translate(-50%, 0)' 
        : position === 'left' 
          ? 'translate(-100%, -50%)' 
          : 'translate(0, -50%)',
  };

  return (
    <>
      <span
        ref={triggerRef}
        className={`${styles.tooltipTrigger} ${className}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
      </span>
      {isVisible && content && createPortal(
        <div
          ref={tooltipRef}
          className={`${styles.tooltip} ${styles[position]}`}
          style={tooltipStyle}
          role="tooltip"
        >
          <div className={styles.tooltipContent}>
            {content}
          </div>
          <div className={styles.tooltipArrow} />
        </div>,
        document.body
      )}
    </>
  );
};

export default Tooltip;
