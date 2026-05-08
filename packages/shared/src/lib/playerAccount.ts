/**
 * Stable synthetic login email for campaign players created via GM (`campaign_members` + Auth).
 * Must stay in sync with account creation in the GM app.
 */
export function playerAccountEmail(username: string, campaignId: string): string {
  const u = username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  const slug = u.length > 0 ? u : 'player';
  const c = campaignId.replace(/-/g, '');
  return `${slug}.${c}@players.local`;
}
