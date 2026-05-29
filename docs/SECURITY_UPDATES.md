# Security Updates Checklist

This checklist tracks the security work needed to make InStudy 2.0 safer for deployment.

## First Batch

- [x] Replace hardcoded default admin credentials with environment-based bootstrap admin creation.
- [x] Add production secret validation so deployment fails when unsafe default secrets are used.
- [x] Make CORS origins configurable through `FRONTEND_ORIGINS`.
- [x] Disable public API docs/OpenAPI when `APP_ENV=production`.
- [x] Remove query-string token support from backend authentication.
- [x] Remove frontend token-in-URL usage for document and thumbnail previews.
- [x] Add safe path validation helpers for user upload and vector-store paths.
- [x] Apply safe path handling to document access, uploads, and admin delete actions.
- [x] Replace several raw backend exception responses with generic client-safe messages.

## Next Batch

- [ ] Add auth rate limiting for login and registration.
- [ ] Add universal upload limits before tier-based quotas exist.
- [ ] Add MIME/content sniffing for uploads, not only extension checks.
- [ ] Add admin audit logs for role changes and destructive actions.
- [ ] Move auth from `localStorage` bearer tokens to secure cookie-based sessions.
- [ ] Add CSRF protection if cookie-based auth is enabled.
- [ ] Replace custom password hashing with Argon2id or bcrypt through a maintained library.
- [ ] Review `FAISS.load_local(... allow_dangerous_deserialization=True)` and document the trust boundary.

## Later Business/Tier Work

- [ ] Create subscription plan model: free, plus, ultra, enterprise.
- [ ] Enforce plan-specific quotas server-side.
- [ ] Add admin plan switcher for testing and support.
- [ ] Seed test users for each plan in development only.
- [ ] Add fair-use limits for high-tier plans instead of true unlimited processing.

## Production Environment Required Values

- `APP_ENV=production`
- `ENCRYPTION_KEY=<unique-random-secret-at-least-32-characters>`
- `FRONTEND_ORIGINS=https://your-frontend-domain.com`
- `BOOTSTRAP_ADMIN_EMAIL=<first-admin-email>` only when creating the first admin
- `BOOTSTRAP_ADMIN_PASSWORD=<strong-temporary-password>` only when creating the first admin

After the first admin exists, remove the bootstrap admin password from the hosting environment.
