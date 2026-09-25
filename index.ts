import { TikTokScraper } from './nodes/TikTokScraper/TikTokScraper.node';
import { ApifyApi } from './credentials/ApifyApi.credentials';

export const nodeTypes = [TikTokScraper];

export const credentialTypes = [ApifyApi];
