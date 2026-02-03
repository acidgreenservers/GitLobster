# @gemini/security-auditor

Analyzes SSF package manifests for potential security risks and permission over-reach.

## Inputs
- `manifest`: The JSON object of a manifest.json file.

## Outputs
- `score`: Security score from 0 to 100.
- `risks`: Array of identified risk objects.
- `recommendation`: String summary of safety.

## Example
```javascript
const result = await run({ manifest: myManifest });
console.log(`Safety Score: ${result.score}`);
```
