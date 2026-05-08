import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppContext } from '../context/AppContext';
import { getCampaignsForUser, createCampaign, type Campaign } from '@wfrp/shared';

export default function CampaignSelector() {
  const { t } = useTranslation();
  const { supabase, user, selectCampaign, signOut } = useAppContext();

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create-campaign modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    const result = await getCampaignsForUser(supabase, user.id);
    if (result.error) {
      setError(result.error.message);
    } else {
      setCampaigns(result.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCampaigns();
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    setCreating(true);
    setError(null);

    const result = await createCampaign(supabase, newName.trim(), user.id);
    if (result.error) {
      setError(result.error.message);
      setCreating(false);
      return;
    }

    // Select the newly created campaign
    selectCampaign(result.data.id);
    setCreating(false);
  };

  const displayName = user?.user_metadata?.display_name || user?.email || '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-900" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
      <div className="w-full max-w-lg p-8 bg-stone-800 rounded-lg shadow-xl border border-amber-900/30">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-amber-500 font-serif">
              {t('campaign.selectorTitle', 'Your Campaigns')}
            </h1>
            <p className="text-sm text-stone-400 mt-1">
              {t('campaign.welcomeBack', 'Welcome, {{name}}', { name: displayName })}
            </p>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="text-sm text-stone-500 hover:text-red-400 transition-colors ml-4"
          >
            {t('auth.logout', 'Sign Out')}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Campaign list */}
        {loading ? (
          <div className="py-12 text-center text-stone-500">
            {t('campaign.loading', 'Loading campaigns…')}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="py-12 text-center text-stone-500">
            {t('campaign.noCampaigns', 'No campaigns yet. Create your first one!')}
          </div>
        ) : (
          <ul className="space-y-2 mb-6 max-h-80 overflow-y-auto">
            {campaigns.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selectCampaign(c.id)}
                  className="w-full text-left p-4 bg-stone-700/50 hover:bg-stone-700 border border-stone-600 hover:border-amber-700 rounded transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-stone-100 font-medium group-hover:text-amber-400 transition-colors">
                      {c.name}
                    </span>
                    <span className="text-xs text-stone-500">
                      {new Date(c.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    v{c.version}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Create campaign */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              autoFocus
              className="flex-1 px-3 py-2 bg-stone-700 border border-stone-600 rounded text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              placeholder={t('campaign.namePlaceholder', 'Campaign name')}
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:opacity-50 text-white rounded transition-colors"
            >
              {creating
                ? t('campaign.creating', 'Creating…')
                : t('campaign.create', 'Create')}
            </button>
            <button
              type="button"
              onClick={() => { setShowCreate(false); setNewName(''); }}
              className="px-3 py-2 text-stone-400 hover:text-stone-200 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="w-full py-2 px-4 border-2 border-dashed border-stone-600 hover:border-amber-700 text-stone-400 hover:text-amber-400 rounded transition-colors"
          >
            + {t('campaign.createNew', 'New Campaign')}
          </button>
        )}
      </div>
    </div>
  );
}
