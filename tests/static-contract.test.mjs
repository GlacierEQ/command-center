import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const app = read('assets/app.js');
const adapterSource = read('assets/data-contract.js');
const migration = read('supabase/migrations/20260812_ops_plane.sql');

function loadContract() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(adapterSource, context, { filename: 'assets/data-contract.js' });
  return context.CC_DATA_CONTRACT;
}

test('browser loads the data contract before application execution', () => {
  const contractAt = index.indexOf('assets/data-contract.js');
  const appAt = index.indexOf('assets/app.js');
  assert.ok(contractAt >= 0, 'data contract script is missing');
  assert.ok(appAt > contractAt, 'application executes before data contract is installed');
});

test('every table requested by the dashboard resolves to an ops-plane view', () => {
  const contract = loadContract();
  const requested = [...app.matchAll(/\.from\(["']([^"']+)["']\)/g)].map((match) => match[1]);
  assert.ok(requested.length >= 5, 'dashboard no longer exposes its Supabase read set');
  for (const table of requested) {
    assert.ok(contract.TABLE_MAP[table], `dashboard table is outside ops-plane contract: ${table}`);
    assert.match(contract.TABLE_MAP[table], /^ops_plane_/);
  }
});

test('adapter translates legacy logical names and refuses arbitrary tables', () => {
  const contract = loadContract();
  const seen = [];
  const namespace = {
    createClient() {
      return {
        from(name) {
          seen.push(name);
          return { resolved: name };
        }
      };
    }
  };

  contract.install(namespace);
  const client = namespace.createClient('url', 'anon');
  assert.deepEqual(client.from('apex_connector_status'), { resolved: 'ops_plane_connector_status' });
  assert.deepEqual(client.from('everything_mcp_domains'), { resolved: 'ops_plane_mcp_domains' });
  assert.deepEqual(seen, ['ops_plane_connector_status', 'ops_plane_mcp_domains']);
  assert.throws(() => client.from('legal_case_evidence'), /refused non-ops-plane table/);
});

test('public view contract contains no legal, court, case, claim, or evidence surface', () => {
  const contract = loadContract();
  const exposed = Object.values(contract.TABLE_MAP);
  assert.ok(exposed.length >= 6);
  for (const name of exposed) {
    assert.doesNotMatch(name, /(legal|court|evidence|claim|case)/i);
  }
});

test('migration creates and grants every mapped public view', () => {
  const contract = loadContract();
  const views = [...new Set(Object.values(contract.TABLE_MAP))];
  for (const view of views) {
    assert.match(migration, new RegExp(`create\\s+or\\s+replace\\s+view\\s+public\\.${view}`, 'i'), `missing view ${view}`);
    assert.match(migration, new RegExp(`grant\\s+select\\s+on\\s+public\\.${view}\\s+to\\s+anon`, 'i'), `missing anon grant ${view}`);
  }
});

test('migration does not grant anon access to named legal/court/evidence objects', () => {
  const anonGrants = [...migration.matchAll(/grant\s+[^;]+\s+to\s+anon[^;]*;/gi)].map((match) => match[0]);
  assert.ok(anonGrants.length > 0, 'migration has no anon grants to inspect');
  for (const grant of anonGrants) {
    assert.doesNotMatch(grant, /(legal|court|evidence|claim|case)/i);
  }
});
