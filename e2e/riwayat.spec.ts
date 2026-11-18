import {expect, test, type Page} from '@playwright/test';
import {mark, savedConfirmation, seed} from './helpers';

/**
 * Riwayat narrowed to one class.
 *
 * With a few classes a week the list of saved sessions grows long quickly;
 * the Kelas picker shows one class's sessions, or those with no class.
 */

test.beforeEach(async ({page}) => {
  await seed(page);

  const sessions: Array<[string | null, string]> = [
    ['Ngaji Pagi', '2026-09-07'],
    ['Tahfidz Sore', '2026-09-09'],
    [null, '2026-09-10'],
  ];
  for (const [kelas, tanggal] of sessions) {
    if (kelas) await page.locator('.cs-group__btn').filter({hasText: kelas}).click();
    await page.getByLabel('Tanggal kegiatan').fill(tanggal);
    await mark(page, 'Ahmad Fauzi', 'Hadir');
    await page.getByRole('button', {name: /Simpan presensi/}).click();
    await expect(savedConfirmation(page)).toBeVisible();
    await page.getByRole('button', {name: 'Catat sesi lain'}).click();
  }

  await page.getByRole('button', {name: 'Riwayat', exact: true}).click();
  // Wait for Riwayat itself: the Presensi page is still leaving for a moment.
  await expect(page.getByRole('heading', {name: 'Riwayat presensi'})).toBeVisible();
  await expect(page.locator('select#riwayat_class_filter')).toBeVisible();
});

const kelasPicker = (page: Page) => page.locator('select#riwayat_class_filter');
const sessionHeadings = (page: Page) => page.locator('.cs-cards h3.cs-subtitle');

test('the Kelas picker shows one class, or the sessions with none', async ({page}) => {
  await expect(sessionHeadings(page)).toHaveCount(3);
  const kelas = kelasPicker(page);

  await kelas.selectOption({label: 'Ngaji Pagi (Senin)'});
  await expect(sessionHeadings(page)).toHaveText(['Senin, 7 September 2026']);
  await expect(page.getByText('1 dari 3 sesi tersimpan di ponsel ini.')).toBeVisible();

  await kelas.selectOption({label: 'Tanpa jadwal'});
  await expect(sessionHeadings(page)).toHaveText(['Kamis, 10 September 2026']);

  await kelas.selectOption({label: 'Semua kelas'});
  await expect(sessionHeadings(page)).toHaveCount(3);
  await expect(page.getByText('3 sesi tersimpan di ponsel ini.')).toBeVisible();
});

test('the chosen class is kept when coming back to Riwayat', async ({page}) => {
  await kelasPicker(page).selectOption({label: 'Tahfidz Sore (Rabu)'});
  await page.getByRole('button', {name: 'Presensi', exact: true}).click();
  await page.getByRole('button', {name: 'Riwayat', exact: true}).click();

  await expect(kelasPicker(page)).toHaveValue(/^\d+$/);
  await expect(sessionHeadings(page)).toHaveText(['Rabu, 9 September 2026']);
});

test('select all for export takes only the sessions on screen', async ({page}) => {
  await kelasPicker(page).selectOption({label: 'Ngaji Pagi (Senin)'});
  await page.getByRole('button', {name: 'Ekspor'}).click();
  await page.getByRole('button', {name: 'Pilih semua yang tampil'}).click();
  await expect(page.getByText('1 sesi dipilih.')).toBeVisible();
});

test('a class with no sessions says so and offers every class back', async ({page}) => {
  await page.getByRole('button', {name: 'Jadwal', exact: true}).click();
  await page.getByLabel('Nama kelas').fill('Iqra sore');
  await page.getByRole('button', {name: 'Simpan jadwal'}).click();
  await expect(page.locator('li.cs-card').filter({hasText: 'Iqra sore'})).toBeVisible();

  await page.getByRole('button', {name: 'Riwayat', exact: true}).click();
  const iqra = await kelasPicker(page).locator('option', {hasText: 'Iqra sore'}).getAttribute('value');
  await kelasPicker(page).selectOption(iqra!);
  await expect(page.getByText('Belum ada sesi untuk kelas ini')).toBeVisible();

  await page.getByRole('button', {name: 'Tampilkan semua kelas'}).click();
  await expect(sessionHeadings(page)).toHaveCount(3);
});
