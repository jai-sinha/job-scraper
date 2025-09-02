# Job Scraper

Automated web scraper that searches for common job sites for new entry-level SWE job postings in Munich and sends email notifications.

## Testing Scrapers

To test the individual scrapers without running the full application:

```bash
npm run test-scrapers
```

This will:
- Run both Google Careers and BMW scrapers
- Save results to `scraper-test-results.json`
- Display job counts and any errors in the console

The JSON file will contain:
- Timestamp of the test run
- Jobs found by each scraper
- Summary statistics
- Any errors that occurred

## Usage

```bash
# Start the scraper
npm start

# Development mode with auto-restart
npm run dev
```
