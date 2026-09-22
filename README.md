# MyJantes Pro

Mobile application configured for the App Store Connect app shown in the project release settings.

## Release identity

- iOS Bundle ID: `com.myjantes.pro`
- Android package: `com.myjantes.pro`
- Apple Team ID: `GP593F562X`
- App Store Connect App ID: `6812158864`
- Expo project ID: `b25f4647-ef2a-4fbc-8575-6730adc71841`
- Version: `3.0.0`
- Current iOS build: `12`

## Workspace

The Expo mobile app is under `artifacts/myjantes`; the generated API client is under `lib/api-client-react`.

```bash
pnpm install
pnpm run validate
pnpm run typecheck
```

The native `ios/` and `android/` folders and local caches are intentionally excluded. Replit Expo Launch regenerates the native project and submits the iOS build.
