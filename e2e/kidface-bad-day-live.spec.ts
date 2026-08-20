import { expect, test } from '@playwright/test';

const screenshot = async (page: import('@playwright/test').Page, name: string) => {
    const path = `test-results/kidface-pass22-${name}.png`;
    await page.screenshot({ path, fullPage: false });
    return path;
};

test('load-error surface renders with comforting copy and a retry button', async ({ page }) => {
    await page.goto('/?face=next&kidface-force=load-error');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Could not load your morning')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await page.waitForTimeout(400);
    await screenshot(page, 'load-error');
});

test('offline banner renders with a retry action', async ({ page }) => {
    await page.goto('/?face=next&kidface-force=offline');

    const banner = page.getByRole('button', { name: /Offline — your changes are saved/ });
    await expect(banner).toBeVisible();
    await banner.click();
    await expect(page.getByRole('button', { name: 'Trying to sync…' })).toBeVisible();
    await page.waitForTimeout(400);
    await screenshot(page, 'offline');
});

test('stock shell at root is untouched', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Focus' })).toBeVisible();
    await page.waitForTimeout(400);
    await screenshot(page, 'stock-shell');
});
