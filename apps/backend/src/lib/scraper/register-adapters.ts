import { registerScraperAdapter } from '@festgrid/domain';
import { instagramScraperAdapter } from './instagram-adapter.js';
import { twitterScraperAdapter } from './twitter-adapter.js';

registerScraperAdapter('instagram', instagramScraperAdapter);
registerScraperAdapter('twitter', twitterScraperAdapter);
