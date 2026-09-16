# MyjantesProApp

MyJantes mobile application prepared for the unified Apple and Android application identity.

## Release identity

- iOS Bundle ID: `fr.myjantespro.app`
- Android package: `fr.myjantespro.app`
- Apple Team ID: `GP593F562X`
- App Store Connect App ID: `6795747282`
- Expo project ID: `b25f4647-ef2a-4fbc-8575-6730adc71841`
- Version: `3.0.0`
- Current iOS build: `11`

## Workspace

The repository contains the Expo mobile app under `artifacts/myjantes` and the generated API client under `lib/api-client-react`.

```bash
pnpm install
pnpm run validate
pnpm run typecheck
```

Generated native folders and local caches are intentionally excluded. Replit Expo Launch generates the native project from the checked-in Expo configuration.

Do not commit API keys, Apple private keys, provisioning profiles, `.env` files, or generated native/cache directories.
