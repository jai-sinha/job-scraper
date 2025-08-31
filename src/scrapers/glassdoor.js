import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeGlassdoor(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping Glassdoor...');
    
    // Basic stealth setup
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    // Navigate to Munich software engineer jobs
    const searchUrl = `https://www.glassdoor.de/Job/munich-software-engineer-jobs-SRCH_IL.0,6_IC4990924_KO7,24.htm?includeNoSalaryJobs=true`;
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    
    // Handle cookie banner
    try {
      await page.waitForTimeout(3000);
      const cookieButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept")').first();
      if (await cookieButton.isVisible({ timeout: 3000 })) {
        await cookieButton.click();
        logger.info('✅ Accepted cookies');
      }
    } catch (error) {
      // Ignore cookie banner errors
    }
    
    // Wait for job listings
    const jobListXPath = '//li[contains(@class, "JobsList_jobListItem")]';
    await page.waitForSelector(`xpath=${jobListXPath}`, { timeout: 10000 });
    
    const jobElements = await page.locator(`xpath=${jobListXPath}`).all();
    logger.info(`Found ${jobElements.length} job elements`);
    
    for (let i = 0; i < Math.min(jobElements.length, 15); i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title and URL
        const titleElement = element.locator(`xpath=.//a[contains(@class, "JobCard_jobTitle")]`).first();
        if (!(await titleElement.isVisible({ timeout: 1000 }))) continue;
        
        const title = await titleElement.textContent();
        const href = await titleElement.getAttribute('href');
        
        if (!title?.trim() || !href) continue;
        
        // Check if title is relevant
        const titleLower = title.toLowerCase();
        const hasRelevantKeyword = SEARCH_KEYWORDS.some(keyword => 
          titleLower.includes(keyword.toLowerCase())
        ) || titleLower.includes('developer') || titleLower.includes('engineer') || titleLower.includes('software');
        
        if (!hasRelevantKeyword) continue;
        
        // Extract company name
        let company = 'Unknown Company';
        const companyElement = element.locator(`xpath=.//span[contains(@class, "EmployerProfile_compactEmployerName")]`).first();
        if (await companyElement.isVisible({ timeout: 1000 })) {
          const companyText = await companyElement.textContent();
          if (companyText?.trim() && companyText.length > 2 && companyText.length < 100) {
            company = companyText.trim();
          }
        }
        
        // Extract location
        let location = SEARCH_LOCATION;
        const locationElement = element.locator(`xpath=.//div[contains(@class, "JobCard_location")]`).first();
        if (await locationElement.isVisible({ timeout: 1000 })) {
          const locationText = await locationElement.textContent();
          if (locationText?.trim()) {
            location = locationText.trim();
          }
        }
        
        // Filter for Munich-only jobs
        const locationLower = location.toLowerCase();
        if (!locationLower.includes('munich') && !locationLower.includes('münchen') && 
            !locationLower.includes('deutschland') && locationLower.includes('berlin')) {
          continue;
        }
        
        const jobUrl = href.startsWith('http') ? href : `https://www.glassdoor.de${href}`;
        
        const job = {
          title: title.trim(),
          company: company,
          location: location,
          url: jobUrl,
          description: '',
          postedDate: new Date().toISOString().split('T')[0]
        };
        
        jobs.push(job);
        
      } catch (error) {
        logger.warn('Error extracting job:', error.message);
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from Glassdoor`);
    
  } catch (error) {
    logger.error('❌ Error scraping Glassdoor:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
