import { app } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { CampaignState } from '@wfrp/shared';

/**
 * In-memory cache of the campaign data
 */
let campaignData: CampaignState | null = null;

/**
 * Get the path to the campaign state file
 */
function getCampaignFilePath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'campaign-state.json');
}

/**
 * Load campaign data from disk into memory
 * If the file doesn't exist, initializes with default data
 * @returns The loaded campaign data
 */
export function loadCampaignData(): CampaignState {
  if (campaignData) {
    return campaignData;
  }

  const filePath = getCampaignFilePath();

  try {
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      campaignData = JSON.parse(fileContent) as CampaignState;
      console.log('Campaign data loaded from:', filePath);
    } else {
      // Initialize with default data if file doesn't exist
      campaignData = {
        characters: [],
        journal: [],
        mapPinStates: {},
        version: '1.0.0',
        lastModified: new Date().toISOString(),
      };
      console.log('No existing campaign data found. Initialized with defaults.');
    }
  } catch (error) {
    console.error('Error loading campaign data:', error);
    // Return default data on error
    campaignData = {
      characters: [],
      journal: [],
      mapPinStates: {},
      version: '1.0.0',
      lastModified: new Date().toISOString(),
    };
  }

  return campaignData;
}

/**
 * Save campaign data to disk
 * @param data The campaign data to save
 */
export function saveCampaignData(data: CampaignState): void {
  const filePath = getCampaignFilePath();

  try {
    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Update last modified timestamp
    data.lastModified = new Date().toISOString();

    // Write to file with pretty formatting
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    // Update in-memory cache
    campaignData = data;

    console.log('Campaign data saved to:', filePath);
  } catch (error) {
    console.error('Error saving campaign data:', error);
    throw error;
  }
}

/**
 * Get the current in-memory campaign data
 * @returns The current campaign data or null if not loaded
 */
export function getCampaignData(): CampaignState | null {
  return campaignData;
}

/**
 * Clear the in-memory cache (useful for testing or resetting)
 */
export function clearCampaignCache(): void {
  campaignData = null;
}
