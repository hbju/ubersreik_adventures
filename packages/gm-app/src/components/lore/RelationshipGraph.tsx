import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    NodeProps,
    EdgeProps,
    Handle,
    Position,
    BaseEdge,
    EdgeLabelRenderer,
    getStraightPath,
    useReactFlow,
    ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import {
    Character,
    convertCharactersToGraph,
    filterByDegree,
    filterByTag,
    collectTags,
    GraphData,
    RELATIONSHIP_COLORS,
    RELATIONSHIP_LABELS,
    Relationship,
} from '@wfrp/shared';
import styles from './RelationshipGraph.module.css';
import { useTranslation } from 'react-i18next';

// ========================================
// Types
// ========================================

interface RelationshipGraphProps {
    characters: Character[];
    imageCache: Record<string, string>;
    onClose: () => void;
    onOpenLoreEditor: (character: Character) => void;
}

type DegreeFilter = 'all' | '1' | '2';

// ========================================
// Dagre Auto-Layout
// ========================================

const NODE_WIDTH = 80;
const NODE_HEIGHT = 90;

function applyDagreLayout(graphData: GraphData): { nodes: Node[]; edges: Edge[] } {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({
        rankdir: 'TB',
        nodesep: 100,
        ranksep: 120,
        edgesep: 50,
    });

    for (const node of graphData.nodes) {
        g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
    }
    for (const edge of graphData.edges) {
        g.setEdge(edge.source, edge.target);
    }

    dagre.layout(g);

    const nodes: Node[] = graphData.nodes.map(gn => {
        const pos = g.node(gn.id);
        return {
            id: gn.id,
            type: 'characterNode',
            position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
            data: {
                label: gn.label,
                imageUrl: gn.imageUrl,
                isPC: gn.isPC,
                isMinion: gn.isMinion,
            },
        };
    });

    const edges: Edge[] = graphData.edges.map(ge => ({
        id: ge.id,
        source: ge.source,
        target: ge.target,
        type: 'relationshipEdge',
        data: {
            label: ge.label,
            relType: ge.type,
        },
    }));

    return { nodes, edges };
}

// ========================================
// Custom Node
// ========================================

interface CharacterNodeData {
    [key: string]: unknown;
    label: string;
    imageUrl?: string;
    isPC: boolean;
    isMinion: boolean;
    imageDataUrl?: string;
    isSelected?: boolean;
}

const CharacterNodeComponent: React.FC<NodeProps<Node<CharacterNodeData>>> = ({ data }) => {
    const avatarClass = data.isSelected
        ? styles.nodeAvatarSelected
        : data.isPC
            ? styles.nodeAvatarPC
            : data.isMinion
                ? styles.nodeAvatarMinion
                : styles.nodeAvatarNPC;

    const labelClass = data.isPC ? styles.nodeLabelPC : styles.nodeLabelNPC;

    return (
        <div className={styles.characterNode}>
            <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />
            <div className={`${styles.nodeAvatar} ${avatarClass}`}>
                {data.imageDataUrl ? (
                    <img src={data.imageDataUrl} alt={data.label} className={styles.nodeImage} />
                ) : (
                    <span className={styles.nodePlaceholder}>
                        {data.isPC ? '⚔️' : data.isMinion ? '💀' : '🎭'}
                    </span>
                )}
            </div>
            <div className={`${styles.nodeLabel} ${labelClass}`}>
                {data.label}
            </div>
            <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />
        </div>
    );
};

// ========================================
// Custom Edge
// ========================================

interface RelationshipEdgeData {
    [key: string]: unknown;
    label: string;
    relType: Relationship['type'];
}

const RelationshipEdgeComponent: React.FC<EdgeProps<Edge<RelationshipEdgeData>>> = ({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    data,
}) => {
    const color = data ? RELATIONSHIP_COLORS[data.relType] || '#5c4a2a' : '#5c4a2a';
    const [edgePath, labelX, labelY] = getStraightPath({
        sourceX,
        sourceY,
        targetX,
        targetY,
    });

    return (
        <>
            <BaseEdge
                id={id}
                path={edgePath}
                style={{
                    stroke: color,
                    strokeWidth: 2,
                    opacity: 0.7,
                }}
            />
            <EdgeLabelRenderer>
                <div
                    className={styles.edgeLabel}
                    style={{
                        position: 'absolute',
                        transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                        color,
                    }}
                >
                    {data?.label}
                </div>
            </EdgeLabelRenderer>
        </>
    );
};

// ========================================
// Node Types Registration
// ========================================

const nodeTypes = {
    characterNode: CharacterNodeComponent,
};

const edgeTypes = {
    relationshipEdge: RelationshipEdgeComponent,
};

// ========================================
// Inner Graph (needs ReactFlowProvider)
// ========================================

interface InnerGraphProps {
    characters: Character[];
    imageCache: Record<string, string>;
    onClose: () => void;
    onOpenLoreEditor: (character: Character) => void;
}

const InnerGraph: React.FC<InnerGraphProps> = ({
    characters,
    imageCache,
    onClose,
    onOpenLoreEditor,
}) => {
    const { t } = useTranslation();
    const { fitView } = useReactFlow();

    // === State ===
    const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
    const [degreeFilter, setDegreeFilter] = useState<DegreeFilter>('all');
    const [tagFilter, setTagFilter] = useState<string>('');
    const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

    // Collect all tags for the filter dropdown
    const allTags = useMemo(() => collectTags(characters), [characters]);

    // Build full graph data
    const fullGraph = useMemo(() => convertCharactersToGraph(characters), [characters]);

    // Apply filters
    const filteredGraph = useMemo(() => {
        let data: GraphData = fullGraph;
        if (tagFilter) {
            data = filterByTag(data, tagFilter);
        }
        if (focusNodeId && degreeFilter !== 'all') {
            data = filterByDegree(data, focusNodeId, parseInt(degreeFilter));
        }
        return data;
    }, [fullGraph, tagFilter, focusNodeId, degreeFilter]);

    // Apply layout when filtered graph changes
    const applyLayout = useCallback(() => {
        const { nodes: layoutNodes, edges: layoutEdges } = applyDagreLayout(filteredGraph);

        // Inject image data URLs into node data
        const nodesWithImages = layoutNodes.map(n => ({
            ...n,
            data: {
                ...n.data,
                imageDataUrl: imageCache[n.id],
                isSelected: n.id === focusNodeId,
            },
        }));

        setNodes(nodesWithImages);
        setEdges(layoutEdges);

        // Fit view after layout with small delay for ReactFlow to process
        setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    }, [filteredGraph, imageCache, focusNodeId, setNodes, setEdges, fitView]);

    // Auto-apply layout when graph data changes
    useEffect(() => {
        applyLayout();
    }, [applyLayout]);

    // Node click handler
    const handleNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            if (focusNodeId === node.id) {
                // Double-click: open lore editor
                const char = characters.find(c => c.id === node.id);
                if (char) onOpenLoreEditor(char);
            } else {
                setFocusNodeId(node.id);
                if (degreeFilter === 'all') {
                    setDegreeFilter('1');
                }
            }
        },
        [focusNodeId, characters, onOpenLoreEditor, degreeFilter]
    );

    // Node double-click: always open lore editor
    const handleNodeDoubleClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            const char = characters.find(c => c.id === node.id);
            if (char) onOpenLoreEditor(char);
        },
        [characters, onOpenLoreEditor]
    );

    const handleResetFocus = useCallback(() => {
        setFocusNodeId(null);
        setDegreeFilter('all');
    }, []);

    const handleResetAll = useCallback(() => {
        setFocusNodeId(null);
        setDegreeFilter('all');
        setTagFilter('');
    }, []);

    const focusCharName = focusNodeId
        ? characters.find(c => c.id === focusNodeId)?.name || '?'
        : null;

    const isEmpty = filteredGraph.nodes.length === 0;

    return (
        <div className={styles.graphContainer}>
            {/* Header */}
            <div className={styles.header}>
                <h2>🕸️ {t('lore.relationshipWeb', 'Relationship Web')}</h2>
                <div className={styles.headerActions}>
                    <button className={styles.toolbarButton} onClick={applyLayout}>
                        📐 {t('lore.autoLayout', 'Auto-Layout')}
                    </button>
                    <button className={styles.toolbarButton} onClick={handleResetAll}>
                        🔄 {t('lore.resetView', 'Reset')}
                    </button>
                    <button className={styles.closeButton} onClick={onClose}>
                        ✖ {t('common.close', 'Close')}
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className={styles.filtersBar}>
                <span className={styles.filterLabel}>{t('lore.filters', 'Filters')}:</span>

                {/* Tag filter */}
                <select
                    className={styles.filterSelect}
                    value={tagFilter}
                    onChange={e => setTagFilter(e.target.value)}
                >
                    <option value="">{t('lore.allTags', 'All Tags')}</option>
                    {allTags.map(tag => (
                        <option key={tag} value={tag}>{tag}</option>
                    ))}
                </select>

                <div className={styles.separator} />

                {/* Degree filter */}
                <span className={styles.filterLabel}>{t('lore.connections', 'Connections')}:</span>
                {(['all', '1', '2'] as DegreeFilter[]).map(d => (
                    <button
                        key={d}
                        className={`${styles.filterChip} ${degreeFilter === d ? styles.filterChipActive : ''}`}
                        onClick={() => setDegreeFilter(d)}
                    >
                        {d === 'all'
                            ? t('lore.showAll', 'All')
                            : t('lore.degreeN', `${d}° Degree`, { n: d })}
                    </button>
                ))}

                {/* Focus indicator */}
                {focusCharName && (
                    <>
                        <div className={styles.separator} />
                        <div className={styles.focusIndicator}>
                            🎯 {focusCharName}
                            <button className={styles.clearFocusButton} onClick={handleResetFocus}>✖</button>
                        </div>
                    </>
                )}
            </div>

            {/* Canvas */}
            {isEmpty ? (
                <div className={styles.emptyState}>
                    <span className={styles.emptyIcon}>🕸️</span>
                    <p>{t('lore.noRelationships', 'No relationships to display.')}</p>
                    <p style={{ fontSize: '13px' }}>
                        {t('lore.addRelationshipsHint', 'Add relationships in the Lore Editor to see them here.')}
                    </p>
                </div>
            ) : (
                <div className={styles.canvasWrapper}>
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={handleNodeClick}
                        onNodeDoubleClick={handleNodeDoubleClick}
                        nodeTypes={nodeTypes}
                        edgeTypes={edgeTypes}
                        fitView
                        fitViewOptions={{ padding: 0.2 }}
                        minZoom={0.2}
                        maxZoom={3}
                        proOptions={{ hideAttribution: true }}
                        nodesDraggable
                        nodesConnectable={false}
                        elementsSelectable
                    >
                        <Background color="#3e2723" gap={24} size={1} />
                        <Controls showInteractive={false} />
                        <MiniMap
                            nodeColor={(node) =>
                                node.data?.isPC ? '#d4af37' : node.data?.isMinion ? '#8b0000' : '#5c4a2a'
                            }
                            maskColor="rgba(0, 0, 0, 0.7)"
                            style={{ background: 'rgba(30, 18, 10, 0.9)' }}
                        />
                    </ReactFlow>

                    {/* Legend */}
                    <div className={styles.legend}>
                        <div className={styles.legendTitle}>{t('lore.legend', 'Legend')}</div>
                        {(Object.entries(RELATIONSHIP_LABELS) as [Relationship['type'], string][]).map(
                            ([type, label]) => (
                                <div key={type} className={styles.legendItem}>
                                    <div
                                        className={styles.legendLine}
                                        style={{ backgroundColor: RELATIONSHIP_COLORS[type] }}
                                    />
                                    <span>{label}</span>
                                </div>
                            )
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ========================================
// Outer Wrapper (provides ReactFlowProvider)
// ========================================

export const RelationshipGraph: React.FC<RelationshipGraphProps> = (props) => {
    return (
        <ReactFlowProvider>
            <InnerGraph {...props} />
        </ReactFlowProvider>
    );
};

export default RelationshipGraph;
