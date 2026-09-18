import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(
  readFileSync(
    new URL('../src/app/api/youtube/route.ts', import.meta.url),
    'utf8',
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function route(fetch, env = { GOOGLE_API_KEY: 'test-key' }) {
  const compiledModule = { exports: {} };
  vm.runInNewContext(source, {
    module: compiledModule,
    exports: compiledModule.exports,
    process: { env },
    fetch,
    URLSearchParams,
    AbortSignal,
    require: () => ({
      NextResponse: { json: (data, init) => Response.json(data, init) },
    }),
  });
  return (query = 'lofi') =>
    compiledModule.exports.GET({
      nextUrl: new URL(
        `http://localhost/api/youtube?q=${encodeURIComponent(query)}`,
      ),
    });
}

test('network and invalid JSON failures return a useful JSON error without credentials', async () => {
  for (const fetch of [
    async () => {
      throw new TypeError('fetch failed test-key');
    },
    async () => new Response('bad gateway'),
  ]) {
    const response = await route(fetch)();
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.match(body.message, /connect|unavailable/i);
    assert.ok(!JSON.stringify(body).includes('test-key'));
  }
});

test('blank searches avoid Google and missing configuration is explicit', async () => {
  const fetch = () => assert.fail('must not request Google');
  const empty = await route(fetch)('   ');
  assert.deepEqual(await empty.json(), { items: [] });
  const missing = await route(fetch, {})();
  assert.equal(missing.status, 500);
  assert.match((await missing.json()).message, /configured/i);
});

test('quota failures have a distinct message', async () => {
  const response = await route(async () =>
    Response.json(
      { error: { errors: [{ reason: 'quotaExceeded' }] } },
      { status: 403 },
    ),
  )();
  assert.equal(response.status, 503);
  assert.match((await response.json()).message, /limit/i);
});

test('searches embeddable videos, supports both key names and preserves metadata', async () => {
  for (const name of ['GOOGLE_API_KEY', 'YOUTUBE_API_KEY']) {
    let calls = 0;
    const response = await route(
      async (url, options) => {
        const params = new URL(url).searchParams;
        assert.equal(params.get('key'), 'test-key');
        assert.ok(options.signal instanceof AbortSignal);
        if (calls++ === 0) {
          assert.equal(params.get('q'), 'lofi');
          assert.equal(params.get('videoEmbeddable'), 'true');
          return Response.json({
            items: [
              {
                id: { videoId: 'abc' },
                snippet: {
                  title: 'A &amp; B',
                  channelTitle: 'Music',
                  publishedAt: '2026-01-01',
                  thumbnails: {
                    high: { url: 'https://example.com/thumbnail.jpg' },
                  },
                },
              },
            ],
          });
        }
        return Response.json({
          items: [
            {
              id: 'abc',
              statistics: { viewCount: '100' },
              contentDetails: { duration: 'PT3M5S' },
            },
          ],
        });
      },
      { [name]: 'test-key' },
    )(' lofi ');
    assert.equal(response.status, 200);
    const { items } = await response.json();
    assert.equal(items[0].title, 'A & B');
    assert.equal(items[0].duration, '3:05');
    assert.equal(items[0].viewCount, '100');
    assert.equal(calls, 2);
  }
});
