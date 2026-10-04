# ReleasePilot

## Demo/Test Data

For development and testing purposes, you can quickly seed and reset demo data.

- `npm run demo:seed` (run in `server/`) - Seeds the database with demo releases (identified by a `DEMO ` title prefix).
- `npm run demo:reset` (run in `server/`) - Safely deletes all demo releases and their associated items, statements, evidence, and analyses.

**Note:**
- These commands are strictly development and testing utilities.
- Demo releases are identified purely by the `DEMO ` title prefix.
- The reset command **does not** affect normal (non-demo) releases in any way.
- There is intentionally no "Delete" or "Reset" button in the product UI to prevent accidental data loss.
