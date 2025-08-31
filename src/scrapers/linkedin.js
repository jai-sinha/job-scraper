import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeLinkedIn(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping LinkedIn...');
    
    // Basic stealth setup
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Build LinkedIn Jobs URL with entry level and past week filters
    const searchTerm = encodeURIComponent(SEARCH_KEYWORDS[0]);
    const searchUrl = `https://www.linkedin.com/jobs/search/?distance=25&f_E=2&f_TPR=r604800&f_WT=1%2C3&geoId=100477049&keywords=${searchTerm}&origin=JOBS_HOME_KEYWORD_HISTORY&refresh=true`;
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 5000 
    });
    
    await page.waitForTimeout(2000);
    
    // Check for sign-in requirement
    if (await page.locator('text=/sign in/i').count() > 0) {
      logger.warn('LinkedIn requires sign-in, trying guest access...');
    }
    
    // Wait for job listings
    const jobSelectors = ['.job-search-card', '.base-search-card'];
    
    let foundSelector = null;
    for (const selector of jobSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundSelector = selector;
        logger.info(`Found LinkedIn job listings using selector: ${selector}`);
        break;
      } catch (error) {
        continue;
      }
    }
    
    if (!foundSelector) {
      logger.warn('Could not find job listings on LinkedIn');
      return jobs;
    }
    
    // Extract job listings
    let jobElements = await page.locator('.job-search-card').all();
    logger.info(`Found ${jobElements.length} job elements on LinkedIn`);
    
    if (jobElements.length === 0) {
      logger.warn('No job listings found on LinkedIn');
      return jobs;
    }
    
    // Try to load more jobs with simple scroll and click
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
      
      const showMoreButton = page.locator('button:has-text("Show more"), .infinite-scroller__show-more-button').first();
      if (await showMoreButton.count() > 0 && await showMoreButton.isVisible({ timeout: 2000 })) {
        await showMoreButton.click({ timeout: 3000 });
        await page.waitForTimeout(2000);
        
        const moreJobElements = await page.locator('.job-search-card').all();
        if (moreJobElements.length > jobElements.length) {
          jobElements = moreJobElements;
          logger.info(`Loaded ${jobElements.length} total jobs after pagination`);
        }
      }
    } catch (error) {
      // Ignore pagination errors
    }
    
    // Process job elements
    for (let i = 0; i < Math.min(jobElements.length, 50); i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title
        const titleElement = element.locator('h3.base-search-card__title');
        const title = await titleElement.textContent().catch(() => '');
        if (!title?.trim()) continue;
        
        // Check if title contains relevant keywords
        const titleLower = title.toLowerCase();
        const hasRelevantKeyword = SEARCH_KEYWORDS.some(keyword => 
          titleLower.includes(keyword.toLowerCase())
        ) || titleLower.includes('developer') || titleLower.includes('engineer') || 
           titleLower.includes('software') || titleLower.includes('frontend') || 
           titleLower.includes('backend') || titleLower.includes('fullstack') || 
           titleLower.includes('entwickler');
        
        if (!hasRelevantKeyword) continue;
        
        // Extract company
        const companyElement = element.locator('h4.base-search-card__subtitle a.hidden-nested-link');
        const company = await companyElement.textContent().catch(() => 'Unknown Company');
        
        // Extract location
        const locationElement = element.locator('.job-search-card__location');
        const location = await locationElement.textContent().catch(() => '');
        
        // Extract URL
        const linkElement = element.locator('.base-card__full-link');
        const href = await linkElement.getAttribute('href').catch(() => '');
        if (!href) continue;
        
        const jobUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
        
        // Filter by location - Munich area only
        const locationLower = location.toLowerCase();
        const isMunichJob = locationLower.includes('munich') || 
                           locationLower.includes('münchen') || 
                           locationLower.includes('bavaria') ||
                           locationLower.includes('garching') ||
                           locationLower.includes('hybrid') ||
                           locationLower.includes('remote');
        
        if (!isMunichJob && location) continue;
        
        // Extract job ID from URL
        const jobId = href.match(/\/view\/[^-]+-(\d+)/)?.[1];
        
        jobs.push({
          title: title.trim(),
          company: company.trim(),
          location: location.trim() || SEARCH_LOCATION,
          url: jobUrl,
          description: '',
          postedDate: new Date().toISOString().split('T')[0],
          source: 'LinkedIn',
          jobId: jobId
        });
        
      } catch (error) {
        // Silently skip failed extractions
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from LinkedIn`);
    
  } catch (error) {
    logger.error('❌ Error scraping LinkedIn:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
