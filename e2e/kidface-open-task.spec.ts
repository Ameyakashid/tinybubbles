import { expect, test } from '@playwright/test';

test('kid face opens a task from the Today row', async ({ page }) => {
    await page.goto('/?face=next');

    await expect(page.getByText(/^Good (morning|afternoon|evening)/)).toBeVisible();

    await page.getByRole('button', { name: 'Add' }).click();

    const input = page.getByPlaceholder('I need to…');
    await input.fill('Open me');
    await input.press('Enter');

    await page.getByRole('button', { name: 'Today' }).click();

    await page.getByRole('button', { name: 'Open Open me' }).click();

    await expect(page.getByRole('dialog', { name: 'Open me' })).toBeVisible();
    await expect(page.getByText('Nothing to check off — just do it.')).toBeVisible();

    await page.getByRole('button', { name: 'Back' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
