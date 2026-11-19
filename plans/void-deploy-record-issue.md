# Cloudflare deploy: the record Void keeps in a version's message is cut at 1000 characters, and the next deploy refuses

## What happens

`void deploy --platform cloudflare` stopped with:

```
deploy: the existing Worker has dashboard-managed routes or visibility that Void cannot safely republish.
Add its current routes, workers_dev, and preview_urls values to the root Cloudflare config, then retry; no version was uploaded.
```

Nothing on the Worker had changed outside Void: `workers_dev` and `preview_urls` were on, with no routes, exactly as Void's previous deploy had set them.

## Why

Void keeps its deploy record in the Worker version's `workers/message` annotation: `void:` and a JSON object with every migration's name and the trigger config (`encodeCloudflareVersionMessage`, `@void/deploy-cloudflare`). Cloudflare keeps 1000 characters of that message. On our Worker:

- version 105 (12 migrations): its message is 959 characters, complete;
- version 106 (13 migrations, and retry settings on two queues): its message is exactly 1000 characters and ends `{"queue":"voi...`.

The next deploy reads the active version's record, can't parse it, so it has no previous trigger config; with `routes` not in the config, `resolvePreservedTraffic` returns null and the deploy stops with `traffic-preservation-unavailable`. The message points at the dashboard, which isn't the cause.

Any app gets here once its migrations and queues make the record longer than 1000 characters: each new migration adds its name.

## Workaround

Stating all three in `void.config.ts`'s `cloudflare` (`workers_dev`, `preview_urls`, `routes: []`), so nothing has to come from the record.

## What would help

Keep the record within Cloudflare's limit (for example a hash of the migration list, or the record in a binding or KV rather than the message), or fall back to reading the Worker's current settings from Cloudflare's API when the record can't be read, with a message that says the record was unreadable.

Void 1.8.0; `@void/deploy-cloudflare` 1.11.0 writes the same record (`encodeCloudflareVersionMessage`, checked 2026-11-19).
