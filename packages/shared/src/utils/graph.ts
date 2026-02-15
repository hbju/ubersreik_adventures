import { Character, Relationship } from '../types/wfrp.types';

// ========================================
// Relationship Graph Data Structures
// ========================================

export interface GraphNode {
    id: string;
    label: string;
    imageUrl?: string;
    isPC: boolean;
    isMinion: boolean;
    tags: string[];
}

export interface GraphEdge {
    id: string;
    source: string;
    target: string;
    label: string;
    type: Relationship['type'];
}

export interface GraphData {
    nodes: GraphNode[];
    edges: GraphEdge[];
}

// ========================================
// Color mapping for relationship types
// ========================================

export const RELATIONSHIP_COLORS: Record<Relationship['type'], string> = {
    kin: '#4a90d9',     // Blue
    friend: '#50c878',  // Green
    ally: '#7cfc00',    // Lime green
    love: '#ff69b4',    // Hot pink
    rival: '#ff8c00',   // Orange
    enemy: '#dc3545',   // Red
    servant: '#9e9e9e', // Gray
    master: '#b8860b',  // Dark goldenrod
    other: '#8b734a',   // Muted tan
};

export const RELATIONSHIP_LABELS: Record<Relationship['type'], string> = {
    kin: 'Kin',
    friend: 'Friend',
    ally: 'Ally',
    love: 'Love',
    rival: 'Rival',
    enemy: 'Enemy',
    servant: 'Servant',
    master: 'Master',
    other: 'Other',
};

// ========================================
// Graph Data Transformation
// ========================================

/**
 * Converts an array of Characters into a graph-ready data structure.
 * Deduplicates bidirectional edges (A→B and B→A become a single edge).
 */
export function convertCharactersToGraph(characters: Character[]): GraphData {
    const characterMap = new Map(characters.map(c => [c.id, c]));

    // Build nodes from all characters that have at least one relationship
    // or are the target of a relationship
    const participatingIds = new Set<string>();

    for (const character of characters) {
        const relationships = character.lore?.relationships || [];
        if (relationships.length > 0) {
            participatingIds.add(character.id);
            for (const rel of relationships) {
                if (characterMap.has(rel.targetCharacterId)) {
                    participatingIds.add(rel.targetCharacterId);
                }
            }
        }
    }

    const nodes: GraphNode[] = [];
    for (const id of participatingIds) {
        const c = characterMap.get(id);
        if (!c) continue;
        nodes.push({
            id: c.id,
            label: c.name,
            imageUrl: c.lore?.imageUrl,
            isPC: c.userId !== null,
            isMinion: !!c.isMinion,
            tags: c.tags || [],
        });
    }

    // Build edges, deduplicating bidirectional ones
    const edgeSet = new Set<string>();
    const edges: GraphEdge[] = [];

    for (const character of characters) {
        const relationships = character.lore?.relationships || [];
        for (const rel of relationships) {
            if (!characterMap.has(rel.targetCharacterId)) continue;
            if (!participatingIds.has(rel.targetCharacterId)) continue;

            // Create a canonical key to deduplicate bidirectional edges
            const sorted = [character.id, rel.targetCharacterId].sort();
            const edgeKey = `${sorted[0]}__${sorted[1]}__${rel.type}`;

            if (!edgeSet.has(edgeKey)) {
                edgeSet.add(edgeKey);
                edges.push({
                    id: `edge_${character.id}_${rel.targetCharacterId}_${rel.type}`,
                    source: character.id,
                    target: rel.targetCharacterId,
                    label: RELATIONSHIP_LABELS[rel.type] || rel.type,
                    type: rel.type,
                });
            }
        }
    }

    return { nodes, edges };
}

/**
 * Filters graph data to show only nodes within N degrees of a focal character.
 * degree=1 shows direct connections, degree=2 shows connections of connections, etc.
 */
export function filterByDegree(
    graphData: GraphData,
    focalNodeId: string,
    maxDegree: number
): GraphData {
    if (!focalNodeId) return graphData;

    // BFS to find nodes within maxDegree
    const adjacency = new Map<string, Set<string>>();
    for (const edge of graphData.edges) {
        if (!adjacency.has(edge.source)) adjacency.set(edge.source, new Set());
        if (!adjacency.has(edge.target)) adjacency.set(edge.target, new Set());
        adjacency.get(edge.source)!.add(edge.target);
        adjacency.get(edge.target)!.add(edge.source);
    }

    const visited = new Set<string>();
    const queue: { id: string; depth: number }[] = [{ id: focalNodeId, depth: 0 }];
    visited.add(focalNodeId);

    while (queue.length > 0) {
        const { id, depth } = queue.shift()!;
        if (depth >= maxDegree) continue;
        const neighbors = adjacency.get(id) || new Set();
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push({ id: neighbor, depth: depth + 1 });
            }
        }
    }

    const filteredNodes = graphData.nodes.filter(n => visited.has(n.id));
    const filteredEdges = graphData.edges.filter(
        e => visited.has(e.source) && visited.has(e.target)
    );

    return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Filters graph data to show only characters that have a specific tag.
 */
export function filterByTag(graphData: GraphData, tag: string): GraphData {
    if (!tag) return graphData;

    const matchingNodeIds = new Set(
        graphData.nodes.filter(n => n.tags.some(t => t.toLowerCase() === tag.toLowerCase())).map(n => n.id)
    );

    const filteredEdges = graphData.edges.filter(
        e => matchingNodeIds.has(e.source) && matchingNodeIds.has(e.target)
    );

    // Also include nodes that are connected to matching nodes
    const connectedIds = new Set(matchingNodeIds);
    for (const edge of filteredEdges) {
        connectedIds.add(edge.source);
        connectedIds.add(edge.target);
    }

    const filteredNodes = graphData.nodes.filter(n => connectedIds.has(n.id));

    return { nodes: filteredNodes, edges: filteredEdges };
}

/**
 * Collects all unique tags from graph nodes.
 */
export function collectTags(characters: Character[]): string[] {
    const tagSet = new Set<string>();
    for (const c of characters) {
        for (const tag of c.tags || []) {
            tagSet.add(tag);
        }
    }
    return Array.from(tagSet).sort();
}
