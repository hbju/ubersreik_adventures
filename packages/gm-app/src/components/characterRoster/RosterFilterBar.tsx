import React from 'react';
import styles from './RosterFilterBar.module.css';

export type CharacterTypeFilter = 'all' | 'pcs' | 'npcs';
export type ViewMode = 'list' | 'location' | 'faction';

interface RosterFilterBarProps {
    searchTerm: string;
    onSearchChange: (value: string) => void;
    typeFilter: CharacterTypeFilter;
    onTypeFilterChange: (value: CharacterTypeFilter) => void;
    selectedTags: string[];
    onSelectedTagsChange: (tags: string[]) => void;
    availableTags: string[];
    viewMode: ViewMode;
    onViewModeChange: (mode: ViewMode) => void;
}

const RosterFilterBar: React.FC<RosterFilterBarProps> = ({
    searchTerm,
    onSearchChange,
    typeFilter,
    onTypeFilterChange,
    selectedTags,
    onSelectedTagsChange,
    availableTags,
    viewMode,
    onViewModeChange,
}) => {
    const [tagDropdownOpen, setTagDropdownOpen] = React.useState(false);

    const handleTagToggle = (tag: string) => {
        if (selectedTags.includes(tag)) {
            onSelectedTagsChange(selectedTags.filter(t => t !== tag));
        } else {
            onSelectedTagsChange([...selectedTags, tag]);
        }
    };

    const clearTags = () => {
        onSelectedTagsChange([]);
    };

    return (
        <div className={styles.filterBar}>
            {/* Search Input */}
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    placeholder="Search characters..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className={styles.searchInput}
                />
                {searchTerm && (
                    <button
                        className={styles.clearSearch}
                        onClick={() => onSearchChange('')}
                        title="Clear search"
                    >
                        ×
                    </button>
                )}
            </div>

            {/* Type Toggle */}
            <div className={styles.typeToggle}>
                <button
                    className={`${styles.toggleBtn} ${typeFilter === 'all' ? styles.active : ''}`}
                    onClick={() => onTypeFilterChange('all')}
                >
                    All
                </button>
                <button
                    className={`${styles.toggleBtn} ${typeFilter === 'pcs' ? styles.active : ''}`}
                    onClick={() => onTypeFilterChange('pcs')}
                >
                    PCs
                </button>
                <button
                    className={`${styles.toggleBtn} ${typeFilter === 'npcs' ? styles.active : ''}`}
                    onClick={() => onTypeFilterChange('npcs')}
                >
                    NPCs
                </button>
            </div>

            {/* Tag Filter Multi-Select */}
            <div className={styles.tagFilter}>
                <button
                    className={styles.tagDropdownBtn}
                    onClick={() => setTagDropdownOpen(!tagDropdownOpen)}
                >
                    Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
                    <span className={styles.dropdownArrow}>{tagDropdownOpen ? '▲' : '▼'}</span>
                </button>
                {tagDropdownOpen && (
                    <div className={styles.tagDropdown}>
                        {availableTags.length === 0 ? (
                            <div className={styles.noTags}>No tags available</div>
                        ) : (
                            <>
                                {selectedTags.length > 0 && (
                                    <button className={styles.clearTagsBtn} onClick={clearTags}>
                                        Clear all
                                    </button>
                                )}
                                {availableTags.map(tag => (
                                    <label key={tag} className={styles.tagOption}>
                                        <input
                                            type="checkbox"
                                            checked={selectedTags.includes(tag)}
                                            onChange={() => handleTagToggle(tag)}
                                        />
                                        <span>{tag}</span>
                                    </label>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* View Mode Toggle */}
            <div className={styles.viewModeToggle}>
                <button
                    className={`${styles.viewBtn} ${viewMode === 'list' ? styles.active : ''}`}
                    onClick={() => onViewModeChange('list')}
                    title="List View"
                >
                    ☰
                </button>
                <button
                    className={`${styles.viewBtn} ${viewMode === 'location' ? styles.active : ''}`}
                    onClick={() => onViewModeChange('location')}
                    title="Group by Location"
                >
                    📍
                </button>
                <button
                    className={`${styles.viewBtn} ${viewMode === 'faction' ? styles.active : ''}`}
                    onClick={() => onViewModeChange('faction')}
                    title="Group by Faction"
                >
                    🏛️
                </button>
            </div>
        </div>
    );
};

export default RosterFilterBar;
