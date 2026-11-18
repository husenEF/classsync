import {expect, test, type Page} from '@playwright/test';
import {mark, markRadio, savedConfirmation, savedSessions, seed} from './helpers';

/**
 * Editing a saved session.
 *
 * "Ubah" in Riwayat opens the session in the Presensi register — the screen it
 * was made on — so every mark, reason and the teacher's mark can be changed,
 * not just a list of names. Changing its date or class moves it.
 */

test.beforeEach(async ({page}) => {
  await seed(page);
});

/** Save one Ngaji Pagi session on a fixed date, from the register. */
async function saveSession(page: Page, tanggal: string, marks: Array<[string, Parameters<typeof mark>[2]]>) {
  await page.locator('.cs-group__btn').filter({hasText: 'Ngaji Pagi'}).click();
  await page.getByLabel('Tanggal kegiatan').fill(tanggal);
  for (const [name, status] of marks) await mark(page, name, status);
  await page.getByRole('button', {name: /Simpan presensi/}).click();
  await expect(savedConfirmation(page)).toBeVisible();
  await page.getByRole('button', {name: 'Catat sesi lain'}).click();
}

const openRiwayat = (page: Page) => page.getByRole('button', {name: 'Riwayat', exact: true}).click();

const editSession = async (page: Page, dateText: string) => {
  await openRiwayat(page);
  await page
    .locator('section.cs-card')
    .filter({has: page.getByRole('heading', {name: dateText})})
    .getByRole('button', {name: 'Ubah', exact: true})
    .click();
  await expect(page.getByRole('region', {name: 'Mengubah sesi'})).toBeVisible();
};

test('Ubah opens the session in the register, marks and reason included', async ({page}) => {
  await saveSession(page, '2026-09-07', [
    ['Ahmad Fauzi', 'Hadir'],
    ['Hasan Basri', 'Sakit'],
    ['Budi Santoso', 'Lainnya'],
  ]);
  // The reason is typed after the session exists, to keep the helper simple.
  const [saved] = await savedSessions(page);
  expect(saved.statuses['budi santoso']).toBe('etc');

  await editSession(page, 'Senin, 7 September 2026');
  await expect(page.getByLabel('Tanggal kegiatan')).toHaveValue('2026-09-07');
  await expect(markRadio(page, 'Ahmad Fauzi', 'Hadir')).toBeChecked();
  await expect(markRadio(page, 'Hasan Basri', 'Sakit')).toBeChecked();
  await expect(markRadio(page, 'Budi Santoso', 'Lainnya')).toBeChecked();

  await mark(page, 'Hasan Basri', 'Izin');
  await page.getByRole('textbox', {name: 'Keterangan Budi Santoso'}).fill('acara keluarga');
  await page.getByRole('button', {name: 'Simpan perubahan'}).click();

  // Back on Riwayat, with the one session changed rather than a second one.
  await expect(page.getByRole('heading', {name: 'Senin, 7 September 2026'})).toBeVisible();
  const sessions = await savedSessions(page);
  expect(sessions).toHaveLength(1);
  expect(sessions[0].statuses).toMatchObject({'ahmad fauzi': 'hadir', 'hasan basri': 'izin'});
  expect(sessions[0].keterangan).toEqual({'budi santoso': 'acara keluarga'});
  expect(sessions[0].peserta).toEqual(['Ahmad Fauzi']);
});

test('changing the date while editing moves the session', async ({page}) => {
  await saveSession(page, '2026-09-07', [['Ahmad Fauzi', 'Hadir']]);

  await editSession(page, 'Senin, 7 September 2026');
  await page.getByLabel('Tanggal kegiatan').fill('2026-09-14');
  // The mark stays: the register is still this session, not whatever is on the 14th.
  await expect(markRadio(page, 'Ahmad Fauzi', 'Hadir')).toBeChecked();
  await page.getByRole('button', {name: 'Simpan perubahan'}).click();

  await expect(page.getByRole('heading', {name: 'Senin, 14 September 2026'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Senin, 7 September 2026'})).toHaveCount(0);
  const sessions = await savedSessions(page);
  expect(sessions.map((s) => s.tanggal)).toEqual(['2026-09-14']);
});

test('moving onto a session already saved asks first, then leaves one', async ({page}) => {
  await saveSession(page, '2026-09-07', [['Ahmad Fauzi', 'Hadir']]);
  await saveSession(page, '2026-09-14', [['Hasan Basri', 'Hadir']]);

  await editSession(page, 'Senin, 7 September 2026');
  await page.getByLabel('Tanggal kegiatan').fill('2026-09-14');
  await page.getByRole('button', {name: 'Simpan perubahan'}).click();

  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toContainText('Pindahkan ke sesi yang sudah ada?');
  await dialog.getByRole('button', {name: 'Pindahkan & ganti'}).click();

  await expect(page.getByRole('heading', {name: 'Senin, 14 September 2026'})).toBeVisible();
  const sessions = await savedSessions(page);
  expect(sessions).toHaveLength(1);
  expect(sessions[0]).toMatchObject({tanggal: '2026-09-14', peserta: ['Ahmad Fauzi']});
});

test('Batal leaves the session as it was and the register empty', async ({page}) => {
  await saveSession(page, '2026-09-07', [['Ahmad Fauzi', 'Hadir']]);
  const before = await savedSessions(page);

  await editSession(page, 'Senin, 7 September 2026');
  await mark(page, 'Hasan Basri', 'Alpa');
  await page.getByRole('button', {name: 'Batal ubah'}).click();

  await expect(page.getByRole('heading', {name: 'Senin, 7 September 2026'})).toBeVisible();
  expect(await savedSessions(page)).toEqual(before);

  await page.getByRole('button', {name: 'Presensi', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Mengubah sesi'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /Simpan presensi/})).toBeVisible();
  await expect(markRadio(page, 'Hasan Basri', 'Alpa')).not.toBeChecked();
});
