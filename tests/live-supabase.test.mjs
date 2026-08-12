import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const configSource = read('config.js');
const adapterSource = read('assets/data-contract.js');

function parseConfig() {
  const matchUrl = configSource.match(/supabaseUrl:\s*"([^"]+)"/);
  const matchKey = configSource.match(/supabaseAnonKey:\s*"([^"]+)"/);
  assert.ok(matchUrl, 'supabaseUrl missing from public config');
  assert.ok(matchKey, 'supabaseAnonKey missing from public config');
  return { url: matchUrl[1], key: matchKey[1] };
}

function publicViews() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(adapterSource, context, { filename: 'assets/data-contract.js' });
  return [...new Set(Object.values(context.CC_DATA_CONTRACT.TABLE_MAP))];
}

for (const view of publicViews()) {
  test(`live anon REST read succeeds for ${view}`, async () => {
    const { url, key } = parseConfig();
    const endpoint = `${url}/rest/v1/${view}?select=*&limit=1`;
    const response = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(15000)
    });
    const body = await response.text();
    assert.equal(response.status, 200, `${view} returned ${response.status}: ${body.slice(0, 500)}`);
    const data = JSON.parse(body);
    assert.ok(Array.isArray(data), `${view} did not return an array`);
  });
}
