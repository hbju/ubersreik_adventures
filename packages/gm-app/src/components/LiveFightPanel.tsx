import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Combatant, Character, SideId } from '@wfrp/shared';
import type { LiveFightHook } from '../hooks/useLiveFight';
import { DEV_FIGHT_FIXTURE } from '../hooks/useLiveFight';
import { buildCombatStateFromTracker } from '../utils/fightSeeding';

interface LiveFightPanelProps extends LiveFightHook {
    onClose: () => void;
    combatants: Combatant[];
    characters: Character[];
}

export function LiveFightPanel({
    liveFightEngine,
    pendingPsychRequests,
    pendingMainRequest,
    startFight,
    handleDecisionResponse,
    stopFight,
    onClose,
    combatants,
    characters,
}: LiveFightPanelProps) {
    const { t } = useTranslation();
    const engine = liveFightEngine;
    const outcome = engine?.outcome;
    const phase = engine?.phase;
    const round = engine?.round;

    // --- Setup state ---
    const defaultSideMap = useMemo<Record<string, SideId>>(
        () => Object.fromEntries(combatants.map(c => [c.id, c.isPlayer ? 'ally' : 'adversary'])),
        [combatants],
    );
    const [sideMap, setSideMap] = useState<Record<string, SideId>>(defaultSideMap);
    const [initialDistance, setInitialDistance] = useState(20);

    // Reset setup state when the fight ends (engine goes from active → null)
    useEffect(() => {
        if (!engine) {
            setSideMap(defaultSideMap);
        }
    }, [engine, defaultSideMap]);

    // --- GM overrides ---
    const forceEndTurn = () => {
        if (!pendingMainRequest) return;
        handleDecisionResponse(pendingMainRequest.requestId, {
            kind: 'endTurn',
            actorId: pendingMainRequest.actorId,
        });
    };

    const forcePsychWait = (req: typeof pendingPsychRequests[0]) => {
        handleDecisionResponse(req.requestId, { kind: 'wait', actorId: req.actorId });
    };

    const handleStartFromEncounter = () => {
        const { combatState, remoteActorIds } = buildCombatStateFromTracker(
            combatants, characters, sideMap, initialDistance,
        );
        startFight(combatState, remoteActorIds);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center pt-16 z-50">
            <div className="bg-gray-900 text-white rounded-lg shadow-2xl w-[520px] max-h-[80vh] overflow-y-auto p-5">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-bold text-amber-400">⚔ {t('liveFight.title')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>

                {/* Setup view — no fight running */}
                {!engine && (
                    <div className="space-y-4">
                        {combatants.length > 0 ? (
                            <>
                                <p className="text-gray-400 text-sm">{t('liveFight.setup.title')}</p>

                                {/* Combatant side assignment */}
                                <div className="border border-gray-700 rounded overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gray-800 text-gray-400 text-xs uppercase">
                                                <th className="text-left px-3 py-2">{t('liveFight.setup.name')}</th>
                                                <th className="text-left px-3 py-2">{t('liveFight.setup.wounds')}</th>
                                                <th className="text-left px-3 py-2">{t('liveFight.setup.side')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {combatants.map(c => (
                                                <tr key={c.id} className="border-t border-gray-800">
                                                    <td className="px-3 py-2 text-white">{c.name}</td>
                                                    <td className="px-3 py-2 text-gray-400">
                                                        {c.currentWounds}/{c.maxWounds}
                                                    </td>
                                                    <td className="px-3 py-2">
                                                        <div className="flex gap-1">
                                                            <button
                                                                onClick={() => setSideMap(m => ({ ...m, [c.id]: 'ally' }))}
                                                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                    sideMap[c.id] === 'ally'
                                                                        ? 'bg-blue-600 text-white'
                                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                                }`}
                                                            >
                                                                {t('liveFight.setup.ally')}
                                                            </button>
                                                            <button
                                                                onClick={() => setSideMap(m => ({ ...m, [c.id]: 'adversary' }))}
                                                                className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                                    sideMap[c.id] === 'adversary'
                                                                        ? 'bg-red-700 text-white'
                                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                                }`}
                                                            >
                                                                {t('liveFight.setup.adversary')}
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Initial distance */}
                                <div className="flex items-center gap-3">
                                    <label className="text-sm text-gray-400 whitespace-nowrap">
                                        {t('liveFight.setup.initialDistance')}
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={initialDistance}
                                        onChange={e => setInitialDistance(Math.max(0, Number(e.target.value)))}
                                        className="w-20 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm"
                                    />
                                    <span className="text-gray-500 text-sm">yd</span>
                                </div>

                                <button
                                    onClick={handleStartFromEncounter}
                                    className="w-full bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded text-sm font-semibold"
                                >
                                    {t('liveFight.setup.start')}
                                </button>
                            </>
                        ) : (
                            <p className="text-gray-500 text-sm italic">
                                {t('liveFight.setup.noEncounter')}
                            </p>
                        )}

                        {/* Dev fixture */}
                        <div className="border-t border-gray-800 pt-3">
                            <button
                                onClick={() => startFight(DEV_FIGHT_FIXTURE.combatState, DEV_FIGHT_FIXTURE.remoteActorIds, DEV_FIGHT_FIXTURE.seed)}
                                className="text-xs text-gray-500 hover:text-gray-300 underline"
                            >
                                {t('liveFight.setup.devFixture')}
                            </button>
                        </div>
                    </div>
                )}

                {/* Fight in progress */}
                {engine && phase !== 'complete' && (
                    <div className="space-y-4">
                        {/* Status bar */}
                        <div className="flex gap-3 text-sm">
                            <span className="bg-gray-700 px-2 py-1 rounded">Round {round}</span>
                            <span className="bg-gray-700 px-2 py-1 rounded capitalize">{phase}</span>
                        </div>

                        {/* Psychology fan-out */}
                        {pendingPsychRequests.length > 0 && (
                            <div className="border border-yellow-600 rounded p-3 space-y-2">
                                <p className="text-yellow-400 text-sm font-semibold">Psychology decisions needed:</p>
                                {pendingPsychRequests.map(req => (
                                    <div key={req.requestId} className="flex items-center justify-between text-sm">
                                        <span className="text-gray-300">
                                            {req.characterName} — Fortune reroll? <span className="text-gray-500">(round {req.round})</span>
                                        </span>
                                        <button
                                            onClick={() => forcePsychWait(req)}
                                            className="text-xs bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded"
                                            title="GM Override: decline the reroll"
                                        >
                                            Force Wait
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Main turn decision */}
                        {pendingMainRequest && (
                            <div className="border border-blue-600 rounded p-3 space-y-2">
                                <p className="text-blue-400 text-sm font-semibold">
                                    Awaiting decision from <span className="text-white">{pendingMainRequest.characterName}</span>
                                </p>
                                <p className="text-gray-400 text-xs">
                                    Turn {pendingMainRequest.turnIndex + 1} — {pendingMainRequest.legalDecisions.length} legal actions
                                </p>
                                <button
                                    onClick={forceEndTurn}
                                    className="text-xs bg-red-800 hover:bg-red-700 text-white px-3 py-1 rounded"
                                    title="GM Override: force end turn"
                                >
                                    Force End Turn
                                </button>
                            </div>
                        )}

                        {/* Waiting for NPC */}
                        {!pendingMainRequest && pendingPsychRequests.length === 0 && (
                            <p className="text-gray-500 text-sm">NPC resolving…</p>
                        )}

                        <button
                            onClick={stopFight}
                            className="text-xs text-gray-500 hover:text-red-400 underline"
                        >
                            Abort fight
                        </button>
                    </div>
                )}

                {/* Fight complete */}
                {engine && phase === 'complete' && (
                    <div className="space-y-3">
                        <div className={`text-center py-3 rounded text-lg font-bold ${
                            outcome === 'ally' ? 'bg-green-800 text-green-200' :
                            outcome === 'adversary' ? 'bg-red-900 text-red-200' :
                            'bg-gray-700 text-gray-200'
                        }`}>
                            {outcome === 'ally' ? '🏆 Victory' : outcome === 'adversary' ? '💀 Defeat' : '⚖ Draw'}
                        </div>
                        <button
                            onClick={stopFight}
                            className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded text-sm w-full"
                        >
                            Close
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
