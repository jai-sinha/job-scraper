import dotenv from 'dotenv';
import cron from 'node-cron';
import { initializeDatabase } from './database/db.js';
import { runScraping } from './scrapers/index.js';
import { sendJobNotifications } from './email/mailer.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

async function main() {
  try {
    logger.info('🚀 Starting job scraper...');
    
    // Initialize database
    await initializeDatabase();
    
    // Run initial scraping
    await scrapeAndNotify();
    
    // Schedule scraping every 12 hours
    const interval = process.env.SCRAPE_INTERVAL_HOURS || 12;
    cron.schedule(`0 */${interval} * * *`, async () => {
      logger.info('🕐 Scheduled scraping started...');
      await scrapeAndNotify();
    });
    
    logger.info(`⏰ Scheduled to run every ${interval} hours`);
    logger.info('✅ Job scraper is running. Press Ctrl+C to stop.');
    
  } catch (error) {
    logger.error('❌ Failed to start job scraper:', error);
    process.exit(1);
  }
}

async function scrapeAndNotify() {
  try {
    const newJobs = await runScraping();
    
    if (newJobs.length > 0) {
      logger.info(`📧 Found ${newJobs.length} new jobs, sending notifications...`);
      await sendJobNotifications(newJobs);
    } else {
      logger.info('😴 No new jobs found');
    }
  } catch (error) {
    logger.error('❌ Error during scraping and notification:', error);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down job scraper...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down job scraper...');
  process.exit(0);
});

// Start the application
main();
