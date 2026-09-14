import test from 'node:test';
import assert from 'node:assert/strict';
import './support/register-next-resolution.ts';

/**
 * `/erro-de-zona` must render with every zone down, and must say the same
 * thing as the fallback middleware.ts serves in its place. The page is
 * rendered for real here, through the resolution hooks above, so a page
 * that stops using the shared copy fails even if it still imports it.
 *
 * Network access is checked at the two points a server ever runs this page,
 * module load and render, including work they defer with a timer. A fetch
 * inside an effect runs only in the browser, and react-dom/server never runs
 * effects, so that one is not covered here.
 */

type PageModule = typeof import('../pages/erro-de-zona.tsx');
type ZoneErrorContent = typeof import('../lib/zoneErrorContent.ts');

const OUTAGE_COPY_FIELDS = ['ZONE_ERROR_HEADING', 'ZONE_ERROR_MESSAGE', 'ZONE_ERROR_RETRY_HINT'] as const;

let pageModule: PageModule;
let zoneErrorContent: ZoneErrorContent;
let renderZoneErrorHtml: () => string;
let renderPage: () => string;
// Every fetch made while this file runs is recorded, from before the page
// is imported until the last test, so a call deferred with a timer at module
// scope is still seen.
const fetchCalls: string[] = [];
const realFetch = globalThis.fetch;
let fetchCallsWhileLoadingPage = 0;

test.before(async () => {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');

  globalThis.fetch = async (input: string | URL | Request) => {
    fetchCalls.push(String(input));
    throw new Error('the outage page must not fetch anything');
  };
  pageModule = await import('../pages/erro-de-zona.tsx');
  await new Promise((resolve) => setTimeout(resolve, 20));
  fetchCallsWhileLoadingPage = fetchCalls.length;

  zoneErrorContent = await import('../lib/zoneErrorContent.ts');
  renderZoneErrorHtml = (await import('../lib/zoneErrorPage.ts')).renderZoneErrorHtml;
  renderPage = () => renderToStaticMarkup(createElement(pageModule.default));
});

test.after(() => {
  globalThis.fetch = realFetch;
});

test('loading the page module does not touch the network', () => {
  assert.equal(fetchCallsWhileLoadingPage, 0, `fetched ${JSON.stringify(fetchCalls)}`);
});

test('the page renders without touching the network', () => {
  const before = fetchCalls.length;

  renderPage();

  assert.equal(fetchCalls.length, before, `fetched ${JSON.stringify(fetchCalls.slice(before))}`);
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

test('nothing in the page fetched at any point while this file ran', () => {
  assert.deepEqual(fetchCalls, []);
});
