# Unmasked Potential — Recording Delivery Page

Static page that delivers the 4-part audio recording from the Meta → Messenger → ManyChat funnel. Live at https://hadicee.netlify.app/.

## Where to edit

- **Page copy** (kicker, hook, intro, part descriptions): `public/index.html` — search for `EDIT-COPY`.
- **Skool link**: `public/index.html` — search for `skool-link`.
- **Audio files**: `public/audio/part-1-mapping.m4a` etc. Keep the same filenames to avoid touching the HTML.

## Tracking env vars (Netlify dashboard → Site settings → Environment variables)

| Var | Required? | Notes |
|---|---|---|
| `META_PIXEL_ID` | Yes for tracking | If unset, page is fully functional but no Pixel/CAPI events fire. |
| `META_CAPI_TOKEN` | Yes for CAPI | Already set on this site. |
| `META_TEST_EVENT_CODE` | Optional | When set, server events show up in Meta Events Manager → Test Events. |

Events wired:
- `PageView` — on load
- `ViewContent` — when the hook scrolls out
- `InitiateCheckout` — first `play` on any audio
- `Subscribe` — click on the Skool link

Each event uses a UUID `event_id` shared between client Pixel and server CAPI for dedup.

## Local dev

```
npx netlify dev
```

## Deploy

The Netlify site `free-recordings` (site_id `d99a416c-3d85-4fdc-9b88-190d6f5f9b34`, https://free-recordings.netlify.app/) is already created and has env vars set. To push a deploy:

```
NETLIFY_PAT=nfp_xxx SITE_ID=d99a416c-3d85-4fdc-9b88-190d6f5f9b34 node scripts/deploy.js
```

Or with the official CLI:

```
npx netlify deploy --prod --dir public --functions netlify/functions --site d99a416c-3d85-4fdc-9b88-190d6f5f9b34 --auth nfp_xxx
```
