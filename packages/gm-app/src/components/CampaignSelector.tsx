import React, { useState, useEffect } from 'react';

interface Campaign {
    id: string;
    name: string;
    description?: string;
    created_at: string;
    updated_at: string;
}

interface CampaignSelectorProps {
    onCampaignLoaded: (campaignData: any) => void;
    onSignOut: () => void;
    userEmail: string;
}

export default function CampaignSelector({ onCampaignLoaded, onSignOut, userEmail }: CampaignSelectorProps) {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [importing, setImporting] = useState(false);
    const [importName, setImportName] = useState('');
    const [importPath, setImportPath] = useState('');
    const [showImportDialog, setShowImportDialog] = useState(false);

    const loadCampaigns = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.ipcRenderer.listCampaigns();
            console.log('Campaigns loaded:', result);
            if (result.success) {
                setCampaigns(result.campaigns || []);
            } else {
                setError(result.error || 'Failed to load campaigns');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCampaigns();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        setCreating(true);
        setError(null);
        try {
            const result = await window.ipcRenderer.createCampaign(newName.trim(), newDescription.trim() || undefined);
            if (result.success) {
                setNewName('');
                setNewDescription('');
                await loadCampaigns();
            } else {
                setError(result.error || 'Failed to create campaign');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setCreating(false);
        }
    };

    const handleLoad = async (campaignId: string) => {
        setLoading(true);
        setError(null);
        try {
            const result = await window.ipcRenderer.loadCampaign(campaignId);
            if (result.success) {
                onCampaignLoaded(result.data);
            } else {
                setError(result.error || 'Failed to load campaign');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (campaignId: string, campaignName: string) => {
        if (!window.confirm(`Are you sure you want to delete "${campaignName}"? This cannot be undone.`)) return;
        setError(null);
        try {
            const result = await window.ipcRenderer.deleteCampaign(campaignId);
            if (result.success) {
                await loadCampaigns();
            } else {
                setError(result.error || 'Failed to delete campaign');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleSelectImportFile = async () => {
        try {
            const result = await window.ipcRenderer.selectImportFile();
            if (result.success && result.path) {
                setImportPath(result.path);
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    const handleImport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!importPath || !importName.trim()) return;
        setImporting(true);
        setError(null);
        try {
            const result = await window.ipcRenderer.importCampaignJson(importPath, importName.trim());
            if (result.success) {
                setShowImportDialog(false);
                setImportName('');
                setImportPath('');
                await loadCampaigns();
            } else {
                setError(result.error || 'Failed to import campaign');
            }
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setImporting(false);
        }
    };

    const handleExport = async () => {
        setError(null);
        try {
            const result = await window.ipcRenderer.exportCampaignJson();
            if (result.success) {
                alert(`Campaign exported to:\n${result.path}`);
            } else {
                setError(result.error || 'Failed to export campaign');
            }
        } catch (err) {
            setError((err as Error).message);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-900" style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', position: 'absolute' }}>
            <div className="bg-stone-800 border border-stone-700 rounded-lg p-8 w-full max-w-2xl shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-amber-400">Campaigns</h1>
                        <p className="text-stone-400 text-sm">{userEmail}</p>
                    </div>
                    <button
                        onClick={onSignOut}
                        className="text-stone-400 hover:text-stone-200 text-sm px-3 py-1 border border-stone-600 rounded"
                    >
                        Sign Out
                    </button>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-700 text-red-300 px-3 py-2 rounded text-sm mb-4">
                        {error}
                    </div>
                )}

                {/* Campaign List */}
                <div className="space-y-2 mb-6 max-h-80 overflow-y-auto">
                    {loading && campaigns.length === 0 ? (
                        <div className="text-center text-stone-400 py-8">Loading campaigns…</div>
                    ) : campaigns.length === 0 ? (
                        <div className="text-center text-stone-400 py-8">
                            No campaigns yet. Create one or import from JSON.
                        </div>
                    ) : (
                        campaigns.map(c => (
                            <div
                                key={c.id}
                                className="flex items-center justify-between bg-stone-700/50 border border-stone-600 rounded px-4 py-3 hover:bg-stone-700 transition-colors"
                            >
                                <button
                                    onClick={() => handleLoad(c.id)}
                                    className="flex-1 text-left"
                                >
                                    <div className="text-stone-200 font-medium">{c.name}</div>
                                    {c.description && (
                                        <div className="text-stone-400 text-sm">{c.description}</div>
                                    )}
                                    <div className="text-stone-500 text-xs mt-1">
                                        Updated {new Date(c.updated_at).toLocaleDateString()}
                                    </div>
                                </button>
                                <button
                                    onClick={() => handleDelete(c.id, c.name)}
                                    className="ml-3 text-red-400 hover:text-red-300 text-sm px-2 py-1"
                                    title="Delete campaign"
                                >
                                    ✕
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Create Campaign */}
                <form onSubmit={handleCreate} className="border-t border-stone-700 pt-4 mb-4">
                    <h2 className="text-sm font-semibold text-stone-300 mb-2">New Campaign</h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            className="flex-1 px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-200 text-sm focus:outline-none focus:border-amber-500"
                            placeholder="Campaign name"
                            required
                        />
                        <button
                            type="submit"
                            disabled={creating || !newName.trim()}
                            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-600 text-white text-sm font-semibold rounded transition-colors"
                        >
                            {creating ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>

                {/* Import / Export */}
                <div className="border-t border-stone-700 pt-4 flex gap-2">
                    <button
                        onClick={() => setShowImportDialog(!showImportDialog)}
                        className="px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm rounded border border-stone-600 transition-colors"
                    >
                        Import from JSON
                    </button>
                    <button
                        onClick={handleExport}
                        className="px-3 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm rounded border border-stone-600 transition-colors"
                    >
                        Export to JSON
                    </button>
                </div>

                {/* Import Dialog */}
                {showImportDialog && (
                    <form onSubmit={handleImport} className="mt-3 bg-stone-700/50 border border-stone-600 rounded p-4 space-y-3">
                        <div>
                            <label className="block text-sm text-stone-300 mb-1">Campaign Name</label>
                            <input
                                type="text"
                                value={importName}
                                onChange={e => setImportName(e.target.value)}
                                className="w-100 px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-200 text-sm focus:outline-none focus:border-amber-500"
                                placeholder="Name for imported campaign"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-stone-300 mb-1">JSON File</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={importPath}
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-stone-800 border border-stone-600 rounded text-stone-400 text-sm"
                                    placeholder="No file selected"
                                />
                                <button
                                    type="button"
                                    onClick={handleSelectImportFile}
                                    className="px-3 py-2 bg-stone-600 hover:bg-stone-500 text-stone-200 text-sm rounded transition-colors"
                                >
                                    Browse…
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                disabled={importing || !importPath || !importName.trim()}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-600 text-white text-sm font-semibold rounded transition-colors"
                            >
                                {importing ? 'Importing…' : 'Import'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowImportDialog(false)}
                                className="px-4 py-2 bg-stone-700 hover:bg-stone-600 text-stone-200 text-sm rounded transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
