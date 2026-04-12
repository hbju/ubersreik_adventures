import React, { useEffect, useState } from 'react';
import { supabase } from '@wfrp/shared';

interface CampaignInfo {
  campaign_id: string;
  role: string;
  campaigns: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface CampaignSelectProps {
  onSelect: (campaignId: string) => void;
}

export const CampaignSelect: React.FC<CampaignSelectProps> = ({ onSelect }) => {
  const [campaigns, setCampaigns] = useState<CampaignInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      const result = await supabase.campaignQueries.listMyCampaigns();
      setCampaigns((result ?? []) as unknown as CampaignInfo[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const sb = supabase.getSupabase();
    await sb.auth.signOut();
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading campaigns...</p>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <h1 style={{ color: 'var(--color-gold)', textAlign: 'center', fontSize: '2rem' }}>
        Select Campaign
      </h1>
      <div className="auth-card" style={{ width: '500px' }}>
        {error && <div className="auth-error">{error}</div>}

        {campaigns.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--color-ink-faded)' }}>
            <p>No campaigns found.</p>
            <p style={{ fontSize: '0.85rem' }}>
              Ask your GM to invite you to a campaign.
            </p>
          </div>
        ) : (
          <div className="campaign-list">
            {campaigns.map(c => (
              <div
                key={c.campaign_id}
                className="campaign-item"
                onClick={() => onSelect(c.campaign_id)}
              >
                <div>
                  <strong style={{ color: 'var(--color-ink)' }}>
                    {c.campaigns.name}
                  </strong>
                  {c.campaigns.description && (
                    <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--color-ink-faded)' }}>
                      {c.campaigns.description}
                    </p>
                  )}
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  color: c.role === 'gm' ? 'var(--color-gold-dark)' : 'var(--color-ink-faded)',
                  fontWeight: 600,
                }}>
                  {c.role}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={handleLogout} style={{ marginTop: '16px', width: '100%' }}>
          Sign Out
        </button>
      </div>
    </div>
  );
};
