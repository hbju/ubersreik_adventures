import React, { useCallback } from 'react';
import { QuestObjective, Location, MapPinState } from '@wfrp/shared';
import styles from './ObjectiveItem.module.css';
import { useDebouncedCallback } from '@wfrp/shared';

interface ObjectiveItemProps {
    objective: QuestObjective;
    locations: Location[];
    mapPinStates: Record<string, MapPinState>;
    characterId: string;
    onUpdate: (updated: QuestObjective) => void;
    onDelete: () => void;
    onGoToMap: (locationId: string) => void;
}

export const ObjectiveItem: React.FC<ObjectiveItemProps> = ({
    objective,
    locations,
    mapPinStates,
    characterId,
    onUpdate,
    onDelete,
    onGoToMap,
}) => {
    const [localDescription, setLocalDescription] = React.useState(objective.text);

    const discoveredLocations = locations.filter(location => {
        const pinState = mapPinStates[location.id];
        if (!pinState) return false;
        return pinState.playerDiscovered.includes(characterId);
    });
    
    const debouncedUpdate = useDebouncedCallback(onUpdate, 300);

    const handleToggleComplete = () => {
        onUpdate({
            ...objective,
            isCompleted: !objective.isCompleted,
        });
    };

    const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const newText = e.target.value;
        setLocalDescription(newText);
        debouncedUpdate({
            ...objective,
            text: newText,
        });
    }, [objective, debouncedUpdate]);

    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const locationId = e.target.value || undefined;
        onUpdate({
            ...objective,
            locationId,
        });
    };

    const handleGoToMap = () => {
        if (objective.locationId) {
            onGoToMap(objective.locationId);
        }
    };

    const selectedLocation = locations.find(l => l.id === objective.locationId);

    return (
        <div className={`${styles.objectiveItem} ${objective.isCompleted ? styles.completed : ''}`}>
            <div
                className={`${styles.checkbox} ${objective.isCompleted ? styles.checked : ''}`}
                onClick={handleToggleComplete}
                role="checkbox"
                aria-checked={objective.isCompleted}
            >
                {objective.isCompleted && <span className={styles.checkmark}>✓</span>}
            </div>

            <div className={styles.objectiveContent}>
                <input
                    type="text"
                    className={styles.objectiveText}
                    value={localDescription}
                    onChange={handleTextChange}
                    placeholder="Describe this objective..."
                />

                <div className={styles.locationRow}>
                    <span className={styles.locationIcon}>📍</span>
                    <select
                        className={styles.locationSelect}
                        value={objective.locationId || ''}
                        onChange={handleLocationChange}
                    >
                        <option value="">Select Location...</option>
                        {discoveredLocations.map(location => (
                            <option key={location.id} value={location.id}>
                                {location.name}
                            </option>
                        ))}
                    </select>

                    {objective.locationId && selectedLocation && (
                        <button
                            className={styles.goToMapButton}
                            onClick={handleGoToMap}
                            type="button"
                        >
                            🗺️ Go to Map
                        </button>
                    )}
                </div>
            </div>

            <button
                className={styles.deleteObjectiveButton}
                onClick={onDelete}
                type="button"
                title="Delete objective"
            >
                ✕
            </button>
        </div>
    );
};

export default ObjectiveItem;
