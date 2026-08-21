import { expect, test } from '@playwright/test';

const screenshot = async (page: import('@playwright/test').Page, name: string) => {
    const path = `test-results/kidface-pass11-${name}.png`;
    await page.screenshot({ path, fullPage: false });
    return path;
};

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('tinybubbles:desktop:first-run-onboarding:v1', 'dismissed');
    });
});

test('kid face settings room renders and lets a child pick a theme', async ({ page }) => {
    await page.goto('/?face=next');

    await expect(page.getByText(/^Good (morning|afternoon|evening)/)).toBeVisible();
    await page.waitForTimeout(400);
    await screenshot(page, 'today');

    await page.getByRole('button', { name: 'Me' }).click();
    await expect(page.getByRole('heading', { name: 'Your settings' })).toBeVisible();
    await page.waitForTimeout(400);
    await screenshot(page, 'settings');

    // Pick a non-default theme so the screenshot proves the surface is live.
    await page.getByRole('button', { name: 'Sepia' }).click();
    await expect(page.locator('html')).toHaveClass(/theme-sepia/);
    await page.waitForTimeout(400);
    await screenshot(page, 'settings-sepia');

    // Switching languages requires confirmation so a child cannot trap themselves.
    await page.getByRole('button', { name: 'Español' }).click();
    await expect(page.getByRole('dialog', { name: 'Switch language?' })).toBeVisible();
    await page.getByRole('button', { name: 'Switch to Español' }).click();
    await expect(page.getByRole('button', { name: 'Español' })).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(400);
    await screenshot(page, 'settings-es');
});
