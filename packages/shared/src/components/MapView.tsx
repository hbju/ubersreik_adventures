import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './MapView.module.css';
import { GameData, MapPinState, Character, Location } from '../types/wfrp.types';
import MapDisplay from './MapDisplay';
import LocationInfoPanel from './LocationInfoPanel';

interface ViewState {
    scale: number;
    offsetX: number;
    offsetY: number;
}

interface MapPing {
    x: number;
    y: number;
    id: number;
}

interface MapViewProps {
    gameData: GameData;
    mapPinStates?: Record<string, MapPinState>;
    characters?: Character[];
    onTogglePinDiscovery?: (locationId: string, characterIds: string[]) => void;
    isGM?: boolean;
    viewState?: ViewState;
    onViewStateChange?: (viewState: ViewState) => void;
    onMapPing?: (x: number, y: number) => void;
    incomingPing?: { x: number; y: number } | null;
}

interface ContextMenu {
    locationId: string;
    x: number;
    y: number;
}

const MapView: React.FC<MapViewProps> = ({
    gameData,
    mapPinStates = {},
    characters = [],
    onTogglePinDiscovery,
    isGM = false,
    viewState: externalViewState,
    onViewStateChange,
    onMapPing,
    incomingPing,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const [internalViewState, setInternalViewState] = useState<ViewState>({
        scale: 0.2,
        offsetX: containerRef.current ? containerRef.current.clientWidth / 2 : 0,
        offsetY: containerRef.current ? containerRef.current.clientHeight / 2 : 0,
    });

    const viewState = externalViewState || internalViewState;
    const setViewState = onViewStateChange || setInternalViewState;

    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [hasMoved, setHasMoved] = useState(false);
    const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
    const [activePings, setActivePings] = useState<MapPing[]>([]);
    const pingIdRef = useRef(0);

    const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const zoomIntensity = 0.1;
        const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
        const newScale = Math.max(0.2, Math.min(3, viewState.scale + delta));

        // Get mouse position relative to the container
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Calculate the new offset to zoom towards the mouse position
            const scaleRatio = newScale / viewState.scale;
            const newOffsetX = mouseX - (mouseX - viewState.offsetX) * scaleRatio;
            const newOffsetY = mouseY - (mouseY - viewState.offsetY) * scaleRatio;

            setViewState({
                scale: newScale,
                offsetX: newOffsetX,
                offsetY: newOffsetY,
            });
        }
    }, [viewState, setViewState]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button === 0) { // Left mouse button
            setIsPanning(true);
            setHasMoved(false);
            setContextMenu(null);
            setPanStart({ x: e.clientX, y: e.clientY });
        }
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isPanning) {
            const deltaX = e.clientX - panStart.x;
            const deltaY = e.clientY - panStart.y;

            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                setHasMoved(true);
            }

            setViewState({
                ...viewState,
                offsetX: viewState.offsetX + deltaX,
                offsetY: viewState.offsetY + deltaY,
            });

            setPanStart({ x: e.clientX, y: e.clientY });
        }
    }, [isPanning, panStart, viewState, setViewState]);

    const handleMouseUp = useCallback((e: MouseEvent) => {
        if (!hasMoved && isGM && onMapPing && containerRef.current) {
            // This was a click, not a drag - send a ping
            const rect = containerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            
            // Convert screen coordinates to map coordinates
            const mapX = (clickX - viewState.offsetX) / viewState.scale;
            const mapY = (clickY - viewState.offsetY) / viewState.scale;
            
            onMapPing(mapX, mapY);
            
            // Also show the ping locally for the GM
            const newPingId = ++pingIdRef.current;
            setActivePings(prev => [...prev, { x: mapX, y: mapY, id: newPingId }]);
            
            // Remove ping after animation
            setTimeout(() => {
                setActivePings(prev => prev.filter(p => p.id !== newPingId));
            }, 2000);
        }
        setIsPanning(false);
        setHasMoved(false);
    }, [hasMoved, isGM, onMapPing, viewState]);

    const handlePinClick = (locationId: string) => {
        selectedLocationId === locationId ? setSelectedLocationId(null) : setSelectedLocationId(locationId);
    };

    const handleClosePanel = () => {
        setSelectedLocationId(null);
    };

    const selectedLocation = selectedLocationId ? gameData.locations.find(loc => loc.id === selectedLocationId) : null;

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

        const characterIds: string[] = [];
        characters.forEach(char => {
            console.log('Toggling discovery for character:', char.name);
            if (allDiscovered) {
                // Remove all
                if (pinState?.playerDiscovered.includes(char.id)) {
                    characterIds.push(char.id);
                }
            } else {
                // Add all
                if (!pinState?.playerDiscovered.includes(char.id)) {
                    characterIds.push(char.id);
                }
            }
        });
        onTogglePinDiscovery(contextMenu.locationId, characterIds);
        setContextMenu(null);
    };

    const handleToggleDiscoveryForPlayer = (characterId: string) => {
        if (!contextMenu || !onTogglePinDiscovery) return;
        onTogglePinDiscovery(contextMenu.locationId, [characterId]);
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

    // Handle incoming pings from GM
    useEffect(() => {
        if (incomingPing) {
            const newPingId = ++pingIdRef.current;
            setActivePings(prev => [...prev, { x: incomingPing.x, y: incomingPing.y, id: newPingId }]);
            
            // Remove ping after animation
            setTimeout(() => {
                setActivePings(prev => prev.filter(p => p.id !== newPingId));
            }, 2000);
        }
    }, [incomingPing]);



    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            container.addEventListener('wheel', handleWheel, { passive: false });
            return () => container.removeEventListener('wheel', handleWheel);
        }
    }, [handleWheel]);

    useEffect(() => {
        if (isPanning) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isPanning, handleMouseMove, handleMouseUp]);

    return (
        <div>
            <div
                ref={containerRef}
                className={styles.mapViewContainer}
                onMouseDown={handleMouseDown}
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            >
                <div
                    className={styles.mapContent}
                    style={{
                        transform: `translate(${viewState.offsetX}px, ${viewState.offsetY}px) scale(${viewState.scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                    <MapDisplay
                        gameData={gameData}
                        mapPinStates={mapPinStates}
                        onPinContextMenu={handlePinContextMenu}
                        isGM={isGM}
                        onClickPin={handlePinClick}
                    />
                    {/* Render active pings */}
                    {activePings.map(ping => (
                        <div
                            key={ping.id}
                            className={styles.mapPing}
                            style={{
                                left: `${ping.x}px`,
                                top: `${ping.y}px`,
                            }}
                        >
                            <div className={styles.pingRing} />
                            <div className={styles.pingRing} style={{ animationDelay: '0.3s' }} />
                            <div className={styles.pingCenter} />
                        </div>
                    ))}
                </div>
            </div>


            {selectedLocation && (
                <LocationInfoPanel
                    location={selectedLocation}
                    onClose={handleClosePanel}
                    isGM={isGM}
                />
            )}

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
                        {gameData.locations.find(l => l.id === contextMenu.locationId)?.name}
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
                    {characters.filter(character => character.userId != null).map((character) => {
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
        </div>
    );
};

export default MapView;
