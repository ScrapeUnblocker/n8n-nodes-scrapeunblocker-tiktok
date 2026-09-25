# n8n-nodes-scrapeunblocker-tiktok

This is an n8n community node. It lets you scrape public **TikTok creator profiles, videos, hashtags, keyword search results and comments** in your n8n workflows.

The node runs the [TikTok Scraper](https://apify.com/scrapeunblocker/tiktok-scraper) Actor by ScrapeUnblocker on the [Apify](https://apify.com) platform with **your own Apify account**, waits for the run to finish and returns every scraped record as an n8n item. No TikTok account, login, cookies or proxies are needed.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/sustainable-use-license/) workflow automation platform.

[Installation](#installation)
[Credentials](#credentials)
[Operations](#operations)
[Output](#output)
[Example workflow](#example-workflow)
[Pricing](#pricing)
[Compatibility](#compatibility)
[Resources](#resources)
[Version history](#version-history)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. The npm package name is `n8n-nodes-scrapeunblocker-tiktok`.

## Credentials

The node authenticates with an **Apify API token**. Every run starts on the Apify account that owns the token and is billed to that account (see [Pricing](#pricing)).

### 1. Create an Apify account (skip if you already have one)

1. Go to [console.apify.com/sign-up](https://console.apify.com/sign-up) and sign up with email, Google or GitHub.
2. Confirm your email address if Apify asks you to.

The free Apify plan needs no credit card and includes a monthly usage credit, which is enough to try the node. Current plan limits are listed on [apify.com/pricing](https://apify.com/pricing).

### 2. Get your API token

1. Open [Apify Console](https://console.apify.com) and go to **Settings** → **API & Integrations**, or open [console.apify.com/settings/integrations](https://console.apify.com/settings/integrations) directly.
2. Find the **Personal API tokens** section.
3. Either use the existing token (the one marked *Default API token created on sign up*): click the eye icon to reveal it or the copy icon to copy it.
4. Or create a dedicated token for n8n (recommended, so you can revoke it without affecting anything else):
   1. Click **+ Add new token** (the button may read **Create new token**).
   2. In the **Create a new personal API token** dialog, enter a **Description** such as `n8n`.
   3. Optionally switch on **Set expiration date** and pick a date.
   4. Leave **Limit token permissions** switched off. A token with limited permissions may not be allowed to run this Actor or read its results.
   5. Click **Create** and copy the new token.

The token starts with `apify_api_`. Treat it like a password: anyone who has it can run Actors on your account. You can revoke or rotate it on the same page at any time.

> Working in an Apify **organization**? Switch to the organization in Apify Console first and copy a token from its **API & Integrations** page, so runs are billed to the organization.

### 3. Add the credential in n8n

1. Add the **TikTok Scraper** node to a workflow and open it.
2. In **Credential to connect with**, choose **Create new credential**. (You can also create an **Apify API** credential from the n8n credentials list.)
3. Paste the token into **API Key** and click **Save**. n8n checks the token right away; an invalid token shows *Authorization failed - please check your credentials*.

Already have an **Apify API** credential in n8n (for example from the official Apify node)? This node uses the same credential type, so you can simply select it.

## Operations

Pick a **Resource** and an **Operation**. Each n8n input item starts one Apify run. List fields accept several values separated by commas or new lines, or an array returned by an expression, so one run can cover many profiles, posts or hashtags.

| Resource | Operation | Fields | Returns |
|---|---|---|---|
| **Profile** | Get | **Profiles** - handles or profile URLs (`nasa`, `@nasa`, `https://www.tiktok.com/@nasa`)<br>**Videos Per Profile** - newest videos per creator, 0-200 (default 10, 0 = profile only) | One `profile` item per creator plus its newest videos |
| **Video** | Get | **Post URLs** - video or photo post URLs, bare video IDs or `vm.tiktok.com` short links | One `video` or `photo` item per post |
| **Video** | Search | **Keywords** - one search per line<br>**Results Per Keyword** - 1-200 (default 20) | The videos TikTok ranks for each keyword |
| **Hashtag** | Get | **Hashtags** - names or URLs (`nasa`, `#nasa`, `https://www.tiktok.com/tag/nasa`)<br>**Videos Per Hashtag** - 0-200 (default 10, 0 = totals only) | One `hashtag` item per tag plus its videos |
| **Comment** | Get Many | **Post URLs** - posts whose comments you want<br>**Comments Per Post** - top-level comments per post, 1-500 (default 50) | One `comment` item per comment |

### Options

| Option | Applies to | Description |
|---|---|---|
| **Full Video Details** | Profile, Hashtag | On (default): every listed video carries exact plays, likes, comments, shares, saves, music and media URLs. Off: only ID, caption, cover, author and play count, and the run is faster. |
| **Include Summary Records** | Profile, Hashtag | On (default): also return the `profile` / `hashtag` summary item next to the videos. Off: videos only. |
| **Proxy Country** | All | Two-letter country code of the exit IP, e.g. `US`. Only needed for region-restricted posts; for keyword search it selects the country whose ranking is returned. |
| **Timeout (Seconds)** | All | Maximum run time of the Apify run. `0` keeps the Actor default. A run that times out fails the node. |

### How a run works

1. The node starts the Actor on your Apify account with the fields you set.
2. It waits for the run to finish. Short jobs take seconds; deep lists (up to 200 videos per creator or hashtag), search and comments open a browser session and take roughly 10-30 seconds per input.
3. It returns every record from the run's dataset as a separate n8n item.

The run is also visible in Apify Console under **Runs**. If a run fails or times out, the node error links to the run log and tells you whether any results were saved before it stopped.

Stopping the n8n execution only stops the node from waiting: the Apify run keeps going and its results are still charged. To stop it, abort the run in Apify Console under **Runs**, and use **Timeout (Seconds)** to cap long runs up front.

### Use as an AI Agent tool

The node can be attached to an n8n **AI Agent** as a tool, so the agent can look up TikTok creators, videos, hashtags or comments on its own.

## Output

Every item has a `type` field (`profile`, `video`, `photo`, `hashtag`, `comment` or `error`) plus `source` and `sourceInput` (what you entered), so mixed results are easy to filter with an **If** or **Filter** node.

- **profile**: `username`, `nickname`, `bio`, `bioLink`, `verified`, `privateAccount`, `region`, `language`, `createdAt`, avatar URLs, `stats` (`followers`, `following`, `likes`, `videos`, `friends`)
- **video / photo**: `id`, `url`, `description`, `hashtags`, `mentions`, `language`, `createdAt`, `stats` (`plays`, `likes`, `comments`, `shares`, `saves`, `reposts`), `author` (with its own stats), `music`, `video` (duration, resolution, cover, play and download URLs, quality variants, subtitles), `images` for photo posts, `labels`, `flags`
- **hashtag**: `hashtag`, `id`, `url`, `stats` (`views`, `videos`)
- **comment**: `text`, `createdAt`, `likes`, `replyCount`, `replies`, `author`, `isCreator`, `likedByCreator`, `videoId`, `videoUrl`, `totalComments`
- **error**: a post or account that cannot be read (deleted, private, region-locked, not found), with TikTok's reason in `error`

Example `video` item (shortened):

```json
{
  "type": "video",
  "id": "7686893699099413773",
  "url": "https://www.tiktok.com/@nasa/video/7686893699099413773",
  "description": "Another big week in the sky and beyond at NASA 🚀 ...",
  "createdAt": "2026-09-18T16:00:00+00:00",
  "stats": { "plays": 179100, "likes": 11900, "comments": 401, "shares": 439, "saves": 961, "reposts": 0 },
  "author": { "username": "nasa", "nickname": "NASA", "verified": true },
  "source": "url",
  "sourceInput": "https://www.tiktok.com/@nasa/video/7686893699099413773"
}
```

## Example workflow

A typical use is a daily snapshot of a few creators: **Schedule Trigger** → **TikTok Scraper** (*Profile → Get*) → **Filter** (`type` is `video`) → a destination such as Google Sheets, Airtable or a database.

To try the node in a minute, copy the workflow below, paste it into the n8n editor (Ctrl+V / Cmd+V), open the **TikTok Scraper** node, select your **Apify API** credential and click **Execute workflow**. It returns NASA's profile record and its 5 newest videos.

```json
{
  "nodes": [
    {
      "parameters": {},
      "name": "When clicking 'Execute workflow'",
      "type": "n8n-nodes-base.manualTrigger",
      "typeVersion": 1,
      "position": [0, 0]
    },
    {
      "parameters": {
        "resource": "profile",
        "operation": "get",
        "profiles": "nasa",
        "videosPerProfile": 5,
        "options": {}
      },
      "name": "TikTok Scraper",
      "type": "n8n-nodes-scrapeunblocker-tiktok.tikTokScraper",
      "typeVersion": 1,
      "position": [220, 0]
    }
  ],
  "connections": {
    "When clicking 'Execute workflow'": {
      "main": [[{ "node": "TikTok Scraper", "type": "main", "index": 0 }]]
    }
  }
}
```

## Pricing

The node itself is free. The Actor is paid per result on Apify: **$2 per 1,000 results** plus a tiny start fee per run ($0.00005), charged to the Apify account of your token. Every item the node returns counts as one result. The current price is always shown on the [Actor page](https://apify.com/scrapeunblocker/tiktok-scraper), and your spending is visible in Apify Console.

## Compatibility

Tested with n8n 2.32 and 2.40 (self-hosted).

## Resources

- [TikTok Scraper Actor on Apify](https://apify.com/scrapeunblocker/tiktok-scraper)
- [Apify API tokens documentation](https://docs.apify.com/platform/integrations/api#api-token)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [ScrapeUnblocker](https://www.scrapeunblocker.com/?utm_source=n8n&utm_medium=integration&utm_campaign=n8n-tiktok-node) - the anti-bot scraping API behind the Actor

## Version history

- 0.1.0: Initial release - Profile, Video (Get, Search), Hashtag and Comment operations running the TikTok Scraper Actor on Apify
- 0.1.1: First release published from GitHub Actions with an npm provenance statement
- 0.1.2: Added an importable example workflow to the README
