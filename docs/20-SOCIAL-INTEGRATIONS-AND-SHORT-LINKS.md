# Social integrations, Instagram auto-replies, and short links

## What is implemented

The existing dashboard now includes **Social**, **Auto-replies**, and **Short links**. The implementations use Kachko's existing theme and layout.

- `/dashboard/social`: Instagram professional accounts and YouTube channel OAuth, disconnect/reconnect, manual and six-hour background sync, follower/subscriber snapshots, 30-day views and Instagram reach, recent-post metrics, posting-frequency heatmap, best engagement weekday, and Instagram audience demographics where the provider makes them available.
- `/dashboard/automations`: comment-triggered private replies for one post/reel, all posts/reels, or the next published post; any-comment or case-insensitive keyword matching; optional public comment reply; pause/edit/delete; sent/failure/click counters, monthly usage, delivery history, and manual retries for confirmed failures.
- `/dashboard/link-shortener`: safe HTTP(S) destinations, random codes or custom aliases, destination edits, campaign UTM fields, channels and tags, pause/reactivate, copy, downloadable QR, and daily/device/source/country click reports. Short links resolve at `/s/:code`. Previous aliases remain reserved and continue resolving after a rename.

Social report access checks `advanced_analytics`. Creating or enabling an Instagram automation checks `automations`, including a persisted entitlement check when a queued reply is about to send. Existing branding, routing, and billing feature keys continue to work. Basic shortening uses the Free plan. Prices are managed in Clerk.

## Configure real providers

The integration is disabled until its provider settings are present. No development account or fabricated analytics is supplied. Configure `apps/api/.env` using the names in `apps/api/.env.example`; secrets belong on the API, never in `NEXT_PUBLIC_*` variables or browser code.

Generate `SOCIAL_TOKEN_ENCRYPTION_KEY` from 32 random bytes, base64 encoded (for example, `openssl rand -base64 32`). Keep that key stable across replicas and deployments; changing it without re-encrypting existing credentials requires users to reconnect. Access and refresh tokens are encrypted with AES-256-GCM and are excluded from API responses.

### Instagram

Create a Meta app with Instagram API with Instagram Login. This path supports professional Business/Creator accounts. Configure:

| Setting | Value |
| --- | --- |
| `SOCIAL_INSTAGRAM_CLIENT_ID` | Instagram app ID |
| `SOCIAL_INSTAGRAM_CLIENT_SECRET` | Instagram app secret |
| `SOCIAL_INSTAGRAM_REDIRECT_URI` | `${PUBLIC_APP_URL}/api/v1/social/callback/instagram` |
| `SOCIAL_INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | A separate random secret for Meta's webhook challenge |
| `SOCIAL_INSTAGRAM_API_VERSION` | Pinned supported version, default `v25.0` |
| Meta webhook callback | `https://<public-api-host>/api/v1/social/webhooks/instagram` |
| Deauthorization callback | `https://<public-api-host>/api/v1/social/deauthorize/instagram` |
| Data deletion callback | `https://<public-api-host>/api/v1/social/data-deletion/instagram` |

The OAuth callback must use the same origin as `PUBLIC_APP_URL` because the frontend sets the browser-bound state cookie. The existing Next.js BFF forwards this callback to Nest. Deliver webhooks directly to the API host so the original signed body is preserved. Provide public HTTPS URLs or a development tunnel for Meta callbacks.

Requested scopes: `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`, and `instagram_business_manage_insights`. Configure the app's Instagram webhook `comments` subscription. Kachko also subscribes the connected account through `subscribed_apps`. External customer accounts require Meta approval/Advanced Access and a live app; app-role accounts can be used for development. Meta approval is an external step, not something the code can grant.

After configuring the app, connect Instagram in Kachko, sync its posts, create a rule, and comment from a different Instagram account. Verify the webhook receipt, one sent private reply, optional public reply, and the tracked destination link. Test an expired/revoked grant and account disconnect before launch.

### YouTube

Enable the YouTube Data API v3 and YouTube Analytics API in the Google project and configure an OAuth consent screen. Configure `SOCIAL_YOUTUBE_CLIENT_ID`, `SOCIAL_YOUTUBE_CLIENT_SECRET`, and `SOCIAL_YOUTUBE_REDIRECT_URI=${PUBLIC_APP_URL}/api/v1/social/callback/youtube`. These settings are separate from Google sign-in. The requested scopes are `youtube.readonly` and `yt-analytics.readonly` at their full Google scope URLs.

The authorization flow requests offline access with consent and PKCE. Store the client secret on the API. Add development test users or complete the Google verification steps appropriate to the consent-screen publishing status. Connect an account that owns a YouTube channel, then sync. Analytics respects provider reporting delays and hidden/rounded subscriber counts.

## Delivery and data behavior

Meta webhooks are verified over the exact raw request body using `X-Hub-Signature-256`. Only authenticated comment notifications enter the database inbox. `(accountId, commentId)` is unique in both the inbox and delivery tables; overlapping rules use the oldest matching active rule. Next-post rules bind to the first synced publication after the trigger was activated. Existing comments from before a rule was created are not retroactively messaged. Instagram Live comment replies are not included.

Workers poll the durable inbox every five seconds and recheck the owner, account, rule state, paid entitlement, seven-day comment window, and usage limit. Database claims and account-row locks coordinate replicas. Read failures retry up to five times with exponential backoff. Hourly-limited sends are deferred for five minutes so they cannot permanently occupy the due queue ahead of other accounts. Exhausted jobs become failed instead of remaining stranded. Shutdown waits for a running worker pass to finish.

A message send whose outcome is uncertain is recorded as `UNKNOWN` and never resent, preventing duplicate DMs after a timeout or process crash. Delivery history explains queued, skipped, failed, sent, and unconfirmed results without exposing message text, account credentials, or click tokens. A creator may manually retry a confirmed `FAILED` delivery inside its seven-day window after reconnecting/enabling the account and automation. Retrying reuses its saved message/destination, and an atomic update permits only one retry to be queued. The worker rechecks eligibility and quota again before sending. Replies already sent retain their tracked destination after the rule is deleted; disconnecting the social account removes its integration data.

`SOCIAL_DM_MONTHLY_LIMIT` defaults to 2,500 attempts per connected Instagram account per UTC calendar month. Sent, in-progress, and uncertain sends consume the quota; definite failures do not. A conservative 700 sends per hour is also enforced. A quota-blocked comment is skipped rather than silently sent in a later month. These are Kachko limits, adjustable without changing plan prices.

Private replies use Meta's documented single text-message format, including the configured label and clickable tracked URL. They do not guarantee Linktree-style rendered button cards. Follow-up conversational messages, inbox management, AI matching, and DM read receipts are not implemented. Kachko does not invent a “views” counter for DMs.

Background sync snapshots followers from the first successful connection onward; historical follower totals are not fabricated. Instagram's account view and reach totals cover the last 30 days, while media metrics are lifetime values for each synced post. Daily reach is not summed to estimate unique 30-day reach. Audience demographics may be absent for smaller accounts or restricted grants; they stay unavailable rather than zero. The current sync fetches the latest 50 media items (with view-insight enrichment for the latest 10 Instagram posts), so the posting heatmap describes synced content. TikTok, Facebook-page analytics, social publishing, and AI insights are not included in this release.

Data-deletion and deauthorization requests use Meta's signed-request HMAC verification. They delete the matching Instagram connection and cascade through its snapshots, media, rules, jobs, and deliveries. Deletion confirmation URLs contain no account identity. Comment text is cleared once processed; request logs omit bodies, cookies, query strings, and IPs.

Short-link reports count successful redirect requests, including bots or previews, rather than verified unique people. They store device class, source origin, and optional trusted geo headers, with no raw IP. QR codes point at the short URL; changing a custom alias preserves the previous URL/QR and reserves that alias against use by another creator. All aliases use the current destination, UTMs, and active status. Disable a short link to stop redirects through all its aliases immediately. UTM values explicitly set in the editor replace matching URL parameters; other query parameters and fragments are preserved. Clear a configured UTM to use the base destination's parameter again. Destinations are validated without fetching them; automated destination reputation scanning/custom domains are not implemented. Upstream outages return a retryable unavailable response.

Social media selection endpoints omit performance counters without `advanced_analytics`, so they cannot bypass the paid report gate. Hidden subscriber totals do not hide independent video/post counts. Media refreshes that do not include view insights preserve the last known view measurement instead of overwriting it with an unavailable value. Token refresh preserves the actual previously granted permissions.

Run `pnpm db:deploy` before starting the API. The additive migrations are `20261027010000_social_integrations`, `20261027020000_short_links`, and `20261027030000_social_delivery_and_short_aliases`.

## Research evidence and boundaries

REA performed declared browser navigations with temporary Chrome profiles. The authenticated admin shortener screen redirected to login; its private layout and APIs remain unobserved. Public documentation establishes the product behaviors below, not Linktree's private server implementation.

| Finding | Evidence | Coverage |
| --- | --- | --- |
| Admin shortener requires authentication | `ev_857586d50560ed8a1dfff4bba2ecccd14ce13c63f2f6da8dbe124991d1d79e49` | Observed login redirect; authenticated screen unknown |
| Connected platform analytics: followers, growth, posting frequency, locations/gender | `ev_b9cd820cdd6176511df6c71a428de60127d8714a5f3cfa70713bfd0ea07a6b52` | Observed public Linktree Insights guide |
| Meta private replies: comment ID, one reply, seven-day limit | `ev_0db1b11d9bdaa7d0ceb9169710e48120b7926e4fdaef5efd2546652da8690791` | Observed official Meta guide |
| Instagram OAuth and long-lived tokens | `ev_9ed32135c19b8e10f65f7e34f38942abbd69b73b0687f679499eed78b1708eb0` | Observed official Meta guide |
| Instagram professional insights availability and limitations | `ev_e9c9598a918d32be7ce38224ae7a9a3a16ac73805b426d6ed0e5d118ee3cabc2` | Observed official Meta guide |
| Modern insights metric types, including views totals | `ev_79552eff7109a5c599a76c314339e87915e0585c158f4049c8e2bfa3f0bd4abc` | Observed official Meta API reference |
| Generic template button support is documented for recipient IDs | `ev_2a5edf5f8f5004f0f25a99c527244378b7ded1a5f416e44bdcd5ada3a9f77c68` | Does not establish that comment-triggered private replies accept the same template |

Sources: [Linktree short links](https://linktr.ee/help/en/articles/8133719-create-tree-short-links), [Linktree shortener](https://linktr.ee/features/link-shortener), [Instagram auto-reply](https://linktr.ee/help/en/articles/9758234-set-up-instagram-auto-reply-linktree), [Linktree Insights](https://linktr.ee/help/en/articles/5434178-understanding-your-insights), [Meta private replies](https://developers.facebook.com/documentation/instagram-platform/private-replies), [Meta insights](https://developers.facebook.com/documentation/instagram-platform/insights), [Meta business login](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login), [YouTube channel API](https://developers.google.com/youtube/v3/docs/channels/list), [YouTube analytics](https://developers.google.com/youtube/analytics/reference/reports/query), [Google OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).

Live provider authorization, delivery, and account-specific permission/metric availability require configured credentials. Local tests stub external providers and use a disposable PostgreSQL database to verify queue behavior; they do not establish live Meta/Google access.
