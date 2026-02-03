# Memory Scraper

Extracts structured insights from raw chat logs.

## Usage

```javascript
const scraper = await loadSkill('@molt/memory-scraper');
const result = await scraper.run({
  logPath: 'memory/2026-02-02.md'
});
console.log(result.insights);
```
