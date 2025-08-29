# Job Scraper

Automated web scraper that searches for common job sites for new entry-level SWE job postings in Munich and sends email notifications.

## Features

- Scrapes Google Careers and Glassdoor for entry-level SWE positions
- SQLite database to track seen jobs and prevent duplicates
- Email notifications for new job postings
- Runs automatically every 12 hours
- Configurable search criteria

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

3. Create a `.env` file with your configuration:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-app-password
   EMAIL_TO=recipient@gmail.com
   SEARCH_LOCATION=Munich
   SEARCH_KEYWORDS=software engineer,developer,frontend,backend
   ```

4. Run the scraper:
   ```bash
   npm start
   ```

## Project Structure

- `src/index.js` - Main entry point and scheduler
- `src/scrapers/` - Individual site scrapers
- `src/database/` - SQLite database operations
- `src/email/` - Email notification system
- `src/config/` - Configuration management
- `data/` - SQLite database storage
