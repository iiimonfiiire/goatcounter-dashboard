# Security

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: the **Security** tab of this repository, then **Report a vulnerability**. Please keep security problems out of public issues.

## Threat model

The dashboard is a static page plus an nginx proxy that holds a read-only GoatCounter API key.

- **The proxy has no login.** Anyone who can reach the port can read your statistics through it. By default Docker Compose binds it to `127.0.0.1` only.
- **The key stays on the server.** The browser never receives it. Create the key with only "Read statistics" enabled.
- **Only `GET` is proxied**, and browser headers and cookies are not forwarded.
- **Scripts load from unpkg** at pinned versions with SRI hashes.

To reach the dashboard from other devices, use a private network such as a VPN or mesh, or put an authenticating reverse proxy in front. Never forward the port to the internet.
