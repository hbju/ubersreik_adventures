import React, { useState, useMemo } from 'react';
import { Quest, QuestStatus, Location } from '@wfrp/shared';
import styles from './QuestJournalViewer.module.css';

interface QuestJournalViewerProps {
    quests: Quest[];
    locations: Location[];
    onClose: () => void;
}

/**
 * Read-only view of the Quest Journal for the GM
 * Shows what players are tracking without allowing edits
 */
export const QuestJournalViewer: React.FC<QuestJournalViewerProps> = ({
    quests,
    locations,
    onClose,
}) => {
    const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<QuestStatus>('active');

    const filteredQuests = useMemo(() => {
        return quests.filter(quest => quest.status === activeTab);
    }, [quests, activeTab]);

    const selectedQuest = useMemo(() => {
        return quests.find(q => q.id === selectedQuestId) || null;
    }, [quests, selectedQuestId]);

    const getObjectiveProgress = (quest: Quest) => {
        const completed = quest.objectives.filter(o => o.isCompleted).length;
        const total = quest.objectives.length;
        return `${completed}/${total}`;
    };

    const getLocationName = (locationId: string | undefined) => {
        if (!locationId) return null;
        const location = locations.find(l => l.id === locationId);
        return location?.name || 'Unknown Location';
    };

    const tabCounts = useMemo(() => ({
        active: quests.filter(q => q.status === 'active').length,
        completed: quests.filter(q => q.status === 'completed').length,
        failed: quests.filter(q => q.status === 'failed').length,
    }), [quests]);

    return (
        <div className={styles.questJournalViewer}>
            <div className={styles.header}>
                <h2>📋 Party Quest Journal (Read-Only)</h2>
                <button className={styles.closeButton} onClick={onClose}>
                    Close
                </button>
            </div>

            <div className={styles.content}>
                {/* Left Panel - Quest List */}
                <div className={styles.questListPanel}>
                    <div className={styles.panelHeader}>
                        <h3>Quests</h3>
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
                            Done ({tabCounts.completed})
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
                            <div className={styles.noQuests}>
                                No {activeTab} quests
                            </div>
                        ) : (
                            filteredQuests.map(quest => (
                                <div
                                    key={quest.id}
                                    className={`${styles.questCard} ${selectedQuestId === quest.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedQuestId(quest.id)}
                                >
                                    <h4 className={styles.questCardTitle}>{quest.title}</h4>
                                    <div className={styles.questCardMeta}>
                                        <span className={`${styles.questStatus} ${styles[quest.status]}`}>
                                            {quest.status}
                                        </span>
                                        <span>
                                            {quest.objectives.length > 0 && `${getObjectiveProgress(quest)} Obj`}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Panel - Quest Detail */}
                <div className={styles.questDetailPanel}>
                    {!selectedQuest ? (
                        <div className={styles.emptyState}>
                            <p>📜</p>
                            <p>Select a quest to view details</p>
                        </div>
                    ) : (
                        <div className={styles.questDetail}>
                            <h2 className={styles.questTitle}>{selectedQuest.title}</h2>

                            <div className={styles.sectionLabel}>Description</div>
                            <div className={styles.questDescription}>
                                {selectedQuest.description || 'No description provided.'}
                            </div>

                            {selectedQuest.objectives.length > 0 && (
                                <div className={styles.objectivesSection}>
                                    <h3 className={styles.sectionTitle}>Objectives</h3>
                                    <div className={styles.objectivesList}>
                                        {selectedQuest.objectives.map(objective => (
                                            <div
                                                key={objective.id}
                                                className={`${styles.objectiveItem} ${objective.isCompleted ? styles.completed : ''}`}
                                            >
                                                <div className={`${styles.checkbox} ${objective.isCompleted ? styles.checked : ''}`}>
                                                    {objective.isCompleted && <span className={styles.checkmark}>✓</span>}
                                                </div>
                                                <div className={styles.objectiveContent}>
                                                    <span className={`${styles.objectiveText} ${objective.isCompleted ? styles.completed : ''}`}>
                                                        {objective.text || 'Empty objective'}
                                                    </span>
                                                    {objective.locationId && (
                                                        <div className={styles.objectiveLocation}>
                                                            📍 {getLocationName(objective.locationId)}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuestJournalViewer;
