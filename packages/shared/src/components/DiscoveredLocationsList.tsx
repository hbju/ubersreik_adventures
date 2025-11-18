import React, { useState, useMemo } from 'react';
import styles from './DiscoveredLocationsList.module.css';
import { Location, MapPinState } from '../types/wfrp.types';

interface DiscoveredLocationsListProps {
    locations: Location[];
    mapPinStates: Record<string, MapPinState>;
    onLocationSelect: (location: Location) => void;
    isGm?: boolean;
}

const DiscoveredLocationsList: React.FC<DiscoveredLocationsListProps> = ({
    locations,
    mapPinStates,
    onLocationSelect,
    isGm,
}) => {
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');

    // Get all discovered locations
    const discoveredLocations = useMemo(() => {
        const searchFiltered = locations.filter(location =>
            location.name.toLowerCase().includes(searchTerm.trim().toLowerCase())
        );

        if (isGm)
            return searchFiltered;
        return searchFiltered.filter(location => {
            const pinState = mapPinStates[location.id];
            return pinState?.playerDiscovered && pinState.playerDiscovered.length > 0;
        });
    }, [locations, mapPinStates, searchTerm]);

    // Get all unique tags from discovered locations
    const availableTags = useMemo(() => {
        const tags = new Set<string>();
        discoveredLocations.forEach(location => {
            if (location.tag) {
                tags.add(location.tag);
            }
        });
        return Array.from(tags).sort();
    }, [discoveredLocations]);

    // Filter locations by selected tags
    const filteredLocations = useMemo(() => {
        if (selectedTags.size === 0) {
            return discoveredLocations;
        }
        return discoveredLocations.filter(location => selectedTags.has(location.tag));
    }, [discoveredLocations, selectedTags]);

    const handleTagToggle = (tag: string) => {
        const newSelectedTags = new Set(selectedTags);
        if (newSelectedTags.has(tag)) {
            newSelectedTags.delete(tag);
        } else {
            newSelectedTags.add(tag);
        }
        setSelectedTags(newSelectedTags);
    };

    const handleClearFilters = () => {
        setSelectedTags(new Set());
    };

    const getTagIcon = (tag: string): string => {
        const tagIcons: Record<string, string> = {
            'district': '🏘️',
            'inn': '🏨',
            'tavern': '🍺',
            'shop': '🏪',
            'temple': '⛪',
            'misc': '📍',
            'doctor': '⚕️',
        };
        return tagIcons[tag] || '📍';
    };

    return (
        <div className={styles.listContainer}>
            <div className={styles.listHeader}>
                <h2 className={styles.title}>Discovered Locations</h2>
                <p className={styles.count}>{filteredLocations.length} of {discoveredLocations.length}</p>

                <div className={styles.searchBar}>
                    <input
                        type="text"
                        placeholder="Search locations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={styles.searchInput}
                    />
                </div>

            </div>


            {availableTags.length > 0 && (
                <div className={styles.filterSection}>
                    <div className={styles.filterHeader}>
                        <span className={styles.filterLabel}>Filter by Type:</span>
                        {selectedTags.size > 0 && (
                            <button
                                className={styles.clearButton}
                                onClick={handleClearFilters}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                    <div className={styles.tagFilters}>
                        {availableTags.map(tag => (
                            <label key={tag} className={styles.tagCheckbox}>
                                <input
                                    type="checkbox"
                                    checked={selectedTags.has(tag)}
                                    onChange={() => handleTagToggle(tag)}
                                />
                                <span className={styles.tagLabel}>
                                    {getTagIcon(tag)} {tag}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.locationsList}>
                {filteredLocations.length === 0 ? (
                    <div className={styles.emptyState}>
                        {discoveredLocations.length === 0
                            ? 'No locations discovered yet. Explore the map to find new places!'
                            : 'No locations match the selected filters.'}
                    </div>
                ) : (
                    filteredLocations
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(location => (
                            <button
                                key={location.id}
                                className={styles.locationItem}
                                onClick={() => onLocationSelect(location)}
                            >
                                <span className={styles.locationIcon}>
                                    {getTagIcon(location.tag)}
                                </span>
                                <span className={styles.locationName}>{location.name}</span>
                                <span className={styles.locationTag}>{location.tag}</span>
                            </button>
                        ))
                )}
            </div>
        </div>
    );
};

export default DiscoveredLocationsList;
