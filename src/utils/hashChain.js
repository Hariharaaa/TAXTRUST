/**
 * Hash-chained audit log, stored in this browser.
 *
 * What the chain proves: each record links to the one before it, so a changed
 * record no longer matches its hash, and a tax figure that disagrees with its own
 * inputs fails the recomputation. What it cannot prove on its own: someone with
 * access to this browser could rewrite the whole chain and every hash with it.
 * The head hash closes that gap. Share it with your CA when you save, and any
 * later rewrite, including deleting the newest records, no longer matches it.
 */

import { computeTax } from './taxCalculator.js';
import { ENGINE_VERSION } from './taxRules.js';

const STORAGE_KEY = 'taxtrust_audit_chain';
const GENESIS = '0'.repeat(64);
export const EXPORT_FORMAT = 'taxtrust-audit-chain';

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** JSON with sorted keys, so the hash does not depend on key order. */
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** v1 records came from the first version of the app and keep its hash format. */
export function computeHash(record, previousHash = GENESIS) {
  if (record.v === 2) {
    return sha256(canonicalJson({ id: record.id, v: 2, timestamp: record.timestamp, data: record.data, previousHash }));
  }
  return sha256(JSON.stringify({ id: record.id, timestamp: record.timestamp, data: record.data, previousHash }));
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(chain) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chain));
}

/** The record body: inputs plus the figures they produced. */
export function buildRecordData(result) {
  return {
    engineVersion: result.engineVersion,
    fy: result.fy,
    input: result.input,
    summary: summarize(result),
  };
}

function summarize(result) {
  return {
    oldTax: result.oldRegime.totalTax,
    newTax: result.newRegime.totalTax,
    recommended: result.recommended,
    filingRegime: result.filingRegime,
    totalIncome: result.chosen.totalIncome,
    totalTax: result.chosen.totalTax,
    balance: result.balance,
  };
}

export async function appendToChain(result, chain = getHistory()) {
  const previousHash = chain.at(-1)?.hash ?? GENESIS;
  const record = {
    id: crypto.randomUUID(),
    v: 2,
    timestamp: new Date().toISOString(),
    data: buildRecordData(result),
  };
  const sealed = { ...record, hash: await computeHash(record, previousHash), previousHash };
  writeHistory([...chain, sealed]);
  return sealed;
}

/** Re-run the engine on a record's inputs and compare with what was saved. */
export function recomputeRecord(record) {
  if (record.v !== 2) return { status: 'legacy' };
  try {
    const expected = summarize(computeTax(record.data.input));
    const matches = canonicalJson(expected) === canonicalJson(record.data.summary);
    if (matches) return { status: 'match' };
    return { status: record.data.engineVersion === ENGINE_VERSION ? 'mismatch' : 'rules-changed' };
  } catch {
    return { status: 'mismatch' };
  }
}

/**
 * Check every record rather than stopping at the first problem, so the log can
 * show exactly which ones failed.
 */
export async function verifyChain(chain = getHistory(), { expectedHead = '' } = {}) {
  const records = [];
  for (let i = 0; i < chain.length; i++) {
    const record = chain[i];
    const expectedPrevious = i === 0 ? GENESIS : chain[i - 1].hash;
    const linkOk = record.previousHash === expectedPrevious;
    const hashOk = (await computeHash(record, record.previousHash)) === record.hash;
    const recompute = recomputeRecord(record);
    records.push({ id: record.id, index: i, linkOk, hashOk, recompute: recompute.status });
  }

  const brokenAt = records.findIndex((r) => !r.linkOk || !r.hashOk || r.recompute === 'mismatch');
  const head = chain.at(-1)?.hash ?? null;
  const headExpected = expectedHead.trim().toLowerCase();
  const headMatches = headExpected ? head === headExpected : null;

  return {
    valid: brokenAt === -1 && headMatches !== false,
    verifiedCount: records.filter((r) => r.linkOk && r.hashOk && r.recompute !== 'mismatch').length,
    total: chain.length,
    brokenAt: brokenAt === -1 ? null : brokenAt,
    records,
    head,
    headMatches,
  };
}

/** Plain-language result for one record, for any screen that lists them. */
export function rowStatus(row) {
  if (!row) return { label: 'Not checked', className: 'text-muted' };
  if (!row.hashOk || !row.linkOk) return { label: 'Altered', className: 'text-danger' };
  if (row.recompute === 'mismatch') return { label: 'Figures don\'t match', className: 'text-danger' };
  if (row.recompute === 'rules-changed') return { label: 'Intact, older rules', className: 'text-caution' };
  if (row.recompute === 'legacy') return { label: 'Intact, seal only', className: 'text-success' };
  return { label: 'Verified', className: 'text-success' };
}

export function exportChain(chain = getHistory()) {
  return JSON.stringify({
    format: EXPORT_FORMAT,
    version: 2,
    exportedAt: new Date().toISOString(),
    head: chain.at(-1)?.hash ?? null,
    count: chain.length,
    records: chain,
  }, null, 2);
}

/** Parse an exported file. Throws a message fit to show the person. */
export function parseChainFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }
  if (parsed?.format !== EXPORT_FORMAT || !Array.isArray(parsed.records)) {
    throw new Error('This is not a TaxTrust audit log export.');
  }
  const wellFormed = parsed.records.every((r) => r && typeof r === 'object' && typeof r.hash === 'string' && r.data);
  if (!wellFormed) throw new Error('Some records in this file are incomplete.');
  return parsed;
}

export function restoreChain(chain) {
  writeHistory(chain);
}

export function clearChain() {
  localStorage.removeItem(STORAGE_KEY);
}
