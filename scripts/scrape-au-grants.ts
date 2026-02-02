/**
 * Australian Grants Scraper using Puppeteer
 * Bypasses CloudFront protection by using a real browser
 *
 * Run with: npx ts-node scripts/scrape-au-grants.ts
 */

import puppeteer, { Browser } from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface ScrapedGrant {
  title: string;
  agency: string;
  closeDate: string;
  status: string;
  url: string;
  goNumber: string;
  // Detailed fields (fetched from individual grant pages)
  description?: string;
  eligibility?: string;
  fundingMin?: number;
  fundingMax?: number;
  openDate?: string;
  categories?: string[];
}

// Scrape detailed info from a single grant page
async function scrapeGrantDetails(browser: Browser, grant: ScrapedGrant): Promise<ScrapedGrant> {
  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(grant.url, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Save debug screenshot for first grant
    if (grant.goNumber === 'GO8070' || !grant.description) {
      await page.screenshot({ path: 'debug-grant-detail.png', fullPage: true });
    }

    const details = await page.evaluate(() => {
      // Get full page text for searching
      const pageText = document.body?.innerText || '';

      // Titles to skip (navigation/UI elements and status labels)
      const skipTitles = [
        'navigation menus', 'navigation menu', 'skip to', 'main menu',
        'search', 'home', 'login', 'register', 'contact us', 'about us',
        'current grant opportunity view', 'grant opportunity',
        'open competitive', 'closed competitive', 'open non-competitive',
        'closed non-competitive', 'open', 'closed', 'competitive', 'non-competitive',
        'restricted', 'open restricted', 'closed restricted',
        'to view the grant', 'please select', 'grant opportunity documents',
        'click here', 'download', 'view documents', 'select the red',
        'important notice', 'warning', 'note:'
      ];

      const isValidTitle = (text: string): boolean => {
        if (!text || text.length < 20 || text.length > 250) return false;
        const lower = text.toLowerCase().trim();
        // Skip navigation/generic text
        for (const skip of skipTitles) {
          if (lower === skip || lower.startsWith(skip) || lower.includes(skip)) return false;
        }
        // Skip exact matches to status labels
        if (/^(open|closed)\s*(competitive|non-competitive|restricted)?$/i.test(text)) return false;
        // Skip if it starts with GO number pattern
        if (/^GO\d+/.test(text)) return false;
        // Skip if it's just a category or type
        if (/^(category|type|status|selection process):/i.test(text)) return false;
        // Skip website UI instructions
        if (/please (select|click|view|download)/i.test(text)) return false;
        if (/^to (view|access|download|see|read)/i.test(text)) return false;
        // Must have at least 3 words
        const words = text.split(/\s+/).filter(w => w.length > 2);
        if (words.length < 3) return false;
        // Must have actual meaningful content
        if (!/[a-zA-Z]{4,}/.test(text)) return false;
        return true;
      };

      // Extract grant title
      let title = '';

      // Method 1: Look for GO number header with title
      // GrantConnect pages often have format "GO12345 - Grant Title"
      const goTitleMatch = pageText.match(/GO\d+\s*[-–]\s*([^\n]+)/);
      if (goTitleMatch && isValidTitle(goTitleMatch[1])) {
        title = goTitleMatch[1].trim();
      }

      // Method 2: Look for text labeled as "Grant name" or similar
      if (!title) {
        const nameMatch = pageText.match(/(?:Grant\s+(?:name|title)|Opportunity\s+name)[:\s]*([^\n]+)/i);
        if (nameMatch && isValidTitle(nameMatch[1])) {
          title = nameMatch[1].trim();
        }
      }

      // Method 3: Look for the description's first sentence as context
      // Often the grant title appears right before or in the description
      if (!title) {
        const descMatch = pageText.match(/Description:\s*([^\n]+)/i);
        if (descMatch) {
          // Look for a title-like line right before Description
          const beforeDesc = pageText.split(/Description:/i)[0];
          const lines = beforeDesc.split('\n').filter(l => l.trim().length > 15);
          // Check last few lines for a good title
          for (let i = lines.length - 1; i >= Math.max(0, lines.length - 5); i--) {
            const line = lines[i].trim();
            if (isValidTitle(line) && !line.includes(':') && !line.match(/^\d/)) {
              title = line;
              break;
            }
          }
        }
      }

      // Method 4: Look for strong/bold text that might be the title
      if (!title) {
        const strongElements = document.querySelectorAll('strong, b, h2, h3');
        for (const el of Array.from(strongElements)) {
          const text = (el as HTMLElement).innerText?.trim() || '';
          if (isValidTitle(text) && !text.includes(':')) {
            title = text;
            break;
          }
        }
      }

      // Method 5: Look in specific page areas (main content, article)
      if (!title) {
        const mainContent = document.querySelector('main, article, [role="main"], .content, #content');
        if (mainContent) {
          const headings = mainContent.querySelectorAll('h1, h2, h3');
          for (const h of Array.from(headings)) {
            const text = (h as HTMLElement).innerText?.trim() || '';
            if (isValidTitle(text)) {
              title = text;
              break;
            }
          }
        }
      }

      // Find "Description:" label and get the text after it
      let description = '';
      const descMatch = pageText.match(/Description:\s*([^\n]+(?:\n(?![A-Z][a-z]+:)[^\n]+)*)/i);
      if (descMatch) {
        description = descMatch[1].trim().substring(0, 1500);
      }

      // Find "Eligibility:" section
      let eligibility = '';
      const eligMatch = pageText.match(/Eligibility:\s*([\s\S]*?)(?=Total Amount|Instructions for|Other Information|Addenda|$)/i);
      if (eligMatch) {
        eligibility = eligMatch[1].trim().substring(0, 2000);
      }

      // Extract Total Amount Available
      let fundingMin: number | undefined;
      let fundingMax: number | undefined;
      const amountMatch = pageText.match(/Total Amount Available[^$]*\$[\d,]+/i);
      if (amountMatch) {
        const dollarMatch = amountMatch[0].match(/\$([\d,]+)/);
        if (dollarMatch) {
          fundingMin = parseInt(dollarMatch[1].replace(/,/g, ''));
          fundingMax = fundingMin;
        }
      }

      // Extract Close Date
      let closeDate = '';
      const closeDateMatch = pageText.match(/Close Date[^:]*:\s*([^\n]+)/i);
      if (closeDateMatch) {
        closeDate = closeDateMatch[1].trim();
      }

      // Extract Publish Date
      let openDate = '';
      const pubDateMatch = pageText.match(/Publish Date[^:]*:\s*([^\n]+)/i);
      if (pubDateMatch) {
        openDate = pubDateMatch[1].trim();
      }

      // Extract Agency
      let agency = '';
      const agencyMatch = pageText.match(/Agency[^:]*:\s*([^\n]+)/i);
      if (agencyMatch) {
        agency = agencyMatch[1].trim();
      }

      // Extract Category
      const categories: string[] = [];
      const catMatch = pageText.match(/Primary Category[^:]*:\s*([^\n]+)/i);
      if (catMatch) {
        categories.push(catMatch[1].trim());
      }

      // Extract Location/States
      let location = '';
      const locMatch = pageText.match(/Location[^:]*:\s*([^\n]+)/i);
      if (locMatch) {
        location = locMatch[1].trim();
      }

      // Extract grant status (Open/Closed, Competitive/Non-Competitive)
      let grantStatus = 'Open';
      const statusMatch = pageText.match(/(Open|Closed)\s*(Competitive|Non-Competitive|Restricted)?/i);
      if (statusMatch) {
        grantStatus = statusMatch[0].trim();
      }

      // Extract Selection Process
      let selectionProcess = '';
      const selMatch = pageText.match(/Selection Process[^:]*:\s*([^\n]+)/i);
      if (selMatch) {
        selectionProcess = selMatch[1].trim();
      }

      return {
        title,
        description,
        eligibility,
        fundingMin,
        fundingMax,
        openDate,
        closeDate,
        agency,
        categories,
        location,
        grantStatus,
        selectionProcess,
      };
    });

    // Skip titles that are clearly wrong
    const badTitlePatterns = [
      /^(Current )?Grant Opportunity/i,
      /^Navigation Menu/i,
      /^Skip to/i,
      /^Main Menu/i,
      /^GO\d+$/,
      /^Home$/i,
      /^Search$/i,
      /^(Open|Closed)\s*(Competitive|Non-Competitive|Restricted)?$/i,
      /^(Competitive|Non-Competitive|Restricted)$/i,
      /^To view the grant/i,
      /please select/i,
      /Grant Opportunity Documents/i,
    ];

    const isBadTitle = (t: string): boolean => {
      if (!t || t.length < 20) return true;
      // Must have at least 3 words
      const words = t.split(/\s+/).filter(w => w.length > 2);
      if (words.length < 3) return true;
      return badTitlePatterns.some(p => p.test(t));
    };

    // Only use the detailed title if it's better than what we have
    let finalTitle = grant.title;

    // If detail page found a good title, use it
    if (details.title && !isBadTitle(details.title)) {
      finalTitle = details.title;
    }

    // If the title is still bad, try to extract from description
    if (isBadTitle(finalTitle) && details.description) {
      // Use first sentence of description as fallback title
      const firstSentence = details.description.split(/[.!?]/)[0].trim();
      if (firstSentence.length > 20 && firstSentence.length < 200) {
        finalTitle = firstSentence.substring(0, 150) + (firstSentence.length > 150 ? '...' : '');
      }
    }

    // Last resort: use GO number with agency
    if (isBadTitle(finalTitle)) {
      finalTitle = `${grant.goNumber} - ${grant.agency}`;
    }

    return {
      ...grant,
      title: finalTitle,
      agency: details.agency || grant.agency,
      description: details.description || undefined,
      eligibility: details.eligibility || undefined,
      fundingMin: details.fundingMin,
      fundingMax: details.fundingMax,
      openDate: details.openDate || undefined,
      closeDate: details.closeDate || grant.closeDate,
      categories: details.categories?.length ? details.categories : undefined,
    };
  } catch (error) {
    console.error(`Error fetching details for ${grant.goNumber}:`, error);
    return grant;
  } finally {
    await page.close();
  }
}

// Fetch details for multiple grants in parallel
async function fetchGrantDetailsInParallel(
  browser: Browser,
  grants: ScrapedGrant[],
  concurrency: number = 5
): Promise<ScrapedGrant[]> {
  const results: ScrapedGrant[] = [];

  for (let i = 0; i < grants.length; i += concurrency) {
    const batch = grants.slice(i, i + concurrency);
    console.log(`\nFetching details for grants ${i + 1}-${Math.min(i + concurrency, grants.length)} of ${grants.length}...`);

    const batchResults = await Promise.all(
      batch.map(grant => scrapeGrantDetails(browser, grant))
    );

    results.push(...batchResults);

    // Small delay between batches
    if (i + concurrency < grants.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

// Scrape a single page
async function scrapePage(browser: Browser, pageNum: number): Promise<ScrapedGrant[]> {
  const page = await browser.newPage();

  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    const url = `https://www.grants.gov.au/Go/List?Page=${pageNum}`;
    console.log(`[Page ${pageNum}] Scraping: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Debug: save screenshot and HTML for page 1
    if (pageNum === 1) {
      await page.screenshot({ path: 'debug-screenshot.png', fullPage: true });
      const html = await page.content();
      require('fs').writeFileSync('debug-page.html', html);
      console.log('[Debug] Saved screenshot and HTML to debug-screenshot.png and debug-page.html');

      // Log what selectors we can find
      const debugInfo = await page.evaluate(() => {
        return {
          title: document.title,
          tables: document.querySelectorAll('table').length,
          divs: document.querySelectorAll('div').length,
          links: document.querySelectorAll('a').length,
          bodyText: document.body?.innerText?.substring(0, 500) || 'No body text',
        };
      });
      console.log('[Debug] Page info:', debugInfo);
    }

    // Extract grants from the div-based layout
    const pageGrants = await page.evaluate(() => {
      const results: any[] = [];

      // Find all grant links - they contain "/Go/Show?GoUuid=" in their href
      const grantLinks = document.querySelectorAll('a[href*="/Go/Show?GoUuid="]');

      grantLinks.forEach((link) => {
        const title = link.textContent?.trim() || '';
        const href = link.getAttribute('href') || '';

        // Get the parent container to find related info
        let container = link.closest('div')?.parentElement?.parentElement;
        if (!container) container = link.parentElement?.parentElement;

        // Extract GO number from nearby text
        const containerText = container?.textContent || '';
        const goMatch = containerText.match(/GO\d+/);
        const goNumber = goMatch ? goMatch[0] : '';

        // Try to find close date - usually contains date patterns
        const dateMatch = containerText.match(/(\d{1,2}\s+\w+\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/);
        const closeDate = dateMatch ? dateMatch[1] : '';

        // Try to find agency - usually "Department of..." or similar
        const agencyMatch = containerText.match(/(Department of[^,\n]+|Australian [A-Z][a-z]+[^,\n]*)/i);
        const agency = agencyMatch ? agencyMatch[1].trim() : 'Australian Government';

        if (title && href) {
          results.push({
            title,
            agency,
            closeDate,
            status: 'Open',
            url: `https://www.grants.gov.au${href}`,
            goNumber,
          });
        }
      });

      // Remove duplicates based on URL
      const seen = new Set();
      return results.filter(grant => {
        if (seen.has(grant.url)) return false;
        seen.add(grant.url);
        return true;
      });
    });

    console.log(`[Page ${pageNum}] Found ${pageGrants.length} grants`);
    return pageGrants;
  } catch (error) {
    console.error(`[Page ${pageNum}] Error:`, error);
    return [];
  } finally {
    await page.close();
  }
}

// ============================================
// STATE GOVERNMENT GRANT SCRAPERS
// ============================================

// Scrape NSW grants from nsw.gov.au
async function scrapeNSWGrants(browser: Browser): Promise<ScrapedGrant[]> {
  console.log('\n=== Scraping NSW Government Grants ===');
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const grants: ScrapedGrant[] = [];

  try {
    await page.goto('https://www.nsw.gov.au/grants-and-funding', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pageGrants = await page.evaluate(() => {
      const results: any[] = [];
      // Look for grant cards/links
      const grantLinks = document.querySelectorAll('a[href*="/grants-and-funding/"]');

      grantLinks.forEach(link => {
        const href = link.getAttribute('href') || '';
        const title = link.textContent?.trim() || '';

        // Skip navigation links
        if (title.length < 10 || title.length > 200) return;
        if (href.includes('/grants-and-funding/') && !href.endsWith('/grants-and-funding/')) {
          results.push({
            title,
            url: href.startsWith('http') ? href : `https://www.nsw.gov.au${href}`,
            agency: 'NSW Government',
            goNumber: `NSW-${Date.now()}-${results.length}`,
            closeDate: '',
            status: 'Open',
          });
        }
      });

      // Remove duplicates
      const seen = new Set();
      return results.filter(g => {
        if (seen.has(g.url)) return false;
        seen.add(g.url);
        return true;
      });
    });

    console.log(`[NSW] Found ${pageGrants.length} grants`);
    grants.push(...pageGrants);
  } catch (error) {
    console.error('[NSW] Error:', error);
  } finally {
    await page.close();
  }

  return grants;
}

// Scrape Queensland grants
async function scrapeQLDGrants(browser: Browser): Promise<ScrapedGrant[]> {
  console.log('\n=== Scraping Queensland Government Grants ===');
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const grants: ScrapedGrant[] = [];

  try {
    // Try the main QLD grants portal
    await page.goto('https://www.qld.gov.au/about/how-government-works/grants-programs', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Take debug screenshot
    await page.screenshot({ path: 'debug-qld.png', fullPage: true });

    const pageGrants = await page.evaluate(() => {
      const results: any[] = [];
      const pageText = document.body?.innerText || '';

      // Look for grant items - QLD uses various selectors
      const grantItems = document.querySelectorAll(
        '.grant-item, .search-result, [class*="result"], .card, article, ' +
        '.grant-card, [class*="grant"], .listing-item, .search-listing, ' +
        'table tbody tr, .data-row'
      );

      grantItems.forEach((item, index) => {
        const link = item.querySelector('a');
        const title = item.querySelector('h2, h3, h4, .title, .grant-title, td:first-child')?.textContent?.trim()
          || link?.textContent?.trim() || '';
        const href = link?.getAttribute('href') || '';
        const desc = item.querySelector('p, .description, .summary, .grant-description')?.textContent?.trim() || '';

        if (title && title.length > 10 && title.length < 300 && !title.includes('Search') && !title.includes('Filter')) {
          results.push({
            title,
            url: href.startsWith('http') ? href : (href ? `https://www.qld.gov.au${href}` : ''),
            agency: 'Queensland Government',
            goNumber: `QLD-${Date.now()}-${index}`,
            closeDate: '',
            status: 'Open',
            description: desc.substring(0, 500),
          });
        }
      });

      // Fallback: look for any links that look like grants
      if (results.length === 0) {
        const allLinks = document.querySelectorAll('a[href*="grant"], a[href*="program"], a[href*="fund"]');
        allLinks.forEach((link, index) => {
          const title = link.textContent?.trim() || '';
          const href = link.getAttribute('href') || '';
          if (title.length > 15 && title.length < 200 && !title.includes('Search') && !title.includes('Page')) {
            results.push({
              title,
              url: href.startsWith('http') ? href : `https://www.qld.gov.au${href}`,
              agency: 'Queensland Government',
              goNumber: `QLD-${Date.now()}-${index}`,
              closeDate: '',
              status: 'Open',
            });
          }
        });
      }

      // Remove duplicates
      const seen = new Set();
      return results.filter(g => {
        const key = g.title + g.url;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    });

    console.log(`[QLD] Found ${pageGrants.length} grants`);
    grants.push(...pageGrants);
  } catch (error) {
    console.error('[QLD] Error:', error);
  } finally {
    await page.close();
  }

  return grants;
}

// Scrape Victoria grants
async function scrapeVICGrants(browser: Browser): Promise<ScrapedGrant[]> {
  console.log('\n=== Scraping Victoria Government Grants ===');
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const grants: ScrapedGrant[] = [];

  try {
    await page.goto('https://www.vic.gov.au/grants-and-programs', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pageGrants = await page.evaluate(() => {
      const results: any[] = [];
      // Look for grant links
      const grantLinks = document.querySelectorAll('a[href*="/grants"], a[href*="/funding"], a[href*="/program"]');

      grantLinks.forEach((link, index) => {
        const href = link.getAttribute('href') || '';
        const title = link.textContent?.trim() || '';

        // Skip short titles and navigation
        if (title.length < 10 || title.length > 200) return;
        if (href.includes('/grants-and-programs') && href !== '/grants-and-programs') {
          const fullUrl = href.startsWith('http') ? href : `https://www.vic.gov.au${href}`;
          results.push({
            title,
            url: fullUrl,
            agency: 'Victoria Government',
            goNumber: `VIC-${Date.now()}-${index}`,
            closeDate: '',
            status: 'Open',
          });
        }
      });

      // Remove duplicates
      const seen = new Set();
      return results.filter(g => {
        if (seen.has(g.url)) return false;
        seen.add(g.url);
        return true;
      });
    });

    console.log(`[VIC] Found ${pageGrants.length} grants`);
    grants.push(...pageGrants);
  } catch (error) {
    console.error('[VIC] Error:', error);
  } finally {
    await page.close();
  }

  return grants;
}

// Scrape Business Victoria grants
async function scrapeBusinessVICGrants(browser: Browser): Promise<ScrapedGrant[]> {
  console.log('\n=== Scraping Business Victoria Grants ===');
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

  const grants: ScrapedGrant[] = [];

  try {
    await page.goto('https://business.vic.gov.au/grants-and-programs', { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 3000));

    const pageGrants = await page.evaluate(() => {
      const results: any[] = [];
      const grantCards = document.querySelectorAll('.card, article, [class*="grant"], [class*="program"]');

      grantCards.forEach((card, index) => {
        const link = card.querySelector('a');
        const title = card.querySelector('h2, h3, h4, .title')?.textContent?.trim() || link?.textContent?.trim() || '';
        const href = link?.getAttribute('href') || '';
        const desc = card.querySelector('p, .description')?.textContent?.trim() || '';

        if (title && title.length > 10 && title.length < 300 && href) {
          results.push({
            title,
            url: href.startsWith('http') ? href : `https://business.vic.gov.au${href}`,
            agency: 'Business Victoria',
            goNumber: `VIC-BIZ-${Date.now()}-${index}`,
            closeDate: '',
            status: 'Open',
            description: desc.substring(0, 500),
          });
        }
      });

      return results;
    });

    console.log(`[VIC-Business] Found ${pageGrants.length} grants`);
    grants.push(...pageGrants);
  } catch (error) {
    console.error('[VIC-Business] Error:', error);
  } finally {
    await page.close();
  }

  return grants;
}

// ============================================
// MAIN SCRAPER (Federal GrantConnect)
// ============================================

// Scrape pages in parallel batches
async function scrapeGrantConnect(): Promise<ScrapedGrant[]> {
  console.log('Launching browser...');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const maxPages = 15;
  const concurrency = 5; // Number of pages to scrape simultaneously
  const allGrants: ScrapedGrant[] = [];

  try {
    // First, scrape page 1 to check total pages
    const firstPageGrants = await scrapePage(browser, 1);
    allGrants.push(...firstPageGrants);

    if (firstPageGrants.length === 0) {
      console.log('No grants found on first page');
      return allGrants;
    }

    // Scrape remaining pages in parallel batches
    for (let batchStart = 2; batchStart <= maxPages; batchStart += concurrency) {
      const batchEnd = Math.min(batchStart + concurrency - 1, maxPages);
      const pageNumbers = [];

      for (let p = batchStart; p <= batchEnd; p++) {
        pageNumbers.push(p);
      }

      console.log(`\nScraping pages ${batchStart}-${batchEnd} in parallel...`);

      const batchResults = await Promise.all(
        pageNumbers.map(pageNum => scrapePage(browser, pageNum))
      );

      let emptyPages = 0;
      for (const pageGrants of batchResults) {
        if (pageGrants.length === 0) {
          emptyPages++;
        } else {
          allGrants.push(...pageGrants);
        }
      }

      // If most pages in batch are empty, we've likely reached the end
      if (emptyPages >= concurrency - 1) {
        console.log('Reached end of grants list');
        break;
      }

      // Small delay between batches to be polite
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    // Fetch detailed info for each grant
    if (allGrants.length > 0) {
      console.log(`\n--- Fetching detailed info for ${allGrants.length} grants ---`);
      const detailedGrants = await fetchGrantDetailsInParallel(browser, allGrants, 5);
      return detailedGrants;
    }
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }

  return allGrants;
}

function parseAustralianDate(dateStr: string): string | null {
  if (!dateStr || dateStr.toLowerCase() === 'ongoing') return null;

  try {
    // Handle format like "28 Feb 2026" or "28/02/2026"
    const cleaned = dateStr.trim();

    // Try parsing directly
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }

    // Try DD/MM/YYYY format
    const ddmmyyyy = cleaned.match(/(\d{1,2})[\s\/\-](\d{1,2})[\s\/\-](\d{2,4})/);
    if (ddmmyyyy) {
      const [, day, month, year] = ddmmyyyy;
      const fullYear = year.length === 2 ? `20${year}` : year;
      const parsed = new Date(`${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    return null;
  } catch {
    return null;
  }
}

async function saveGrantsToDatabase(grants: ScrapedGrant[]) {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const grant of grants) {
    if (!grant.title || !grant.goNumber) {
      skipped++;
      continue;
    }

    // Generate source ID based on grant type
    let sourceId: string;
    if (grant.goNumber.startsWith('GO')) {
      sourceId = `AU-GC-${grant.goNumber}`;  // Federal
    } else if (grant.goNumber.startsWith('NSW')) {
      sourceId = `AU-${grant.goNumber}`;
    } else if (grant.goNumber.startsWith('QLD')) {
      sourceId = `AU-${grant.goNumber}`;
    } else if (grant.goNumber.startsWith('VIC')) {
      sourceId = `AU-${grant.goNumber}`;
    } else {
      sourceId = `AU-${grant.goNumber}`;
    }

    const deadline = parseAustralianDate(grant.closeDate) ||
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    // Build a better description
    let description = grant.description || `Australian Government Grant from ${grant.agency}.`;
    if (grant.eligibility) {
      description += `\n\nEligibility: ${grant.eligibility}`;
    }

    // Determine eligible states based on source
    let eligibleStates: string[] = [];
    if (grant.goNumber.startsWith('NSW')) {
      eligibleStates = ['New South Wales'];
    } else if (grant.goNumber.startsWith('QLD')) {
      eligibleStates = ['Queensland'];
    } else if (grant.goNumber.startsWith('VIC')) {
      eligibleStates = ['Victoria'];
    }
    // Federal grants (GO*) have empty states = available nationwide

    const grantData = {
      title: grant.title,
      description,
      source_id: sourceId,
      source: 'grants_gov' as const,
      agency_name: grant.agency,
      url: grant.url,
      amount_min: grant.fundingMin || null,
      amount_max: grant.fundingMax || null,
      posted_date: grant.openDate ? parseAustralianDate(grant.openDate) || new Date().toISOString() : new Date().toISOString(),
      deadline,
      eligible_organization_types: ['small_business', 'nonprofit', 'individual'],
      eligible_states: eligibleStates,
      industry_categories: grant.categories?.length ? grant.categories : ['Other'],
      raw_data: grant,
      synced_from_external: new Date().toISOString(),
    };

    // Check if grant already exists
    const { data: existing } = await supabase
      .from('grants')
      .select('id')
      .eq('source_id', sourceId)
      .single();

    let error;
    if (existing) {
      // Update existing grant
      const { error: updateError } = await supabase
        .from('grants')
        .update(grantData)
        .eq('source_id', sourceId);
      error = updateError;
      if (!error) updated++;
    } else {
      // Insert new grant
      const { error: insertError } = await supabase
        .from('grants')
        .insert(grantData);
      error = insertError;
      if (!error) inserted++;
    }

    if (error) {
      console.error(`Error saving grant ${sourceId}:`, error.message);
      skipped++;
    }
  }

  console.log(`\nDatabase sync complete:`);
  console.log(`  - Inserted: ${inserted}`);
  console.log(`  - Updated: ${updated}`);
  console.log(`  - Skipped: ${skipped}`);
}

async function main() {
  console.log('Starting Australian Grants Scraper...\n');
  console.log('This will scrape Federal + State government grants.\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const allGrants: ScrapedGrant[] = [];

  try {
    // 1. Federal Grants (GrantConnect)
    console.log('\n========================================');
    console.log('FEDERAL GRANTS (GrantConnect)');
    console.log('========================================');
    const federalGrants = await scrapeGrantConnect();
    allGrants.push(...federalGrants);
    console.log(`Federal grants collected: ${federalGrants.length}`);

    // 2. State Grants (in parallel)
    console.log('\n========================================');
    console.log('STATE GRANTS');
    console.log('========================================');

    const [nswGrants, qldGrants, vicGrants, vicBizGrants] = await Promise.all([
      scrapeNSWGrants(browser),
      scrapeQLDGrants(browser),
      scrapeVICGrants(browser),
      scrapeBusinessVICGrants(browser),
    ]);

    allGrants.push(...nswGrants);
    allGrants.push(...qldGrants);
    allGrants.push(...vicGrants);
    allGrants.push(...vicBizGrants);

    console.log(`\nState grants collected:`);
    console.log(`  - NSW: ${nswGrants.length}`);
    console.log(`  - QLD: ${qldGrants.length}`);
    console.log(`  - VIC: ${vicGrants.length}`);
    console.log(`  - VIC Business: ${vicBizGrants.length}`);

  } finally {
    await browser.close();
  }

  console.log(`\n========================================`);
  console.log(`TOTAL GRANTS SCRAPED: ${allGrants.length}`);
  console.log(`========================================`);

  if (allGrants.length > 0) {
    console.log('\nSample grants:');
    allGrants.slice(0, 5).forEach((g, i) => {
      console.log(`${i + 1}. ${g.title}`);
      console.log(`   Agency: ${g.agency}`);
      console.log(`   Closes: ${g.closeDate}`);
      console.log(`   URL: ${g.url}\n`);
    });

    console.log('\nSaving to database...');
    await saveGrantsToDatabase(allGrants);
  }
}

main().catch(console.error);
