import { readFileSync } from 'node:fs';
import { expect, type Download, type Page } from '@playwright/test';

export const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' });

export async function freshApp(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'SceneForge' })).toBeVisible();
}

export async function openView(page: Page, name: 'Editor' | 'Gallery' | 'About'): Promise<void> {
  await nav(page).getByRole('link', { name }).click();
  await expect(nav(page).getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
}

export async function useTemplate(page: Page, id: string): Promise<void> {
  await openView(page, 'Gallery');
  await page.getByTestId(`use-${id}`).click();
  await expect(nav(page).getByRole('link', { name: 'Editor' })).toHaveAttribute(
    'aria-current',
    'page',
  );
}

export async function downloadText(
  page: Page,
  action: () => Promise<void>,
): Promise<{ text: string; download: Download }> {
  const [download] = await Promise.all([page.waitForEvent('download'), action()]);
  return { text: readFileSync(await download.path(), 'utf8'), download };
}

export async function exportSvg(page: Page): Promise<string> {
  const { text } = await downloadText(page, () =>
    page.getByRole('button', { name: 'Export SVG', exact: true }).click(),
  );
  return text;
}

/** Parses SVG text with the browser's XML parser; returns the parser error text or ''. */
export async function xmlError(page: Page, svg: string): Promise<string> {
  return page.evaluate((s) => {
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    return doc.querySelector('parsererror')?.textContent ?? '';
  }, svg);
}
