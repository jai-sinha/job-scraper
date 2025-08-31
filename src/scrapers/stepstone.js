import { logger } from '../utils/logger.js';

const SEARCH_LOCATION = process.env.SEARCH_LOCATION || 'Munich';
const SEARCH_KEYWORDS = (process.env.SEARCH_KEYWORDS || 'software engineer').split(',');

export async function scrapeStepStone(browser) {
  const page = await browser.newPage();
  const jobs = [];
  
  try {
    logger.info('🔍 Scraping StepStone...');
    
    // Set headers
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    });
    
    await page.setViewportSize({ width: 1366, height: 768 });
    
    // Use the provided StepStone URL for computer science jobs in Munich
    const searchUrl = 'https://www.stepstone.de/jobs/computer-science/in-münchen';
    
    await page.waitForTimeout(Math.random() * 1000 + 500);
    
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 5000 
    });
    
    // Handle cookie banner
    try {
      await page.waitForTimeout(1500);
      const cookieSelectors = [
        'button:has-text("Alle akzeptieren")',
        'button:has-text("Accept all")',
        '[data-testid="cookie-accept-all"]',
        '#ccmgt_explicit_accept',
        'button[id*="accept"]'
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            await button.click();
            await page.waitForTimeout(1000);
            logger.info('✅ Accepted cookies on StepStone');
            break;
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      // Ignore cookie banner errors
    }
    
    // Wait for job listings
    const jobSelectors = [
      '[data-testid="job-item"]',
      '.listing-item',
      '[data-testid*="job"]',
      '.job-element'
    ];
    
    let foundSelector = null;
    for (const selector of jobSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 3000 });
        foundSelector = selector;
        logger.info(`Found StepStone job listings using selector: ${selector}`);
        break;
      } catch (error) {
        logger.warn(`Selector ${selector} not found, trying next...`);
      }
    }
    
    if (!foundSelector) {
      logger.warn('Could not find job listings on StepStone');
      return jobs;
    }
    
    // Extract job listings
    let jobElements = [];
    for (const selector of jobSelectors) {
      try {
        jobElements = await page.locator(selector).all();
        if (jobElements.length > 0) {
          logger.info(`Found ${jobElements.length} job elements on StepStone`);
          break;
        }
      } catch (error) {
        continue;
      }
    }
    
    if (jobElements.length === 0) {
      logger.warn('No job listings found on StepStone');
      return jobs;
    }
    
    // Process job elements
    for (let i = 0; i < Math.min(jobElements.length, 20); i++) {
      try {
        const element = jobElements[i];
        
        // Extract job title
        const titleSelectors = [
          'h2 a',
          '[data-testid="job-title"] a',
          '.listing-title a',
          'h3 a'
        ];
        
        let title = '';
        let jobUrl = '';
        for (const selector of titleSelectors) {
          try {
            const titleElement = element.locator(selector).first();
            if (await titleElement.isVisible({ timeout: 1000 })) {
              title = await titleElement.textContent();
              const href = await titleElement.getAttribute('href');
              if (href) {
                jobUrl = href.startsWith('http') ? href : `https://www.stepstone.de${href}`;
              }
              if (title && title.trim()) {
                title = title.trim();
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!title) continue;
        
        // Check if title contains relevant keywords
        const titleLower = title.toLowerCase();
        const hasRelevantKeyword = SEARCH_KEYWORDS.some(keyword => 
          titleLower.includes(keyword.toLowerCase())
        ) || titleLower.includes('developer') || titleLower.includes('engineer') || 
           titleLower.includes('software') || titleLower.includes('entwickler');
        
        if (!hasRelevantKeyword) continue;
        
        // Extract company name - use stable selectors
        const companySelectors = [
          '[data-at="job-item-company-name"]', // Most stable - data attribute
          '[data-testid="company-name"]',
          'a[href*="/cmp/"] img[alt]', // Company logo alt text
          'a[href*="/cmp/"]', // Company profile link
          // Fallback to text content patterns
          'span:has-text("GmbH")',
          'span:has-text("AG")',
          'span:has-text("Inc")',
          'span:has-text("Ltd")',
          'span:has-text("SE")'
        ];
        
        let company = '';
        for (const selector of companySelectors) {
          try {
            if (selector.includes('img[alt]')) {
              // Extract from image alt text
              const imgElement = element.locator(selector).first();
              if (await imgElement.isVisible({ timeout: 1000 })) {
                const altText = await imgElement.getAttribute('alt');
                if (altText && altText.trim()) {
                  company = altText.trim();
                  break;
                }
              }
            } else {
              const companyElement = element.locator(selector).first();
              if (await companyElement.isVisible({ timeout: 1000 })) {
                company = await companyElement.textContent();
                if (company && company.trim()) {
                  company = company.trim();
                  // Clean up company name - remove extra text after company name
                  const cleanCompany = company.split('\n')[0].trim();
                  if (cleanCompany) {
                    company = cleanCompany;
                    break;
                  }
                }
              }
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!company) company = 'Unknown Company';
        
        // Extract location
        const locationSelectors = [
          '[data-testid="job-location"]',
          '.listing-location',
          '.location'
        ];
        
        let location = '';
        for (const selector of locationSelectors) {
          try {
            const locationElement = element.locator(selector).first();
            if (await locationElement.isVisible({ timeout: 1000 })) {
              location = await locationElement.textContent();
              if (location && location.trim()) {
                location = location.trim();
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
        
        if (!jobUrl) continue;
        
        const job = {
          title: title,
          company: company,
          location: location || SEARCH_LOCATION,
          url: jobUrl,
          description: '',
          postedDate: new Date().toISOString().split('T')[0]
        };
        
        jobs.push(job);
        
      } catch (error) {
        logger.warn('Error extracting job from StepStone element:', error.message);
      }
    }
    
    logger.info(`📊 Found ${jobs.length} relevant jobs from StepStone`);
    
  } catch (error) {
    logger.error('❌ Error scraping StepStone:', error);
  } finally {
    await page.close();
  }
  
  return jobs;
}
