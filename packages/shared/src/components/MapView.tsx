import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './MapView.module.css';
import { MapData, MapPinState, Character, Location, ShopState, MapToken as MapTokenType, UserMapPin } from '../types/wfrp.types';
import MapDisplay from './MapDisplay';
import LocationInfoPanel from './LocationInfoPanel';
import MapToken from './MapToken';
import MapControls, { MapFilters } from './MapControls';
import UserPin from './UserPin';

interface ViewState {
    scale: number;
    offsetX: number;
    offsetY: number;
}

interface MapPing {
    x: number;
    y: number;
    id: number;
    color?: string;
}

interface MapViewProps {
    mapData: MapData;
    mapPinStates?: Record<string, MapPinState>;
    characters?: Character[];
    onTogglePinDiscovery?: (locationId: string, characterIds: string[]) => void;
    isGM?: boolean;
    viewState?: ViewState;
    onViewStateChange?: (viewState: ViewState) => void;
    onMapPing?: (x: number, y: number) => void;
    incomingPing?: { x: number; y: number; color?: string } | null;
    shops?: ShopState[];
    onViewWares?: (shopId: string) => void;
    tokens?: MapTokenType[];
    userPins?: UserMapPin[];
    locationTags?: string[];
    currentUserId?: string;
    playerColor?: string;
    onTokenMove?: (tokenId: string, x: number, y: number) => void;
    onAddPin?: (x: number, y: number, label: string) => void;
    onRemovePin?: (pinId: string) => void;
    gridScale?: number; // Scale factor for token sizes based on map's gridSize
}

interface ContextMenu {
    locationId: string;
    x: number;
    y: number;
}

interface MapContextMenu {
    x: number;
    y: number;
    mapX: number;
    mapY: number;
}

const MapView: React.FC<MapViewProps> = ({
    mapData,
    mapPinStates = {},
    characters = [],
    onTogglePinDiscovery,
    isGM = false,
    viewState: externalViewState,
    onViewStateChange,
    onMapPing,
    incomingPing,
    shops = [],
    onViewWares,
    tokens = [],
    userPins = [],
    locationTags: externalLocationTags = [],
    currentUserId,
    playerColor = '#d4af37',
    onTokenMove,
    onAddPin,
    onRemovePin,
    gridScale = 1,
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
    const [mapContextMenu, setMapContextMenu] = useState<MapContextMenu | null>(null);
    const [pinLabelInput, setPinLabelInput] = useState('');
    const [showPinModal, setShowPinModal] = useState(false);
    const [pendingPinCoords, setPendingPinCoords] = useState<{ x: number; y: number } | null>(null);

    const handleWheel = useCallback((e: WheelEvent) => {
        e.preventDefault();
        const zoomIntensity = 0.03;
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
            setMapContextMenu(null);
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
        // Alt+Click to ping (for both GM and players)
        if (!hasMoved && e.altKey && onMapPing && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            // Convert screen coordinates to map coordinates
            const mapX = (clickX - viewState.offsetX) / viewState.scale;
            const mapY = (clickY - viewState.offsetY) / viewState.scale;

            onMapPing(mapX, mapY);

            // Also show the ping locally
            const newPingId = ++pingIdRef.current;
            setActivePings(prev => [...prev, { x: mapX, y: mapY, id: newPingId, color: playerColor }]);

            // Remove ping after animation
            setTimeout(() => {
                setActivePings(prev => prev.filter(p => p.id !== newPingId));
            }, 3000);
        }
        // GM can still click without Alt to ping (backward compatibility)
        else if (!hasMoved && isGM && onMapPing && containerRef.current && !e.altKey) {
            const rect = containerRef.current.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            const mapX = (clickX - viewState.offsetX) / viewState.scale;
            const mapY = (clickY - viewState.offsetY) / viewState.scale;

            onMapPing(mapX, mapY);

            const newPingId = ++pingIdRef.current;
            setActivePings(prev => [...prev, { x: mapX, y: mapY, id: newPingId, color: playerColor }]);

            setTimeout(() => {
                setActivePings(prev => prev.filter(p => p.id !== newPingId));
            }, 3000);
        }
        setIsPanning(false);
        setHasMoved(false);
    }, [hasMoved, isGM, onMapPing, viewState, playerColor]);

    // Handle right-click context menu on map for adding pins
    const handleMapContextMenu = useCallback((e: React.MouseEvent) => {
        if (!onAddPin) return; // Only show if pin adding is enabled
        e.preventDefault();

        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;

        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        // Convert to map coordinates
        const mapX = (clickX - viewState.offsetX) / viewState.scale;
        const mapY = (clickY - viewState.offsetY) / viewState.scale;

        setMapContextMenu({
            x: e.clientX,
            y: e.clientY,
            mapX,
            mapY,
        });
    }, [onAddPin, viewState]);

    const handleAddPinClick = () => {
        if (mapContextMenu) {
            setPendingPinCoords({ x: mapContextMenu.mapX, y: mapContextMenu.mapY });
            setShowPinModal(true);
            setMapContextMenu(null);
        }
    };

    const handleConfirmAddPin = () => {
        if (pendingPinCoords && pinLabelInput.trim() && onAddPin) {
            onAddPin(pendingPinCoords.x, pendingPinCoords.y, pinLabelInput.trim());
            setShowPinModal(false);
            setPinLabelInput('');
            setPendingPinCoords(null);
        }
    };

    const handleCancelAddPin = () => {
        setShowPinModal(false);
        setPinLabelInput('');
        setPendingPinCoords(null);
    };

    const handlePinClick = (locationId: string) => {
        selectedLocationId === locationId ? setSelectedLocationId(null) : setSelectedLocationId(locationId);
    };

    const handleClosePanel = () => {
        setSelectedLocationId(null);
    };

    const selectedLocation = selectedLocationId ? mapData.locations.find(loc => loc.id === selectedLocationId) : null;

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

    // Close context menus when clicking elsewhere
    useEffect(() => {
        const handleClick = () => {
            if (contextMenu) {
                setContextMenu(null);
            }
            if (mapContextMenu) {
                setMapContextMenu(null);
            }
        };
        document.addEventListener('click', handleClick);
        return () => document.removeEventListener('click', handleClick);
    }, [contextMenu, mapContextMenu]);

    // Handle incoming pings from other players/GM
    useEffect(() => {
        if (incomingPing) {
            const newPingId = ++pingIdRef.current;
            setActivePings(prev => [...prev, {
                x: incomingPing.x,
                y: incomingPing.y,
                id: newPingId,
                color: incomingPing.color || '#ffa200'
            }]);

            // Remove ping after animation (3 seconds)
            setTimeout(() => {
                setActivePings(prev => prev.filter(p => p.id !== newPingId));
            }, 3000);
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
                onContextMenu={handleMapContextMenu}
                style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
            >

                <div
                    className={styles.mapContent}
                    style={{
                        transform: `translate(${viewState.offsetX}px, ${viewState.offsetY}px) scale(${viewState.scale})`,
                        transformOrigin: '0 0',
                    }}
                >
                    {/* Map Display with optional location pins */}
                    <MapDisplay
                        mapData={mapData}
                        locationTags={externalLocationTags}
                        mapPinStates={mapPinStates}
                        onPinContextMenu={handlePinContextMenu}
                        isGM={isGM}
                        onClickPin={handlePinClick}
                        scale={gridScale}
                    />

                    {/* Render player tokens */}
                    {tokens.map(token => {
                        const character = characters.find(c => c.id === token.characterId);
                        if (!character) return null;

                        const isOwnToken = character.userId === currentUserId;
                        const isDraggable = isGM || isOwnToken;

                        const tokenColor = playerColor;

                        return (
                            <MapToken
                                key={token.id}
                                id={token.id}
                                x={token.x}
                                y={token.y}
                                characterName={character.name}
                                color={tokenColor}
                                isDraggable={isDraggable}
                                isCurrentUser={isOwnToken}
                                onMove={onTokenMove}
                                scale={viewState.scale}
                                tokenScale={gridScale}
                            />
                        );
                    })}

                    {/* Render user's personal pins */}
                    {userPins
                        .filter(pin => pin.playerId === currentUserId || isGM)
                        .map(pin => (
                            <UserPin
                                key={pin.id}
                                x={pin.x}
                                y={pin.y}
                                label={pin.label}
                                color={pin.color || '#4a90d9'}
                                onDelete={onRemovePin ? () => onRemovePin(pin.id) : undefined}
                            />
                        ))}

                    {/* Render active pings */}
                    {activePings.map(ping => (
                        <div
                            key={ping.id}
                            className={styles.mapPing}
                            style={{
                                left: `${ping.x}px`,
                                top: `${ping.y}px`,
                                '--ping-color': ping.color || '#ffa200',
                            } as React.CSSProperties}
                        >
                            <div className={styles.pingRing} style={{ borderColor: ping.color || '#ffa200' }} />
                            <div className={styles.pingRing} style={{ animationDelay: '0.3s', borderColor: ping.color || '#ffa200' }} />
                            <div className={styles.pingCenter} style={{ background: `radial-gradient(circle, ${ping.color || '#ffd700'} 0%, ${ping.color || '#ff8c00'} 100%)` }} />
                        </div>
                    ))}
                </div>
            </div>


            {selectedLocation && (
                <LocationInfoPanel
                    location={selectedLocation}
                    onClose={handleClosePanel}
                    isGM={isGM}
                    shops={shops}
                    onViewWares={onViewWares}
                />
            )}

            {/* GM Context Menu for Location Pins */}
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

            {/* Map Context Menu for Adding Pins */}
            {mapContextMenu && (
                <div
                    className={styles.contextMenu}
                    style={{
                        left: `${mapContextMenu.x}px`,
                        top: `${mapContextMenu.y}px`,
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className={styles.contextMenuItem}
                        onClick={handleAddPinClick}
                    >
                        📌 Add Note
                    </button>
                </div>
            )}

            {/* Add Pin Modal */}
            {showPinModal && (
                <div className={styles.modalOverlay} onClick={handleCancelAddPin}>
                    <div className={styles.pinModal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>Add Personal Note</div>
                        <input
                            type="text"
                            className={styles.pinInput}
                            placeholder="Enter note label..."
                            value={pinLabelInput}
                            onChange={(e) => setPinLabelInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmAddPin();
                                if (e.key === 'Escape') handleCancelAddPin();
                            }}
                            autoFocus
                        />
                        <div className={styles.modalButtons}>
                            <button className={styles.cancelButton} onClick={handleCancelAddPin}>
                                Cancel
                            </button>
                            <button
                                className={styles.confirmButton}
                                onClick={handleConfirmAddPin}
                                disabled={!pinLabelInput.trim()}
                            >
                                Add Note
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MapView;
