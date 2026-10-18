import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { downloadText, exportSvg, freshApp, nav, openView, useTemplate, xmlError } from './helpers';

test.beforeEach(async ({ page }) => {
  await freshApp(page);
});

test('journey 1: encirclement, change factions, regenerate with a seed, move labels, export editable SVG', async ({
  page,
}) => {
  await useTemplate(page, 'encirclement');
  await expect(page.getByTestId('sample-indicator')).toContainText('Sample scene (synthetic)');

  // change factions
  await page.getByTestId('faction-name-faction-a').fill('Red Host');
  await page.getByTestId('faction-name-faction-b').fill('Blue Hold');
  await page.getByTestId('faction-color-faction-a').fill('#7e22ce');
  const svgEl = page.getByTestId('scene-svg');
  await expect(svgEl.locator('text', { hasText: 'Red Host' })).toHaveCount(1);
  await expect(svgEl.locator('text', { hasText: 'Blue Hold' })).toHaveCount(1);

  // regenerate with a seed: geometry changes, factions survive
  const before = await svgEl.locator('[data-id="attacker-3"] path').first().getAttribute('d');
  await page.getByTestId('regen-seed').fill('777');
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.getByTestId('notice')).toContainText('seed 777');
  const after = await svgEl.locator('[data-id="attacker-3"] path').first().getAttribute('d');
  expect(after).not.toBe(before);
  await expect(svgEl.locator('text', { hasText: 'Red Host' })).toHaveCount(1);

  // reposition labels: keyboard (Alt+arrows on the canvas) and the inspector
  await page.getByTestId('pick-attacker-1').click();
  const dx0 = Number(await page.getByTestId('label-dx').inputValue());
  await page.getByTestId('canvas').focus();
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('Alt+Shift+ArrowRight');
  await expect(page.getByTestId('label-dx')).toHaveValue(String(dx0 + 30));
  await page.getByTestId('pick-defender-2').click();
  await page.getByTestId('label-dy').fill('-150');

  // export: valid XML, editable vector, carries our edits, nothing executable
  const svg = await exportSvg(page);
  expect(await xmlError(page, svg)).toBe('');
  expect(svg).toContain('Red Host');
  expect(svg).toContain('#7e22ce');
  expect(svg).toContain('data-id="attacker-1"');
  expect(svg).toContain('Not a geographically accurate map.');
  expect(svg).not.toMatch(/<(script|image|foreignObject)\b|\son[a-z]+=|href=|data:image/i);
  expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
});

test('journey 2: save JSON, refresh, reopen: identical geometry and preserved layout', async ({
  page,
}) => {
  await useTemplate(page, 'siege');
  await page.getByTestId('pick-besieger-2').click();
  await page.getByTestId('obj-x').fill('333');
  await page.getByTestId('obj-y').fill('600');
  await page.getByTestId('pick-stronghold').click();
  await page.getByTestId('label-text').fill('The keep');
  const original = await exportSvg(page);
  const { text: json } = await downloadText(page, () =>
    page.getByRole('button', { name: 'Save JSON' }).click(),
  );
  expect(JSON.parse(json).schema).toBe('scene-forge.scene');

  // refresh: the autosaved scene comes back exactly
  await page.reload();
  expect(await exportSvg(page)).toBe(original);

  // clear everything, reopen the saved file
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  expect(await exportSvg(page)).not.toBe(original);
  const dir = test.info().outputPath('files');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'siege.scene.json');
  writeFileSync(file, json);
  await page.getByTestId('open-file').setInputFiles(file);
  await expect(page.getByTestId('notice')).toContainText('Opened');
  expect(await exportSvg(page)).toBe(original);
  await page.getByTestId('pick-besieger-2').click();
  await expect(page.getByTestId('obj-x')).toHaveValue('333');
  await expect(page.getByTestId('obj-y')).toHaveValue('600');
});

test('undo and redo, by buttons and by keyboard', async ({ page }) => {
  await useTemplate(page, 'timeline');
  await expect(page.getByTestId('undo')).toBeDisabled();
  await page.getByTestId('pick-witness-1').click();
  const x0 = await page.getByTestId('obj-x').inputValue();
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await expect(page.getByTestId('obj-x')).toHaveValue(String(Number(x0) + 10));
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('obj-x')).toHaveValue(x0);
  await page.getByTestId('redo').click();
  await expect(page.getByTestId('obj-x')).toHaveValue(String(Number(x0) + 10));
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('obj-x')).toHaveValue(x0);
  await page.keyboard.press('Control+y');
  await expect(page.getByTestId('obj-x')).toHaveValue(String(Number(x0) + 10));
  // Delete removes the selected object and can be undone
  await page.getByTestId('canvas').focus();
  await page.keyboard.press('Delete');
  await expect(page.getByTestId('pick-witness-1')).toHaveCount(0);
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('pick-witness-1')).toHaveCount(1);
});

test('acceptance regressions: typing a faction name, dashed toggle, Ctrl+Z on a checkbox, regenerate without factions', async ({
  page,
}) => {
  // typing a new faction name key by key keeps labels clean (was "tredade redoute")
  await useTemplate(page, 'trade-route');
  const name = page.getByTestId('faction-name-faction-a');
  await name.click();
  await name.press('Control+a');
  await page.keyboard.type('red');
  const labels = page.getByTestId('scene-svg').locator('text[data-role="label"]');
  await expect(labels).toHaveText(['red market', 'Faction B port', 'trade route']);

  // the Dashed checkbox changes a draw-animated arrow (it was inert), and Ctrl+Z undoes it
  // while the checkbox still has focus
  await useTemplate(page, 'retreat');
  await page.getByTestId('pick-withdrawal').click();
  const path = page.getByTestId('scene-svg').locator('[data-id="withdrawal"] path').first();
  await expect(path).toHaveAttribute('stroke-dasharray', '16 12');
  const dashed = page.getByRole('checkbox', { name: 'Dashed' });
  await dashed.click();
  await expect(path).not.toHaveAttribute('stroke-dasharray', '16 12');
  await page.keyboard.press('Control+z');
  await expect(dashed).toBeChecked();
  await expect(path).toHaveAttribute('stroke-dasharray', '16 12');

  // regenerate after removing every faction stays valid and saved
  await useTemplate(page, 'encirclement');
  for (const f of ['Faction A', 'Faction B', 'Faction C'])
    await page.getByRole('button', { name: `Remove ${f}` }).click();
  await page.getByRole('button', { name: 'Regenerate' }).click();
  await expect(page.getByTestId('notice')).toContainText('Regenerated');
  await expect(page.getByTestId('save-failed')).toHaveCount(0);
});

test('dragging an object with the mouse moves it', async ({ page }) => {
  await useTemplate(page, 'retreat');
  const fig = page.getByTestId('scene-svg').locator('[data-id="pursuer-2"] path').first();
  const box = await fig.boundingBox();
  if (!box) throw new Error('no box');
  await page.getByTestId('pick-pursuer-2').click();
  const x0 = Number(await page.getByTestId('obj-x').inputValue());
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 80, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  const x1 = Number(await page.getByTestId('obj-x').inputValue());
  expect(x1).toBeLessThan(x0 - 20);
  // one drag is one undo step
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('obj-x')).toHaveValue(String(x0));
});

test('dragging a label moves only the label', async ({ page }) => {
  await useTemplate(page, 'encirclement');
  await page.getByTestId('pick-defender-2').click();
  const x0 = await page.getByTestId('obj-x').inputValue();
  const dx0 = Number(await page.getByTestId('label-dx').inputValue());
  const label = page
    .getByTestId('scene-svg')
    .locator('[data-id="defender-2"] text[data-role="label"]');
  const box = await label.boundingBox();
  if (!box) throw new Error('no label box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  expect(Number(await page.getByTestId('label-dx').inputValue())).toBeGreaterThan(dx0 + 20);
  await expect(page.getByTestId('obj-x')).toHaveValue(x0);
});

test('animation: scrubbing changes the frame; reduced motion disables playback', async ({
  page,
}) => {
  await useTemplate(page, 'retreat');
  const path = page.getByTestId('scene-svg').locator('[data-id="pursuit"] path').first();
  await expect(path).toHaveAttribute('stroke-dashoffset', '0');
  await page.getByTestId('scrub').fill('0');
  await expect(path).toHaveAttribute('stroke-dashoffset', '100');
  await page.getByTestId('play').click();
  await expect(page.getByTestId('play')).toHaveText('Pause');
  await expect(page.getByTestId('play')).toHaveText('Play', { timeout: 8000 });
  await expect(path).toHaveAttribute('stroke-dashoffset', '0');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.getByTestId('play')).toBeDisabled();
  await expect(page.getByTestId('motion-note')).toContainText('reduced motion');
  const { text } = await downloadText(page, () =>
    page.getByRole('button', { name: 'Export animated SVG' }).click(),
  );
  expect(text).toContain('@media (prefers-reduced-motion: no-preference)');
  expect(await xmlError(page, text)).toBe('');
});

test('labels: one letter and 200 characters; markup stays text; QA flags overlap', async ({
  page,
}) => {
  await useTemplate(page, 'alliance-formation');
  await page.getByTestId('pick-west-1').click();
  await page.getByTestId('label-text').fill('x');
  await page.getByTestId('pick-east-1').click();
  await page.getByTestId('label-text').fill(`<img src=x onerror="window.__x=1">${'W'.repeat(200)}`);
  const svgEl = page.getByTestId('scene-svg');
  const long = await svgEl.locator('[data-id="east-1"] text').textContent();
  expect(Array.from(long ?? '').length).toBe(200);
  expect(long).toContain('<img');
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  expect(await page.locator('main img').count()).toBe(0);
  await expect(page.getByTestId('qa-list')).toContainText('LABEL_OVERLAP');
  const svg = await exportSvg(page);
  expect(await xmlError(page, svg)).toBe('');
  expect(svg).toContain('&lt;img src=x onerror=&quot;window.__x=1&quot;&gt;');
});

test('empty canvas, off-canvas and safe-area QA', async ({ page }) => {
  const empty = {
    schema: 'scene-forge.scene',
    version: 2,
    title: 'Empty',
    seed: 1,
    styleVersion: 1,
    canvas: { width: 800, height: 450, paper: '#ffffff', ink: '#111111' },
    safeArea: { top: 20, right: 20, bottom: 20, left: 20 },
    factions: [],
    objects: [],
    animation: { durationMs: 2000 },
    sample: false,
    template: null,
  };
  const dir = test.info().outputPath('files');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'empty.json');
  writeFileSync(file, JSON.stringify(empty));
  await page.getByTestId('open-file').setInputFiles(file);
  await expect(page.getByText('Empty scene. Add an object')).toBeVisible();
  await expect(page.getByTestId('qa-list')).toContainText('EMPTY_SCENE');
  await expect(page.getByTestId('sample-indicator')).toHaveCount(0);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByTestId('qa-clear')).toBeVisible();
  await page.getByTestId('obj-x').fill('2000');
  await expect(page.getByTestId('qa-list')).toContainText('OFF_CANVAS');
  await page.getByTestId('obj-x').fill('790');
  await expect(page.getByTestId('qa-list')).toContainText('PARTLY_OFF_CANVAS');
  await page.getByTestId('obj-x').fill('400');
  await page.getByTestId('obj-y').fill('110'); // figure top at 10 px: inside the canvas, outside the 20 px safe area
  await expect(page.getByTestId('qa-list')).toContainText('OUTSIDE_SAFE_AREA');
});

test('opening bad files is refused with reasons; version 1 files are upgraded', async ({
  page,
}) => {
  const dir = test.info().outputPath('files');
  mkdirSync(dir, { recursive: true });
  const write = (name: string, body: string): string => {
    const p = join(dir, name);
    writeFileSync(p, body);
    return p;
  };
  const input = page.getByTestId('open-file');
  await input.setInputFiles(write('junk.json', '{nope'));
  await expect(page.getByTestId('import-errors')).toContainText('not valid JSON');
  await input.setInputFiles(
    write('future.json', JSON.stringify({ schema: 'scene-forge.scene', version: 9 })),
  );
  await expect(page.getByTestId('import-errors')).toContainText('newer');
  await input.setInputFiles(
    write(
      'bad.json',
      JSON.stringify({
        schema: 'scene-forge.scene',
        version: 2,
        title: 'Bad',
        seed: 1,
        styleVersion: 1,
        canvas: { width: 800, height: 450, paper: '#ffffff', ink: '#111111' },
        safeArea: { top: 0, right: 0, bottom: 0, left: 0 },
        factions: [],
        objects: [
          {
            id: 'x',
            kind: 'text',
            x: 1,
            y: 1,
            text: 'a',
            size: 20,
            factionId: 'ghost',
            label: null,
            anim: { kind: 'none' },
          },
        ],
        animation: { durationMs: 2000 },
        sample: false,
        template: null,
        script: '<script>alert(1)</script>',
      }),
    ),
  );
  await expect(page.getByTestId('import-errors')).toContainText('script');
  const v1 = {
    schema: 'scene-forge.scene',
    version: 1,
    title: 'Old scene',
    seed: 5,
    styleVersion: 1,
    canvas: { width: 800, height: 450, paper: '#ffffff', ink: '#111111' },
    safeArea: 30,
    factions: [],
    objects: [
      {
        id: 'note',
        kind: 'text',
        x: 400,
        y: 200,
        text: 'Version one',
        size: 30,
        factionId: null,
        label: null,
      },
    ],
    sample: false,
  };
  await input.setInputFiles(write('v1.json', JSON.stringify(v1)));
  await expect(page.getByTestId('notice')).toContainText('upgraded from format version 1');
  await expect(
    page.getByTestId('scene-svg').locator('text', { hasText: 'Version one' }),
  ).toHaveCount(1);
});

test('stored scene corruption is recovered with a visible warning', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem('scene-forge.scene.v2', '{"schema":"scene-forge.scene","oops"'),
  );
  await page.reload();
  await expect(page.getByRole('alert').first()).toContainText('could not be read');
  expect(await page.evaluate(() => localStorage.getItem('scene-forge.scene.v2.corrupt'))).toContain(
    'oops',
  );
  await expect(page.getByRole('button', { name: 'Download the unreadable copy' })).toBeVisible();
});

test('presets: save, reopen from the gallery, delete', async ({ page }) => {
  await useTemplate(page, 'trade-route');
  await page.getByTestId('scene-title').fill('My route');
  await page.getByRole('button', { name: 'Save as preset' }).click();
  await useTemplate(page, 'timeline');
  await openView(page, 'Gallery');
  await expect(page.getByTestId('presets')).toContainText('My route');
  await page.getByRole('button', { name: 'Open My route' }).click();
  await expect(page.getByTestId('scene-title')).toHaveValue('My route');
  await openView(page, 'Gallery');
  await page.getByRole('button', { name: 'Delete My route' }).click();
  await expect(page.getByText('No presets yet.')).toBeVisible();
});

test('deep link and hard refresh under /scene-forge/', async ({ page }) => {
  await page.goto('./#/gallery');
  await expect(page.getByTestId('templates')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('templates')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/scene-forge/');
  await openView(page, 'About');
  await expect(page.getByText('not geographically accurate').first()).toBeVisible();
});

test('accessible names everywhere and no horizontal overflow at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const view of ['Editor', 'Gallery', 'About'] as const) {
    await openView(page, view);
    if (view === 'Editor') await page.getByTestId('pick-attacker-1').click();
    const problems = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(
        document.querySelectorAll<HTMLElement>('input, select, button'),
      )) {
        if (el.offsetParent === null && el.getAttribute('type') !== 'file') continue;
        const input = el as HTMLInputElement;
        const named =
          el.getAttribute('aria-label') ||
          (input.labels && input.labels.length > 0) ||
          (el.tagName === 'BUTTON' && (el.textContent ?? '').trim() !== '');
        if (!named) bad.push(el.outerHTML.slice(0, 90));
      }
      if (document.documentElement.scrollWidth > window.innerWidth) {
        bad.push(`overflow ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
      }
      return bad;
    });
    expect(problems, view).toEqual([]);
  }
});

test('screenshots: desktop, mobile, dark', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await useTemplate(page, 'encirclement');
  await page.getByTestId('pick-defender-2').click();
  await page.screenshot({ path: 'docs/screenshots/desktop-editor.png', fullPage: true });
  await openView(page, 'Gallery');
  await page.screenshot({ path: 'docs/screenshots/desktop-gallery.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await openView(page, 'Editor');
  await page.screenshot({ path: 'docs/screenshots/mobile-editor.png', fullPage: true });
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'docs/screenshots/desktop-editor-dark.png', fullPage: true });
  await expect(nav(page)).toBeVisible();
});
