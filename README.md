# GoatCounter dashboard

A self-hosted, read-only analytics dashboard for hosted [GoatCounter](https://www.goatcounter.com). A static React page plus an nginx proxy that adds the API key on the server, so the browser never sees it.

## Features

- KPI row with period-over-period change, traffic area chart with previous-period overlay
- Top pages with lazy-loaded per-row sparklines
- Referrers and campaigns, weekday by hour heatmap, world choropleth
- Browsers, operating systems, devices, languages, countries
- Ranges: Today, 7d, 30d, 90d, custom (up to 366 days); dark by default, light via system preference with a persisted toggle
- Demo mode with generated sample data

## Setup

1. In GoatCounter, open Settings > API and create a key with only "Read statistics" enabled.
2. Copy the config and fill it in:

   ```sh
   cp .env.example .env
   ```

   | Variable | Meaning |
   |---|---|
   | `GOATCOUNTER_HOST` | Your site host, for example `your-site.goatcounter.com`. No `https://` and no trailing slash |
   | `GOATCOUNTER_API_KEY` | The read-only key |
   | `PORT` | Host port, default `8090` |
   | `BIND_ADDRESS` | Interface to listen on, default `127.0.0.1`. Set it to a LAN or VPN address to reach the dashboard from other devices |
| `SITE_NAME` | Optional name shown in the page header and tab title, for example `Acme` gives "Acme Analytics" |
| `SITE_URL` | Optional link to your GoatCounter page. Defaults to `https://$GOATCOUNTER_HOST` |

3. Start it:

   ```sh
   docker compose up -d
   ```

4. Open `http://127.0.0.1:8090`, or the address you set in `BIND_ADDRESS`.

Docker Compose refuses to start if the host or key is missing. `.env` is gitignored.

## Demo mode

Open `/?demo=1` or press the Demo button. All data is generated in the browser and no API requests are made. To try it without Docker:

```sh
python3 -m http.server 8080
```

then open `http://localhost:8080/?demo=1`. Page scripts still load from unpkg.

## How it works

- `nginx.conf.template` is rendered by the official nginx image (envsubst on `/etc/nginx/templates`). `/api/` is proxied to `https://$GOATCOUNTER_HOST/api/` with `Authorization: Bearer <key>`, SNI, a matching Host header and certificate verification. Only `GET` is allowed and browser headers and cookies are not forwarded.
- The front end is `index.html` plus `assets/app.jsx`, compiled in the browser by Babel Standalone. No build step. Libraries load from unpkg at pinned versions with SRI hashes: React 18.3.1, ReactDOM 18.3.1, prop-types 15.8.1, Recharts 2.15.4, Babel Standalone 7.26.10.
- API calls go through one sequential queue with a 500 ms gap, a 60 second in-memory cache, and retry on HTTP 429 (honoring `X-Rate-Limit-Reset`). GoatCounter allows 4 requests per second.
- Endpoints used: `stats/total`, `stats/hits`, `stats/toprefs`, `stats/campaigns`, `stats/locations`, `stats/browsers`, `stats/systems`, `stats/sizes`, `stats/languages`.
- The heatmap and traffic chart come from the `hourly` and `daily` arrays in `stats/total`. Weekday columns average each weekday's occurrences in the range. If hourly data is missing, the card falls back to weekday totals.
- Sparklines call `stats/hits` with `include_paths` per row once the row is visible.
- `assets/world-map.js` holds simplified country paths generated from Natural Earth 110m (public domain), Natural Earth projection, no runtime dependency. Countries are matched by ISO code, then by name.

## Limitations

- The API exposes visitor counts, not a separate pageview counter, so KPIs show visitors.
- Breakdown percentages are shares of the rows returned, not of all visitors.
- Territories too small for the 110m map appear only in the list.
- Date ranges are sent as UTC day boundaries.

## Security

The proxy serves statistics to anyone who can reach the port, with no authentication. It listens on `127.0.0.1` by default. To use it from other devices, bind it to a private network address such as a VPN or mesh, or put an authenticating reverse proxy in front. Do not expose it to the internet. Use a read-only key. See [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
