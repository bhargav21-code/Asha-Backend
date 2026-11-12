const assert = require('node:assert/strict');
const safeUpdate = require('../utils/safeUpdate');

const fields = {
  facility: {
    drinking_water: true,
    toilet: true,
    electricity: true,
  },
  conditions: {
    toilet: true,
    water_source: true,
    electricity: true,
  },
  medical_metrics: {
    weight: true,
    bp_sys: true,
  },
  active: true,
};

// Partial nested updates must target only the supplied leaf.
assert.deepEqual(
  safeUpdate({ facility: { drinking_water: true } }, fields),
  { 'facility.drinking_water': true }
);
assert.deepEqual(
  safeUpdate({ conditions: { toilet: false }, active: false }, fields),
  { 'conditions.toilet': false, active: false }
);
assert.deepEqual(
  safeUpdate({ medical_metrics: { bp_sys: 120 } }, fields),
  { 'medical_metrics.bp_sys': 120 }
);

// Reject parent-object replacement, unknown fields, and client-supplied dotted paths.
assert.equal(safeUpdate({ facility: null }, fields), null);
assert.equal(safeUpdate({ facility: { unknown: true } }, fields), null);
assert.equal(safeUpdate({ 'facility.toilet': true }, fields), null);
assert.equal(safeUpdate({ facility: {} }, fields), null);

// Scalar fields and null leaf values remain supported.
assert.deepEqual(safeUpdate({ active: false }, fields), { active: false });
assert.deepEqual(safeUpdate({ active: null }, fields), { active: null });

process.stdout.write('safeUpdate regression checks passed\n');
