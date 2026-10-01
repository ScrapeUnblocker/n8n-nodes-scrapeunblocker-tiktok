import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import type { OutputShape } from './GenericFunctions';
import { requireList, runActorAndGetItems, shapeItems } from './GenericFunctions';

// ScrapeUnblocker's public "TikTok Scraper" Actor: https://apify.com/scrapeunblocker/tiktok-scraper
const ACTOR_ID = 'KvGOw39OlzDUdbzdw';
const INTEGRATION_APP_ID = 'scrapeunblocker-tiktok-scraper';

// "resource:operation" -> fields kept by Simplify per item type (a.b is flattened to aB).
const OUTPUT_SHAPES: Record<string, OutputShape> = {
	'profile:get': {
		byType: {
			profile: [
				'type',
				'username',
				'nickname',
				'verified',
				'bio',
				'stats.followers',
				'stats.following',
				'stats.likes',
				'stats.videos',
				'profileUrl',
			],
			video: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
			photo: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
		},
		idFields: ['type', 'id', 'username', 'hashtag'],
	},
	'video:get': {
		byType: {
			video: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
			photo: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
		},
		idFields: ['type', 'id', 'username', 'hashtag'],
	},
	'video:search': {
		byType: {
			video: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
			photo: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
		},
		idFields: ['type', 'id', 'username', 'hashtag'],
	},
	'hashtag:get': {
		byType: {
			video: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
			photo: [
				'type',
				'id',
				'url',
				'description',
				'createdAt',
				'author.username',
				'stats.plays',
				'stats.likes',
				'stats.comments',
				'stats.shares',
			],
			hashtag: ['type', 'hashtag', 'id', 'url', 'stats.views', 'stats.videos'],
		},
		idFields: ['type', 'id', 'username', 'hashtag'],
	},
	'comment:getAll': {
		byType: {
			comment: [
				'type',
				'id',
				'text',
				'likes',
				'replyCount',
				'createdAt',
				'author.username',
				'videoId',
				'videoUrl',
			],
		},
		idFields: ['type', 'id', 'username', 'hashtag'],
	},
};

function buildActorInput(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	options: IDataObject,
	itemIndex: number,
): IDataObject {
	const input: IDataObject = {};

	switch (`${resource}:${operation}`) {
		case 'profile:get':
			input.profiles = requireList.call(this, 'profiles', 'Profiles', itemIndex);
			input.max_videos_per_profile = this.getNodeParameter('videosPerProfile', itemIndex);
			break;
		case 'video:get':
			input.video_urls = requireList.call(this, 'videoUrls', 'Post URLs', itemIndex);
			break;
		case 'video:search':
			// Search keywords may contain commas, so only new lines separate them.
			input.search_queries = requireList.call(this, 'searchQueries', 'Keywords', itemIndex, true);
			input.max_results_per_query = this.getNodeParameter('resultsPerKeyword', itemIndex);
			break;
		case 'hashtag:get':
			input.hashtags = requireList.call(this, 'hashtags', 'Hashtags', itemIndex);
			input.max_videos_per_hashtag = this.getNodeParameter('videosPerHashtag', itemIndex);
			break;
		case 'comment:getAll':
			input.comment_urls = requireList.call(this, 'commentUrls', 'Post URLs', itemIndex);
			input.max_comments_per_post = this.getNodeParameter('commentsPerPost', itemIndex);
			break;
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation '${operation}' is not supported for resource '${resource}'`,
				{ itemIndex },
			);
	}

	if (resource === 'profile' || resource === 'hashtag') {
		input.video_details = options.fullVideoDetails ?? true;
		input.include_summary_records = options.includeSummaryRecords ?? true;
	}
	const proxyCountry = String(options.proxyCountry ?? '').trim();
	if (proxyCountry) {
		input.proxy_country = proxyCountry.toUpperCase();
	}
	return input;
}

export class TikTokScraper implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'TikTok Scraper',
		name: 'tikTokScraper',
		icon: { light: 'file:tiktokScraper.svg', dark: 'file:tiktokScraper.dark.svg' },
		group: ['input'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Scrape TikTok profiles, videos, hashtags, keyword search results and comments with the ScrapeUnblocker Actor on Apify',
		defaults: {
			name: 'TikTok Scraper',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'apifyApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Comment', value: 'comment' },
					{ name: 'Hashtag', value: 'hashtag' },
					{ name: 'Profile', value: 'profile' },
					{ name: 'Video', value: 'video' },
				],
				default: 'profile',
			},

			// Operations
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['profile'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description:
							'Retrieve creator profiles with exact follower counts and their newest videos',
						action: 'Get creator profiles',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['video'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description:
							'Retrieve video or photo posts by URL with exact engagement, music and media',
						action: 'Get video posts',
					},
					{
						name: 'Search',
						value: 'search',
						description: "Find videos for a keyword in TikTok's own ranking order",
						action: 'Search videos',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['hashtag'] } },
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Retrieve hashtag totals (views, videos) and the videos under it',
						action: 'Get hashtags',
					},
				],
				default: 'get',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['comment'] } },
				options: [
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'Retrieve the comments of video or photo posts',
						action: 'Get many comments',
					},
				],
				default: 'getAll',
			},

			// Profile: Get
			{
				displayName: 'Profiles',
				name: 'profiles',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. nasa, @khaby.lame, https://www.tiktok.com/@nasa',
				description: 'TikTok handles or profile URLs, separated by commas or new lines',
				displayOptions: { show: { resource: ['profile'], operation: ['get'] } },
			},
			{
				displayName: 'Videos Per Profile',
				name: 'videosPerProfile',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 200 },
				default: 10,
				description:
					"How many of each creator's newest videos to return (0-200). 0 returns the profile record only.",
				displayOptions: { show: { resource: ['profile'], operation: ['get'] } },
			},

			// Video: Get
			{
				displayName: 'Post URLs',
				name: 'videoUrls',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. https://www.tiktok.com/@nasa/video/7665075736742530317',
				description:
					'Video or photo post URLs, bare video IDs or vm.tiktok.com short links, separated by commas or new lines',
				displayOptions: { show: { resource: ['video'], operation: ['get'] } },
			},

			// Video: Search
			{
				displayName: 'Keywords',
				name: 'searchQueries',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				placeholder: 'e.g. space telescope',
				description: 'Keywords to search videos for, one search per line',
				displayOptions: { show: { resource: ['video'], operation: ['search'] } },
			},
			{
				displayName: 'Results Per Keyword',
				name: 'resultsPerKeyword',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 200 },
				default: 20,
				description: 'How many videos to return for each keyword (1-200)',
				displayOptions: { show: { resource: ['video'], operation: ['search'] } },
			},

			// Hashtag: Get
			{
				displayName: 'Hashtags',
				name: 'hashtags',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. nasa, #space, https://www.tiktok.com/tag/nasa',
				description: 'Hashtag names or URLs, separated by commas or new lines',
				displayOptions: { show: { resource: ['hashtag'], operation: ['get'] } },
			},
			{
				displayName: 'Videos Per Hashtag',
				name: 'videosPerHashtag',
				type: 'number',
				typeOptions: { minValue: 0, maxValue: 200 },
				default: 10,
				description:
					"How many of each hashtag's videos to return (0-200). 0 returns the hashtag totals only.",
				displayOptions: { show: { resource: ['hashtag'], operation: ['get'] } },
			},

			// Comment: Get Many
			{
				displayName: 'Post URLs',
				name: 'commentUrls',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'e.g. https://www.tiktok.com/@nasa/video/7665075736742530317',
				description:
					'Video or photo post URLs, bare video IDs or vm.tiktok.com short links whose comments to return, separated by commas or new lines',
				displayOptions: { show: { resource: ['comment'], operation: ['getAll'] } },
			},
			{
				displayName: 'Comments Per Post',
				name: 'commentsPerPost',
				type: 'number',
				typeOptions: { minValue: 1, maxValue: 500 },
				default: 50,
				description: 'How many top-level comments to return for each post (1-500)',
				displayOptions: { show: { resource: ['comment'], operation: ['getAll'] } },
			},

			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						resource: ['profile'],
						operation: ['get'],
						'@tool': [false],
					},
				},
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				default: 'simple',
				description: 'Which fields of each result to send to the agent',
				options: [
					{
						name: 'Raw',
						value: 'raw',
						description: 'Send all the available fields',
					},
					{
						name: 'Selected Fields',
						value: 'fields',
						description: 'Send only the fields you select',
					},
					{
						name: 'Simplified',
						value: 'simple',
						description: 'Send the 10 most useful fields of each profile and video',
					},
				],
				displayOptions: {
					show: {
						resource: ['profile'],
						operation: ['get'],
						'@tool': [true],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				default: [],
				description: 'The fields to send to the agent. Type and ID are always included.',
				options: [
					{
						name: 'Aigc Description',
						value: 'aigcDescription',
					},
					{
						name: 'Author',
						value: 'author',
					},
					{
						name: 'Avatar',
						value: 'avatar',
					},
					{
						name: 'Bio',
						value: 'bio',
					},
					{
						name: 'Bio Link',
						value: 'bioLink',
					},
					{
						name: 'Commerce',
						value: 'commerce',
					},
					{
						name: 'Created At',
						value: 'createdAt',
					},
					{
						name: 'Created Timestamp',
						value: 'createdTimestamp',
					},
					{
						name: 'Description',
						value: 'description',
					},
					{
						name: 'Detailed',
						value: 'detailed',
					},
					{
						name: 'Effects',
						value: 'effects',
					},
					{
						name: 'Flags',
						value: 'flags',
					},
					{
						name: 'Has More',
						value: 'hasMore',
					},
					{
						name: 'Hashtags',
						value: 'hashtags',
					},
					{
						name: 'ID',
						value: 'id',
					},
					{
						name: 'Image Count',
						value: 'imageCount',
					},
					{
						name: 'Images',
						value: 'images',
					},
					{
						name: 'Is Organization',
						value: 'isOrganization',
					},
					{
						name: 'Labels',
						value: 'labels',
					},
					{
						name: 'Language',
						value: 'language',
					},
					{
						name: 'Live Room ID',
						value: 'liveRoomId',
					},
					{
						name: 'Location Created',
						value: 'locationCreated',
					},
					{
						name: 'Mentions',
						value: 'mentions',
					},
					{
						name: 'Music',
						value: 'music',
					},
					{
						name: 'Nickname',
						value: 'nickname',
					},
					{
						name: 'Private Account',
						value: 'privateAccount',
					},
					{
						name: 'Profile URL',
						value: 'profileUrl',
					},
					{
						name: 'Region',
						value: 'region',
					},
					{
						name: 'Sec Uid',
						value: 'secUid',
					},
					{
						name: 'Settings',
						value: 'settings',
					},
					{
						name: 'Source',
						value: 'source',
					},
					{
						name: 'Source Hashtag',
						value: 'sourceHashtag',
					},
					{
						name: 'Source Input',
						value: 'sourceInput',
					},
					{
						name: 'Source Profile',
						value: 'sourceProfile',
					},
					{
						name: 'Stats',
						value: 'stats',
					},
					{
						name: 'Sticker Texts',
						value: 'stickerTexts',
					},
					{
						name: 'Suggested Words',
						value: 'suggestedWords',
					},
					{
						name: 'Tabs',
						value: 'tabs',
					},
					{
						name: 'Title',
						value: 'title',
					},
					{
						name: 'Type',
						value: 'type',
					},
					{
						name: 'URL',
						value: 'url',
					},
					{
						name: 'User ID',
						value: 'userId',
					},
					{
						name: 'Username',
						value: 'username',
					},
					{
						name: 'Verified',
						value: 'verified',
					},
					{
						name: 'Video',
						value: 'video',
					},
					{
						name: 'Videos Collected',
						value: 'videosCollected',
					},
					{
						name: 'Videos Source',
						value: 'videosSource',
					},
				],
				displayOptions: {
					show: {
						resource: ['profile'],
						operation: ['get'],
						'@tool': [true],
						output: ['fields'],
					},
				},
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['get'],
						'@tool': [false],
					},
				},
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				default: 'simple',
				description: 'Which fields of each result to send to the agent',
				options: [
					{
						name: 'Raw',
						value: 'raw',
						description: 'Send all the available fields',
					},
					{
						name: 'Selected Fields',
						value: 'fields',
						description: 'Send only the fields you select',
					},
					{
						name: 'Simplified',
						value: 'simple',
						description: 'Send the 10 most useful fields of each video',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['get'],
						'@tool': [true],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				default: [],
				description: 'The fields to send to the agent. Type and ID are always included.',
				options: [
					{
						name: 'Aigc Description',
						value: 'aigcDescription',
					},
					{
						name: 'Author',
						value: 'author',
					},
					{
						name: 'Created At',
						value: 'createdAt',
					},
					{
						name: 'Created Timestamp',
						value: 'createdTimestamp',
					},
					{
						name: 'Description',
						value: 'description',
					},
					{
						name: 'Detailed',
						value: 'detailed',
					},
					{
						name: 'Effects',
						value: 'effects',
					},
					{
						name: 'Flags',
						value: 'flags',
					},
					{
						name: 'Hashtags',
						value: 'hashtags',
					},
					{
						name: 'ID',
						value: 'id',
					},
					{
						name: 'Image Count',
						value: 'imageCount',
					},
					{
						name: 'Images',
						value: 'images',
					},
					{
						name: 'Labels',
						value: 'labels',
					},
					{
						name: 'Language',
						value: 'language',
					},
					{
						name: 'Location Created',
						value: 'locationCreated',
					},
					{
						name: 'Mentions',
						value: 'mentions',
					},
					{
						name: 'Music',
						value: 'music',
					},
					{
						name: 'Source',
						value: 'source',
					},
					{
						name: 'Source Hashtag',
						value: 'sourceHashtag',
					},
					{
						name: 'Source Input',
						value: 'sourceInput',
					},
					{
						name: 'Source Profile',
						value: 'sourceProfile',
					},
					{
						name: 'Stats',
						value: 'stats',
					},
					{
						name: 'Sticker Texts',
						value: 'stickerTexts',
					},
					{
						name: 'Suggested Words',
						value: 'suggestedWords',
					},
					{
						name: 'Title',
						value: 'title',
					},
					{
						name: 'Type',
						value: 'type',
					},
					{
						name: 'URL',
						value: 'url',
					},
					{
						name: 'Video',
						value: 'video',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['get'],
						'@tool': [true],
						output: ['fields'],
					},
				},
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['search'],
						'@tool': [false],
					},
				},
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				default: 'simple',
				description: 'Which fields of each result to send to the agent',
				options: [
					{
						name: 'Raw',
						value: 'raw',
						description: 'Send all the available fields',
					},
					{
						name: 'Selected Fields',
						value: 'fields',
						description: 'Send only the fields you select',
					},
					{
						name: 'Simplified',
						value: 'simple',
						description: 'Send the 10 most useful fields of each video',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['search'],
						'@tool': [true],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				default: [],
				description: 'The fields to send to the agent. Type and ID are always included.',
				options: [
					{
						name: 'Aigc Description',
						value: 'aigcDescription',
					},
					{
						name: 'Author',
						value: 'author',
					},
					{
						name: 'Created At',
						value: 'createdAt',
					},
					{
						name: 'Created Timestamp',
						value: 'createdTimestamp',
					},
					{
						name: 'Description',
						value: 'description',
					},
					{
						name: 'Detailed',
						value: 'detailed',
					},
					{
						name: 'Effects',
						value: 'effects',
					},
					{
						name: 'Flags',
						value: 'flags',
					},
					{
						name: 'Hashtags',
						value: 'hashtags',
					},
					{
						name: 'ID',
						value: 'id',
					},
					{
						name: 'Image Count',
						value: 'imageCount',
					},
					{
						name: 'Images',
						value: 'images',
					},
					{
						name: 'Labels',
						value: 'labels',
					},
					{
						name: 'Language',
						value: 'language',
					},
					{
						name: 'Location Created',
						value: 'locationCreated',
					},
					{
						name: 'Mentions',
						value: 'mentions',
					},
					{
						name: 'Music',
						value: 'music',
					},
					{
						name: 'Source',
						value: 'source',
					},
					{
						name: 'Source Hashtag',
						value: 'sourceHashtag',
					},
					{
						name: 'Source Input',
						value: 'sourceInput',
					},
					{
						name: 'Source Profile',
						value: 'sourceProfile',
					},
					{
						name: 'Stats',
						value: 'stats',
					},
					{
						name: 'Sticker Texts',
						value: 'stickerTexts',
					},
					{
						name: 'Suggested Words',
						value: 'suggestedWords',
					},
					{
						name: 'Title',
						value: 'title',
					},
					{
						name: 'Type',
						value: 'type',
					},
					{
						name: 'URL',
						value: 'url',
					},
					{
						name: 'Video',
						value: 'video',
					},
				],
				displayOptions: {
					show: {
						resource: ['video'],
						operation: ['search'],
						'@tool': [true],
						output: ['fields'],
					},
				},
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						resource: ['hashtag'],
						operation: ['get'],
						'@tool': [false],
					},
				},
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				default: 'simple',
				description: 'Which fields of each result to send to the agent',
				options: [
					{
						name: 'Raw',
						value: 'raw',
						description: 'Send all the available fields',
					},
					{
						name: 'Selected Fields',
						value: 'fields',
						description: 'Send only the fields you select',
					},
					{
						name: 'Simplified',
						value: 'simple',
						description: 'Send the 10 most useful fields of each hashtag and video',
					},
				],
				displayOptions: {
					show: {
						resource: ['hashtag'],
						operation: ['get'],
						'@tool': [true],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				default: [],
				description: 'The fields to send to the agent. Type and ID are always included.',
				options: [
					{
						name: 'Aigc Description',
						value: 'aigcDescription',
					},
					{
						name: 'Author',
						value: 'author',
					},
					{
						name: 'Cover',
						value: 'cover',
					},
					{
						name: 'Created At',
						value: 'createdAt',
					},
					{
						name: 'Created Timestamp',
						value: 'createdTimestamp',
					},
					{
						name: 'Description',
						value: 'description',
					},
					{
						name: 'Detailed',
						value: 'detailed',
					},
					{
						name: 'Effects',
						value: 'effects',
					},
					{
						name: 'Flags',
						value: 'flags',
					},
					{
						name: 'Has More',
						value: 'hasMore',
					},
					{
						name: 'Hashtag',
						value: 'hashtag',
					},
					{
						name: 'Hashtags',
						value: 'hashtags',
					},
					{
						name: 'ID',
						value: 'id',
					},
					{
						name: 'Image Count',
						value: 'imageCount',
					},
					{
						name: 'Images',
						value: 'images',
					},
					{
						name: 'Labels',
						value: 'labels',
					},
					{
						name: 'Language',
						value: 'language',
					},
					{
						name: 'Location Created',
						value: 'locationCreated',
					},
					{
						name: 'Mentions',
						value: 'mentions',
					},
					{
						name: 'Music',
						value: 'music',
					},
					{
						name: 'Source',
						value: 'source',
					},
					{
						name: 'Source Hashtag',
						value: 'sourceHashtag',
					},
					{
						name: 'Source Input',
						value: 'sourceInput',
					},
					{
						name: 'Source Profile',
						value: 'sourceProfile',
					},
					{
						name: 'Stats',
						value: 'stats',
					},
					{
						name: 'Sticker Texts',
						value: 'stickerTexts',
					},
					{
						name: 'Suggested Words',
						value: 'suggestedWords',
					},
					{
						name: 'Title',
						value: 'title',
					},
					{
						name: 'Type',
						value: 'type',
					},
					{
						name: 'URL',
						value: 'url',
					},
					{
						name: 'Video',
						value: 'video',
					},
					{
						name: 'Videos Collected',
						value: 'videosCollected',
					},
					{
						name: 'Videos Source',
						value: 'videosSource',
					},
				],
				displayOptions: {
					show: {
						resource: ['hashtag'],
						operation: ['get'],
						'@tool': [true],
						output: ['fields'],
					},
				},
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description:
					'Whether to return a simplified version of the response instead of the raw data',
				displayOptions: {
					show: {
						resource: ['comment'],
						operation: ['getAll'],
						'@tool': [false],
					},
				},
			},
			{
				displayName: 'Output',
				name: 'output',
				type: 'options',
				default: 'simple',
				description: 'Which fields of each result to send to the agent',
				options: [
					{
						name: 'Raw',
						value: 'raw',
						description: 'Send all the available fields',
					},
					{
						name: 'Selected Fields',
						value: 'fields',
						description: 'Send only the fields you select',
					},
					{
						name: 'Simplified',
						value: 'simple',
						description: 'Send the 10 most useful fields of each comment',
					},
				],
				displayOptions: {
					show: {
						resource: ['comment'],
						operation: ['getAll'],
						'@tool': [true],
					},
				},
			},
			{
				displayName: 'Fields',
				name: 'fields',
				type: 'multiOptions',
				default: [],
				description: 'The fields to send to the agent. Type and ID are always included.',
				options: [
					{
						name: 'Author',
						value: 'author',
					},
					{
						name: 'Created At',
						value: 'createdAt',
					},
					{
						name: 'Created Timestamp',
						value: 'createdTimestamp',
					},
					{
						name: 'ID',
						value: 'id',
					},
					{
						name: 'Is Creator',
						value: 'isCreator',
					},
					{
						name: 'Language',
						value: 'language',
					},
					{
						name: 'Liked By Creator',
						value: 'likedByCreator',
					},
					{
						name: 'Likes',
						value: 'likes',
					},
					{
						name: 'Replies',
						value: 'replies',
					},
					{
						name: 'Reply Count',
						value: 'replyCount',
					},
					{
						name: 'Reply To Comment ID',
						value: 'replyToCommentId',
					},
					{
						name: 'Source',
						value: 'source',
					},
					{
						name: 'Source Input',
						value: 'sourceInput',
					},
					{
						name: 'Text',
						value: 'text',
					},
					{
						name: 'Total Comments',
						value: 'totalComments',
					},
					{
						name: 'Type',
						value: 'type',
					},
					{
						name: 'Video ID',
						value: 'videoId',
					},
					{
						name: 'Video URL',
						value: 'videoUrl',
					},
				],
				displayOptions: {
					show: {
						resource: ['comment'],
						operation: ['getAll'],
						'@tool': [true],
						output: ['fields'],
					},
				},
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Full Video Details',
						name: 'fullVideoDetails',
						type: 'boolean',
						default: true,
						description:
							"Whether to read each listed video's own page for exact plays, likes, comments, shares, saves, music and media URLs. When off, videos carry only ID, caption, cover, author and play count, and the run is faster.",
						displayOptions: { show: { '/resource': ['profile', 'hashtag'] } },
					},
					{
						displayName: 'Include Summary Records',
						name: 'includeSummaryRecords',
						type: 'boolean',
						default: true,
						description:
							'Whether to also return one summary item per creator or hashtag (type "profile" or "hashtag") next to the video items',
						displayOptions: { show: { '/resource': ['profile', 'hashtag'] } },
					},
					{
						displayName: 'Browse From Country',
						name: 'proxyCountry',
						type: 'string',
						default: '',
						placeholder: 'e.g. US',
						description:
							'Two-letter code of the country TikTok is opened from. Leave empty unless posts are only available in some countries. For keyword search it selects the country whose ranking is returned.',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
						description:
							"How long the Apify run may take, in seconds. 0 uses the Actor's default. If the time runs out, the node stops.",
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const options = this.getNodeParameter('options', i, {}) as IDataObject;

				const input = buildActorInput.call(this, resource, operation, options, i);
				const { items: results } = await runActorAndGetItems.call(this, {
					actorId: ACTOR_ID,
					integrationAppId: INTEGRATION_APP_ID,
					input,
					itemIndex: i,
					timeoutSecs: (options.timeout as number) || undefined,
				});

				const shape = OUTPUT_SHAPES[`${resource}:${operation}`];

				for (const result of shapeItems.call(this, results, shape, i)) {
					returnData.push({ json: result, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				// Both constructors return an error of their own class unchanged.
				if (error instanceof NodeApiError) {
					throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex: i });
				}
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		return [returnData];
	}
}
