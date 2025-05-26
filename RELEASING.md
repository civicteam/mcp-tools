# Releasing Packages

This repository uses a tag-based release process. To release a package:

## For a specific package (e.g., hook-common)

1. Update the version in the package's `package.json`:
   ```bash
   cd packages/hook-common
   npm version patch  # or minor/major
   ```

2. Commit the version change:
   ```bash
   git add .
   git commit -m "chore: release hook-common v0.0.2"
   ```

3. Create a tag for the release:
   ```bash
   git tag v0.0.2-hook-common
   ```

4. Push the commit and tag:
   ```bash
   git push origin main
   git push origin v0.0.2-hook-common
   ```

The GitHub Actions workflow will automatically:
- Build the package
- Run tests
- Publish to npm with provenance
- Create a GitHub release

## For all packages

1. Update versions in all packages that need to be released
2. Create a tag without a package suffix:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

## Prerequisites

Make sure the repository has the following secrets configured:
- `NPM_PUBLISH_TOKEN`: An npm access token with publish permissions for the @civic scope