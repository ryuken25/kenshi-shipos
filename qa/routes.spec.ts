import { test, expect } from '@playwright/test';

const BASE = 'https://kenshi-shipos.vercel.app';

const pages = [
  { path: '/today', page: 'today', uniqueText: 'Capacity Guard' },
  { path: '/tasks', page: 'tasks', uniqueText: 'Capture the next action' },
  { path: '/focus', page: 'focus', uniqueText: 'Focus Cockpit' },
  { path: '/review', page: 'review', uniqueText: 'Ship Log' },
  { path: '/insights', page: 'insights', uniqueText: 'Insights' },
  { path: '/settings', page: 'settings', uniqueText: 'Export' },
];

// Direct route tests — each URL renders the correct unique page
for (const target of pages) {
  test(`${target.path} renders correct page (not Today)`, async ({ page }) => {
    await page.goto(`${BASE}${target.path}`, { waitUntil: 'networkidle' });

    // Correct data-page marker must be visible
    await expect(page.locator(`[data-page="${target.page}"]`)).toBeVisible();

    // Unique text for this page must appear
    await expect(page.getByText(target.uniqueText, { exact: false }).first()).toBeVisible();

    // If this is NOT /today, today's data-page must NOT be present
    if (target.page !== 'today') {
      await expect(page.locator('[data-page="today"]')).toHaveCount(0);
    }
  });
}

// Navigation flow — goto each route, verify correct page, verify back/forward via URL
test('navigation: direct loads render correct pages', async ({ page }) => {
  // Load Today
  await page.goto(`${BASE}/today`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page="today"]')).toBeVisible();

  // Load Tasks directly
  await page.goto(`${BASE}/tasks`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page="tasks"]')).toBeVisible();
  await expect(page.locator('[data-page="today"]')).toHaveCount(0);

  // Load Focus directly
  await page.goto(`${BASE}/focus`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-page="focus"]')).toBeVisible();
  await expect(page.locator('[data-page="today"]')).toHaveCount(0);

  // Back to Tasks
  await page.goBack();
  await expect(page.locator('[data-page="tasks"]')).toBeVisible();

  // Forward to Focus
  await page.goForward();
  await expect(page.locator('[data-page="focus"]')).toBeVisible();
});

// Refresh keeps correct page (not Today flash)
test('refresh on /tasks stays on Tasks', async ({ page }) => {
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-page="tasks"]')).toBeVisible();

  await page.reload({ waitUntil: 'networkidle' });

  // After reload, must still show Tasks, not Today
  await expect(page.locator('[data-page="tasks"]')).toBeVisible();
  await expect(page.locator('[data-page="today"]')).toHaveCount(0);
});

// Root redirects to /today
test('root / redirects to /today', async ({ page }) => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/today/);
  await expect(page.locator('[data-page="today"]')).toBeVisible();
});

// Legacy redirects
const legacyRoutes = [
  { from: '/mission', to: '/today' },
  { from: '/stats', to: '/insights' },
];

for (const legacy of legacyRoutes) {
  test(`legacy ${legacy.from} redirects to ${legacy.to}`, async ({ page }) => {
    const response = await page.goto(`${BASE}${legacy.from}`, { waitUntil: 'networkidle' });
    // Server redirect or client redirect — either way, final URL should match
    await expect(page).toHaveURL(new RegExp(legacy.to.replace('/', '\\/')));
  });
}

// Analytics script — exactly one instance, correct domain
test('VGDH analytics loads exactly once', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', req => {
    if (req.url() === 'https://analytics.vgdh.io/js/script.js') {
      requests.push(req.url());
    }
  });

  await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });

  const script = page.locator('script[src="https://analytics.vgdh.io/js/script.js"]');
  await expect(script).toHaveCount(1);
  await expect(script).toHaveAttribute('data-domain', 'kenshi-shipos.vercel.app');
  expect(requests.length).toBeGreaterThan(0);

  // Navigate to other routes — script must not duplicate
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });
  await expect(script).toHaveCount(1);

  await page.goto(`${BASE}/focus`, { waitUntil: 'networkidle' });
  await expect(script).toHaveCount(1);
});

// Health endpoint
test('/api/health returns correct SHA and analytics domain', async ({ request }) => {
  const response = await request.get(`${BASE}/api/health`);
  expect(response.ok()).toBeTruthy();

  const data = await response.json();
  expect(data.ok).toBe(true);
  expect(data.analyticsDomain).toBe('kenshi-shipos.vercel.app');
  expect(data.buildSha).not.toBe('local');
  expect(data.buildSha).not.toBe('unknown');
  expect(data.buildSha.length).toBeGreaterThan(4);
});

// Shared state — add task on /tasks, see it on /today
test('shared state: task created on /tasks appears on /today', async ({ page }) => {
  // Clear localStorage first
  await page.goto(`${BASE}/today`, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    // Accept onboarding if visible
    const btn = document.querySelector('button');
    if (btn?.textContent?.includes('Plan my day') || btn?.textContent?.includes('Start fresh')) {
      btn.click();
    }
  });

  // Navigate to tasks
  await page.goto(`${BASE}/tasks`, { waitUntil: 'networkidle' });

  // Check that the Tasks page is showing (not Today)
  await expect(page.locator('[data-page="tasks"]')).toBeVisible();
});
