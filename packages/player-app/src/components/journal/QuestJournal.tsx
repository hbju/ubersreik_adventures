import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Quest, QuestStatus, QuestObjective, Location, MapPinState, useDebouncedCallback } from '@wfrp/shared';
import { ObjectiveItem } from './ObjectiveItem';
import styles from './QuestJournal.module.css';

interface QuestJournalProps {
    quests: Quest[];
    locations: Location[];
    mapPinStates: Record<string, MapPinState>;
    characterId?: string;
    onQuestUpdate: (quest: Quest) => void;
    onQuestDelete: (questId: string) => void;
    onGoToMap: (locationId: string) => void;
}

export const QuestJournal: React.FC<QuestJournalProps> = ({
    quests,
    locations,
    mapPinStates,
    characterId,
    onQuestUpdate,
    onQuestDelete,
    onGoToMap,
}) => {
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<QuestStatus>('active');
    const [searchQuery, setSearchQuery] = useState('');
    
    // Local state for text fields to make typing responsive
    const [localTitle, setLocalTitle] = useState('');
    const [localDescription, setLocalDescription] = useState('');

    // Debounced update function - only syncs to parent after 300ms of no typing
    const debouncedQuestUpdate = useDebouncedCallback((quest: Quest) => {
        onQuestUpdate(quest);
    }, 300);

    // Sync local state when selected quest changes (from props)
    useEffect(() => {
        if (selectedQuest) {
            setLocalTitle(selectedQuest.title);
            setLocalDescription(selectedQuest.description);
        }
    }, [selectedQuestId]); // Only when selection changes, not on every selectedQuest update

    // Filter quests based on tab and search
    const filteredQuests = useMemo(() => {
        return quests.filter(quest => {
            // Filter by status
            if (quest.status !== activeTab) return false;
            
            // Filter by search query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                return (
                    quest.title.toLowerCase().includes(query) ||
                    quest.description.toLowerCase().includes(query)
                );
            }
            return true;
        });
    }, [quests, activeTab, searchQuery]);

    const selectedQuest = useMemo(() => {
        return quests.find(q => q.id === selectedQuestId) || null;
    }, [quests, selectedQuestId]);

    const handleCreateQuest = useCallback(() => {
        const newQuest: Quest = {
            id: crypto.randomUUID(),
            title: 'New Quest',
            description: '',
            status: 'active',
            objectives: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        onQuestUpdate(newQuest);
        setSelectedQuestId(newQuest.id);
        setActiveTab('active');
        // Set local state immediately for the new quest
        setLocalTitle('New Quest');
        setLocalDescription('');
    }, [onQuestUpdate]);

    const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!selectedQuest) return;
        const newTitle = e.target.value;
        // Update local state immediately for responsive typing
        setLocalTitle(newTitle);
        // Debounce the sync to parent
        debouncedQuestUpdate({
            ...selectedQuest,
            title: newTitle,
            updatedAt: Date.now(),
        });
    }, [selectedQuest, debouncedQuestUpdate]);

    const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (!selectedQuest) return;
        const newDescription = e.target.value;
        // Update local state immediately for responsive typing
        setLocalDescription(newDescription);
        // Debounce the sync to parent
        debouncedQuestUpdate({
            ...selectedQuest,
            description: newDescription,
            updatedAt: Date.now(),
        });
    }, [selectedQuest, debouncedQuestUpdate]);

    const handleAddObjective = useCallback(() => {
        if (!selectedQuest) return;
        const newObjective: QuestObjective = {
            id: crypto.randomUUID(),
            text: '',
            isCompleted: false,
        };
        onQuestUpdate({
            ...selectedQuest,
            objectives: [...selectedQuest.objectives, newObjective],
            updatedAt: Date.now(),
        });
    }, [selectedQuest, onQuestUpdate]);

    const handleObjectiveUpdate = useCallback((updated: QuestObjective) => {
        if (!selectedQuest) return;
        onQuestUpdate({
            ...selectedQuest,
            objectives: selectedQuest.objectives.map(obj =>
                obj.id === updated.id ? updated : obj
            ),
            updatedAt: Date.now(),
        });
    }, [selectedQuest, onQuestUpdate]);

    const handleObjectiveDelete = useCallback((objectiveId: string) => {
        if (!selectedQuest) return;
        onQuestUpdate({
            ...selectedQuest,
            objectives: selectedQuest.objectives.filter(obj => obj.id !== objectiveId),
            updatedAt: Date.now(),
        });
    }, [selectedQuest, onQuestUpdate]);

    const handleStatusChange = useCallback((newStatus: QuestStatus) => {
        if (!selectedQuest) return;
        onQuestUpdate({
            ...selectedQuest,
            status: newStatus,
            updatedAt: Date.now(),
        });
        setActiveTab(newStatus);
    }, [selectedQuest, onQuestUpdate]);

    const handleDeleteQuest = useCallback(() => {
        if (!selectedQuest) return;
        if (window.confirm(`Are you sure you want to delete "${selectedQuest.title}"? This cannot be undone.`)) {
            onQuestDelete(selectedQuest.id);
            setSelectedQuestId(null);
        }
    }, [selectedQuest, onQuestDelete]);

    const getObjectiveProgress = (quest: Quest) => {
        const completed = quest.objectives.filter(o => o.isCompleted).length;
        const total = quest.objectives.length;
        return `${completed}/${total}`;
    };

    const tabCounts = useMemo(() => ({
        active: quests.filter(q => q.status === 'active').length,
        completed: quests.filter(q => q.status === 'completed').length,
        failed: quests.filter(q => q.status === 'failed').length,
    }), [quests]);

    return (
        <div className={styles.questJournal}>
            {/* Left Panel - Quest List */}
            <div className={styles.questListPanel}>
                <div className={styles.panelHeader}>
                    <h2>📜 Quest Journal</h2>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search quests..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className={styles.statusTabs}>
                    <button
                        className={`${styles.statusTab} ${activeTab === 'active' ? styles.active : ''}`}
                        onClick={() => setActiveTab('active')}
                    >
                        Active ({tabCounts.active})
                    </button>
                    <button
                        className={`${styles.statusTab} ${activeTab === 'completed' ? styles.active : ''}`}
                        onClick={() => setActiveTab('completed')}
                    >
                        Completed ({tabCounts.completed})
                    </button>
                    <button
                        className={`${styles.statusTab} ${activeTab === 'failed' ? styles.active : ''}`}
                        onClick={() => setActiveTab('failed')}
                    >
                        Failed ({tabCounts.failed})
                    </button>
                </div>

                <div className={styles.questList}>
                    {filteredQuests.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No {activeTab} quests</p>
                        </div>
                    ) : (
                        filteredQuests.map(quest => (
                            <div
                                key={quest.id}
                                className={`${styles.questCard} ${selectedQuestId === quest.id ? styles.selected : ''}`}
                                onClick={() => setSelectedQuestId(quest.id)}
                            >
                                <h3 className={styles.questCardTitle}>{quest.title}</h3>
                                <div className={styles.questCardMeta}>
                                    <span className={`${styles.questStatus} ${styles[quest.status]}`}>
                                        {quest.status}
                                    </span>
                                    <span className={styles.objectiveProgress}>
                                        {quest.objectives.length > 0 && `${getObjectiveProgress(quest)} Objectives`}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <button className={styles.newQuestButton} onClick={handleCreateQuest}>
                    + New Quest
                </button>
            </div>

            {/* Right Panel - Quest Detail */}
            <div className={styles.questDetailPanel}>
                {!selectedQuest ? (
                    <div className={styles.emptyState}>
                        <p>📜</p>
                        <p>Select a quest or create a new one</p>
                    </div>
                ) : (
                    <div className={styles.questDetail}>
                        <input
                            type="text"
                            className={styles.questTitleInput}
                            value={localTitle}
                            onChange={handleTitleChange}
                            placeholder="Quest Title"
                        />

                        <div className={styles.questDescriptionLabel}>Description</div>
                        <textarea
                            className={styles.questDescriptionInput}
                            value={localDescription}
                            onChange={handleDescriptionChange}
                            placeholder="Describe your quest objectives and notes..."
                        />

                        <div className={styles.objectivesSection}>
                            <h3 className={styles.sectionTitle}>Objectives</h3>
                            <div className={styles.objectivesList}>
                                {selectedQuest.objectives.map(objective => (
                                    <ObjectiveItem
                                        key={objective.id}
                                        objective={objective}
                                        locations={locations}
                                        mapPinStates={mapPinStates}
                                        characterId={characterId}
                                        onUpdate={handleObjectiveUpdate}
                                        onDelete={() => handleObjectiveDelete(objective.id)}
                                        onGoToMap={onGoToMap}
                                    />
                                ))}
                            </div>
                            <button
                                className={styles.addObjectiveButton}
                                onClick={handleAddObjective}
                            >
                                + Add Objective
                            </button>
                        </div>

                        <div className={styles.statusActions}>
                            {selectedQuest.status === 'active' && (
                                <>
                                    <button
                                        className={`${styles.statusButton} ${styles.complete}`}
                                        onClick={() => handleStatusChange('completed')}
                                    >
                                        ✓ Mark Completed
                                    </button>
                                    <button
                                        className={`${styles.statusButton} ${styles.fail}`}
                                        onClick={() => handleStatusChange('failed')}
                                    >
                                        ✕ Mark Failed
                                    </button>
                                </>
                            )}
                            {(selectedQuest.status === 'completed' || selectedQuest.status === 'failed') && (
                                <button
                                    className={`${styles.statusButton} ${styles.reactivate}`}
                                    onClick={() => handleStatusChange('active')}
                                >
                                    ↻ Reactivate Quest
                                </button>
                            )}
                            <button
                                className={styles.deleteButton}
                                onClick={handleDeleteQuest}
                            >
                                🗑️ Delete
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestJournal;
