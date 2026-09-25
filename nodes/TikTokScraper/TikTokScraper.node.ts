import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { parseList, runActorAndGetItems } from './GenericFunctions';

// ScrapeUnblocker's public "TikTok Scraper" Actor: https://apify.com/scrapeunblocker/tiktok-scraper
const ACTOR_ID = 'KvGOw39OlzDUdbzdw';
const INTEGRATION_APP_ID = 'scrapeunblocker-tiktok-scraper';

// Search keywords may legitimately contain commas, so only new lines separate them.
const NEWLINE_SEPARATOR = /\n+/;

function requireList(
	this: IExecuteFunctions,
	parameterName: string,
	label: string,
	itemIndex: number,
	separator?: RegExp,
): string[] {
	const list = parseList(this.getNodeParameter(parameterName, itemIndex), separator);
	if (list.length === 0) {
		throw new NodeOperationError(this.getNode(), `Enter at least one ${label}`, { itemIndex });
	}
	return list;
}

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
			input.profiles = requireList.call(this, 'profiles', 'profile', itemIndex);
			input.max_videos_per_profile = this.getNodeParameter('videosPerProfile', itemIndex);
			break;
		case 'video:get':
			input.video_urls = requireList.call(this, 'videoUrls', 'post URL', itemIndex);
			break;
		case 'video:search':
			input.search_queries = requireList.call(
				this,
				'searchQueries',
				'keyword',
				itemIndex,
				NEWLINE_SEPARATOR,
			);
			input.max_results_per_query = this.getNodeParameter('resultsPerKeyword', itemIndex);
			break;
		case 'hashtag:get':
			input.hashtags = requireList.call(this, 'hashtags', 'hashtag', itemIndex);
			input.max_videos_per_hashtag = this.getNodeParameter('videosPerHashtag', itemIndex);
			break;
		case 'comment:getAll':
			input.comment_urls = requireList.call(this, 'commentUrls', 'post URL', itemIndex);
			input.max_comments_per_post = this.getNodeParameter('commentsPerPost', itemIndex);
			break;
		default:
			throw new NodeOperationError(
				this.getNode(),
				`The operation "${operation}" is not supported for resource "${resource}"`,
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
						description: 'Get creator profiles with exact stats and their newest videos',
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
						description: 'Get video or photo posts by URL with exact engagement, music and media',
						action: 'Get video posts',
					},
					{
						name: 'Search',
						value: 'search',
						description: 'Search videos by keyword in TikTok ranking order',
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
						description: 'Get hashtag totals (views, videos) and the videos under it',
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
						description: 'Get the comments of video or photo posts',
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
				placeholder: 'nasa, @khaby.lame, https://www.tiktok.com/@nasa',
				description:
					'TikTok handles or profile URLs, separated by commas or new lines. An expression may also return an array.',
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
				placeholder: 'https://www.tiktok.com/@nasa/video/7665075736742530317',
				description:
					'Video or photo post URLs, bare video IDs or vm.tiktok.com short links, separated by commas or new lines. An expression may also return an array.',
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
				placeholder: 'space telescope',
				description:
					'Keywords to search videos for, one search per line. An expression may also return an array.',
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
				placeholder: 'nasa, #space, https://www.tiktok.com/tag/nasa',
				description:
					'Hashtag names or URLs, separated by commas or new lines. An expression may also return an array.',
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
				placeholder: 'https://www.tiktok.com/@nasa/video/7665075736742530317',
				description:
					'Video or photo post URLs, bare video IDs or vm.tiktok.com short links whose comments to return, separated by commas or new lines. An expression may also return an array.',
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
						displayName: 'Proxy Country',
						name: 'proxyCountry',
						type: 'string',
						default: '',
						placeholder: 'US',
						description:
							'Two-letter country code of the exit IP. Leave empty unless posts are region-restricted. For keyword search it selects the country whose ranking is returned.',
					},
					{
						displayName: 'Timeout (Seconds)',
						name: 'timeout',
						type: 'number',
						typeOptions: { minValue: 0 },
						default: 0,
						description:
							'Maximum run time of the Apify Actor run. 0 keeps the Actor default. A run that times out fails the node.',
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

				for (const result of results) {
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
