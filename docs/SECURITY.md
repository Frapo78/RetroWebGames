# RWG publication security

RetroWebGames is a static public site plus a narrow leaderboard API. The
canonical public origin is `https://www.retrowebgames.it/`; the leaderboard
listens only on `127.0.0.1:3112` and is exposed solely through the matching
Nginx location.

## Runtime boundary

`/projects/RWG` is a deploy working copy and is intentionally writable by the
deployment workflow. The leaderboard service must never execute code there.
`ops/install-rwg-leaderboards.sh` installs dependencies, stages a copy at
`/var/lib/rwg-leaderboard/app.next.<timestamp>`, changes it to
`root:site_rwg`, switches it only after the previous runtime is retained for
rollback, and validates loopback health before removing that previous copy.

The systemd unit preserves `NoNewPrivileges`, private `/tmp`, read-only system
areas and other compatible sandboxing. Do not add `MemoryDenyWriteExecute`:
Node/V8 requires executable JIT memory and fails before binding the API.

## HTTP/API boundary

- HTTP and the legacy port redirect to canonical HTTPS.
- Nginx denies dotfiles and the public webroot contains no server source,
  secrets or package manifests.
- Browser pages use a restrictive CSP, HSTS, MIME sniffing protection,
  referrer policy, anti-framing and a narrow Permissions-Policy that preserves
  only the first-party motion sensors needed by Neon Tilt.
- The API has no permissive CORS policy, accepts JSON posts only from the exact
  canonical Origin, applies body-size and IP-based rate limits, and returns
  `Cache-Control: no-store`.
- The anonymous leaderboard cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
  It is a convenience identity, not proof against score manipulation.

## Verification

Run `node scripts/validate-security.mjs` and
`node scripts/validate-contracts.mjs`. The root installer additionally checks
the local health endpoint, Nginx syntax and public HTTPS health after reload.

The authoritative domain vhost is maintained at
`/projects/VPS/retrowebgames-domain/retrowebgames.it.conf`; apply it only with
`sudo bash /projects/VPS/enable-retrowebgames-domain.sh`, which makes a backup
and rolls back failed Nginx changes.
