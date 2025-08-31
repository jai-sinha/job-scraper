import { chromium } from 'playwright';
import { saveJob, getJobByUrl } from '../database/db.js';
import { logger } from '../utils/logger.js';
import { scrapeGoogleCareers } from './google-careers.js';
import { scrapeGlassdoor } from './glassdoor.js';
import { scrapeIndeed } from './indeed.js';
import { scrapeLinkedIn } from './linkedin.js';
import { scrapeStepStone } from './stepstone.js';

const REQUEST_DELAY = parseInt(process.env.REQUEST_DELAY_MS) || 2000;

export async function runScraping() {
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const newJobs = [];
  
  try {
    logger.info('🔍 Starting job scraping...');
    
    // Scrape Google Careers (working reliably)
    try {
      const googleJobs = await scrapeGoogleCareers(browser);
      const newGoogleJobs = await processJobs(googleJobs, 'Google Careers');
      newJobs.push(...newGoogleJobs);
      await delay(REQUEST_DELAY);
    } catch (error) {
      logger.error('❌ Error scraping Google Careers:', error);
    }
    
    // Scrape Glassdoor (working)
    try {
      const glassdoorJobs = await scrapeGlassdoor(browser);
      const newGlassdoorJobs = await processJobs(glassdoorJobs, 'Glassdoor');
      newJobs.push(...newGlassdoorJobs);
      await delay(REQUEST_DELAY);
    } catch (error) {
      logger.error('❌ Error scraping Glassdoor:', error);
    }
    
    // Scrape LinkedIn
    try {
      const linkedinJobs = await scrapeLinkedIn(browser);
      const newLinkedinJobs = await processJobs(linkedinJobs, 'LinkedIn');
      newJobs.push(...newLinkedinJobs);
      await delay(REQUEST_DELAY);
    } catch (error) {
      logger.error('❌ Error scraping LinkedIn:', error);
    }
    
    // Scrape StepStone (popular in Germany)
    try {
      const stepstoneJobs = await scrapeStepStone(browser);
      const newStepstoneJobs = await processJobs(stepstoneJobs, 'StepStone');
      newJobs.push(...newStepstoneJobs);
      await delay(REQUEST_DELAY);
    } catch (error) {
      logger.error('❌ Error scraping StepStone:', error);
    }
    
    // TODO: Re-enable Indeed once we improve its detection avoidance
    // Scrape Indeed
    // try {
    //   const indeedJobs = await scrapeIndeed(browser);
    //   const newIndeedJobs = await processJobs(indeedJobs, 'Indeed');
    //   newJobs.push(...newIndeedJobs);
    //   await delay(REQUEST_DELAY);
    // } catch (error) {
    //   logger.error('❌ Error scraping Indeed:', error);
    // }
    
    logger.info(`✅ Scraping completed. Found ${newJobs.length} new jobs`);
    
  } finally {
    await browser.close();
  }
  
  return newJobs;
}

async function processJobs(jobs, source) {
  const newJobs = [];
  
  for (const job of jobs) {
    try {
      // Check if job already exists
      const existingJob = await getJobByUrl(job.url);
      
      if (!existingJob) {
        // Save new job
        const wasInserted = await saveJob({ ...job, source });
        
        if (wasInserted) {
          newJobs.push({ ...job, source });
          logger.info(`📝 New job saved: ${job.title} at ${job.company}`);
        }
      }
    } catch (error) {
      logger.error('❌ Error processing job:', error);
    }
  }
  
  return newJobs;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
