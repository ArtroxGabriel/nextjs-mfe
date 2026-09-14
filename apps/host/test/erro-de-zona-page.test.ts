import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * `/erro-de-zona` must render with every zone down, and must say the same
 * thing as the fallback middleware.ts serves in its place. The page is
 * rendered for real here, through the resolution hooks above, so a page
 * that stops using the shared copy fails even if it still imports it.
 *
 * Network access is checked at the two points a server ever runs this page:
 * module load and render. A fetch inside an effect runs only in the browser,
 * and react-dom/server never runs effects, so that one is not covered here.
 */

type PageModule = typeof import('../pages/erro-de-zona.tsx');
type ZoneErrorContent = typeof import('../lib/zoneErrorContent.ts');

const OUTAGE_COPY_FIELDS = ['ZONE_ERROR_HEADING', 'ZONE_ERROR_MESSAGE', 'ZONE_ERROR_RETRY_HINT'] as const;

let pageModule: PageModule;
let zoneErrorContent: ZoneErrorContent;
let renderZoneErrorHtml: () => string;
let renderPage: () => string;
let fetchCallsWhileLoadingPage = 0;

test.before(async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');

  const loadFetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('the outage page must not fetch anything while loading');
  });
  try {
    pageModule = await import('../pages/erro-de-zona.tsx');
  } finally {
    fetchCallsWhileLoadingPage = loadFetchMock.mock.callCount();
    loadFetchMock.mock.restore();
  }

  zoneErrorContent = await import('../lib/zoneErrorContent.ts');
  renderZoneErrorHtml = (await import('../lib/zoneErrorPage.ts')).renderZoneErrorHtml;
  renderPage = () => renderToStaticMarkup(createElement(pageModule.default));
});

test.afterEach(() => {
  mock.restoreAll();
});

test('loading the page module does not touch the network', () => {
  assert.equal(fetchCallsWhileLoadingPage, 0);
});

test('the page renders without touching the network', () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    throw new Error('the outage page must not fetch anything');
  });

  renderPage();

  assert.equal(fetchMock.mock.callCount(), 0);
});

test('the page has no data fetching Next would run before rendering it', () => {
  for (const hook of ['getServerSideProps', 'getStaticProps', 'getInitialProps']) {
    assert.equal(hook in pageModule, false, `pages/erro-de-zona.tsx must not export ${hook}`);
  }
  assert.equal('getInitialProps' in pageModule.default, false);
});

for (const field of OUTAGE_COPY_FIELDS) {
  test(`the page and the middleware fallback both show ${field}`, () => {
    const text = zoneErrorContent[field];
    assert.ok(text.trim().length > 0, `${field} must not be empty`);

    assert.ok(renderPage().includes(text), 'missing from the rendered page');
    assert.ok(renderZoneErrorHtml().includes(text), 'missing from the middleware fallback');
  });
}
