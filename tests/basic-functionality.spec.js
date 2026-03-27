const { test, expect } = require('@playwright/test');

test('zakladni funkcnost bez potvrzeni rezervace', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'BarX', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Shoty' }).click();
  await expect(page.locator('.drink-card:has-text("Crimson Storm")')).toBeVisible();
  await expect(page.locator('.drink-card:has-text("MonstRum")')).toBeHidden();

  await page.goto('/#reservation');
  await expect(page.locator('#reservationForm')).toBeVisible();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = tomorrow.toISOString().split('T')[0];

  await page.locator('#reservationDate').fill(tomorrowIso);
  await page.locator('#reservationDate').dispatchEvent('change');
  await page.selectOption('#guestCount', '3');

  await expect(page.locator('#slotGrid .slot-btn').first()).toBeVisible();

  const firstAvailableSlot = page.locator('#slotGrid .slot-btn:not(.is-disabled)').first();
  await expect(firstAvailableSlot).toBeVisible();
  await firstAvailableSlot.click();

  const firstAvailableTable = page.locator('#tableGrid .table-option:not(.is-disabled)').first();
  await expect(firstAvailableTable).toBeVisible();
  await firstAvailableTable.click();

  await page.locator('#plannedVibe').evaluate((el) => {
    el.value = '9';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

  await expect(page.locator('#vibeWarning')).toBeVisible();
  await expect(page.locator('#summaryDate')).not.toHaveText('Vyber datum');
  await expect(page.locator('#summaryTime')).not.toHaveText('Vyber čas');
  await expect(page.locator('#summaryTable')).not.toHaveText('Vyber místo');
  await expect(page.locator('#summaryGuests')).toContainText('3');
  await expect(page.locator('#summaryVibe')).toHaveText('9/10');

  await page.goto('/admin.html');
  await expect(page.getByRole('heading', { name: 'BarX Admin' })).toBeVisible();

  await page.getByRole('button', { name: 'Karty' }).click();
  await expect(page.locator('#cardsView')).toHaveClass(/is-active/);
});

test('drink modal je ovladatelny klavesnici i mysi', async ({ page }) => {
  test.setTimeout(90_000);

  await page.goto('/');

  const monStrumCard = page.locator('.drink-card:has-text("MonstRum")').first();
  await expect(monStrumCard).toBeVisible();

  await monStrumCard.click();

  const modal = page.locator('#drinkModal');
  await expect(modal).toHaveClass(/is-open/);
  await expect(page.locator('#drinkModalTitle')).toHaveText('MonstRum');
  await expect(page.locator('#drinkModalPrice')).toContainText('Kč');
  await expect(page.locator('#drinkModalStrength')).toContainText('/5');

  await page.keyboard.press('Escape');
  await expect(modal).not.toHaveClass(/is-open/);

  await monStrumCard.focus();
  await page.keyboard.press('Enter');
  await expect(modal).toHaveClass(/is-open/);

  await page.locator('.drink-modal-backdrop').evaluate(el => el.click());
  await expect(modal).not.toHaveClass(/is-open/);

  await monStrumCard.focus();
  await page.keyboard.press('Space');
  await expect(modal).toHaveClass(/is-open/);

  await page.locator('#drinkModalClose').click();
  await expect(modal).not.toHaveClass(/is-open/);
});
