/**
 * Browser Tool
 * Provides Playwright browser automation for frontend testing
 */

import { chromium, Browser, Page, BrowserContext } from '@playwright/test';
import { ADMIN_URL } from '../config/agent.config';
import { testConfig } from '../config/agent.config';
import { logger } from '../utils/logger';
import path from 'path';

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let page: Page | null = null;

/**
 * Initialize browser instance
 */
async function ensureBrowser(): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  if (!browser) {
    browser = await chromium.launch({
      headless: testConfig.headless,
      slowMo: testConfig.slowMo
    });
    logger.info('Browser launched', { headless: testConfig.headless });
  }

  if (!context) {
    context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: testConfig.videoOnFailure ? {
        dir: path.join(process.cwd(), 'videos'),
        size: { width: 1920, height: 1080 }
      } : undefined
    });
    logger.info('Browser context created');
  }

  if (!page) {
    page = await context.newPage();
    logger.info('Browser page created');
  }

  return { browser, context, page };
}

/**
 * Close browser instance
 */
export async function closeBrowser() {
  if (page) await page.close();
  if (context) await context.close();
  if (browser) await browser.close();
  browser = null;
  context = null;
  page = null;
  logger.info('Browser closed');
}

interface BrowserNavigateInput {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  timeout?: number;
}

/**
 * Browser Navigate Tool
 */
export async function browserNavigate(input: BrowserNavigateInput) {
    try {
      const { page } = await ensureBrowser();
      const fullUrl = input.url.startsWith('http') ? input.url : `${ADMIN_URL}${input.url}`;

      logger.info('Navigating to', { url: fullUrl });
      await page.goto(fullUrl, {
        waitUntil: input.waitUntil,
        timeout: input.timeout
      });

      const title = await page.title();
      const url = page.url();

      return {
        success: true,
        url,
        title,
        message: `Navigated to ${url}`
      };
    } catch (error: any) {
      logger.error('Navigation failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

interface BrowserClickInput {
  selector: string;
  clickType?: 'click' | 'dblclick' | 'hover';
  timeout?: number;
}

/**
 * Browser Click Tool
 */
export async function browserClick(input: BrowserClickInput) {
    try {
      const { page } = await ensureBrowser();

      logger.info('Clicking element', { selector: input.selector, clickType: input.clickType });

      // Try as text first, then as selector
      const element = page.getByText(input.selector).or(page.locator(input.selector)).first();

      await element.waitFor({ state: 'visible', timeout: input.timeout });

      if (input.clickType === 'hover') {
        await element.hover();
      } else if (input.clickType === 'dblclick') {
        await element.dblclick();
      } else {
        await element.click();
      }

      return {
        success: true,
        message: `${input.clickType} on ${input.selector} successful`
      };
    } catch (error: any) {
      logger.error('Click failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

interface BrowserFillInput {
  selector: string;
  value: string;
  clear?: boolean;
  pressEnter?: boolean;
}

/**
 * Browser Fill Tool
 */
export async function browserFill(input: BrowserFillInput) {
    try {
      const { page } = await ensureBrowser();

      logger.info('Filling input', { selector: input.selector });

      // Try as label first, then as selector
      const element = page.getByLabel(input.selector).or(page.locator(input.selector)).first();

      await element.waitFor({ state: 'visible', timeout: 10000 });

      if (input.clear) {
        await element.clear();
      }

      await element.fill(input.value);

      if (input.pressEnter) {
        await element.press('Enter');
      }

      return {
        success: true,
        message: `Filled ${input.selector} with value`
      };
    } catch (error: any) {
      logger.error('Fill failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

interface BrowserScreenshotInput {
  name: string;
  selector?: string;
  fullPage?: boolean;
}

/**
 * Browser Screenshot Tool
 */
export async function browserScreenshot(input: BrowserScreenshotInput) {
    try {
      const { page } = await ensureBrowser();
      const timestamp = new Date().toISOString().replace(/:/g, '-');
      const filename = `${input.name}-${timestamp}.png`;
      const filepath = path.join(process.cwd(), 'screenshots', filename);

      logger.info('Taking screenshot', { filename });

      if (input.selector) {
        const element = page.locator(input.selector).first();
        await element.screenshot({ path: filepath });
      } else {
        await page.screenshot({
          path: filepath,
          fullPage: input.fullPage
        });
      }

      return {
        success: true,
        filepath,
        message: `Screenshot saved to ${filepath}`
      };
    } catch (error: any) {
      logger.error('Screenshot failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

interface BrowserGetTextInput {
  selector: string;
  all?: boolean;
}

/**
 * Get Element Text Tool
 */
export async function browserGetText(input: BrowserGetTextInput) {
    try {
      const { page } = await ensureBrowser();

      if (input.all) {
        const elements = page.locator(input.selector);
        const count = await elements.count();
        const texts: string[] = [];

        for (let i = 0; i < count; i++) {
          const text = await elements.nth(i).textContent();
          if (text) texts.push(text.trim());
        }

        return {
          success: true,
          texts,
          count
        };
      } else {
        const element = page.locator(input.selector).first();
        const text = await element.textContent();

        return {
          success: true,
          text: text?.trim() || ''
        };
      }
    } catch (error: any) {
      logger.error('Get text failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }

interface BrowserWaitInput {
  selector: string;
  state?: 'visible' | 'hidden' | 'attached' | 'detached';
  timeout?: number;
}

/**
 * Wait for Element Tool
 */
export async function browserWait(input: BrowserWaitInput) {
    try {
      const { page } = await ensureBrowser();

      const element = page.locator(input.selector).first();
      await element.waitFor({ state: input.state, timeout: input.timeout });

      return {
        success: true,
        message: `Element ${input.selector} is ${input.state}`
      };
    } catch (error: any) {
      logger.error('Wait failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  }
