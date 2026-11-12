const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Anganwadi = require('../models/Anganwadi');
const FollowUp = require('../models/FollowUp');
const { Family } = require('../models');
const anganwadiController = require('../controllers/anganwadiController');
const crudController = require('../controllers/crudController');
const followUpController = require('../controllers/followUpController');

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

async function invoke(handler, req) {
  const res = responseRecorder();
  await handler(req, res);
  return res;
}

async function run() {
  const uri = process.env.MONGO_URI;
  assert.ok(uri, 'MONGO_URI is required for MongoDB integration tests');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const ownerId = new mongoose.Types.ObjectId();
  const fixtures = { anganwadi: null, family: null, followUp: null };

  try {
    const anganwadi = await Anganwadi.create({
      district: 'Test District',
      taluka: 'Test Taluka',
      village: 'Test Village',
      anganwadi_name: 'Test Centre',
      worker_name: 'Test Worker',
      asha_id: ownerId,
      facility: {
        drinking_water: false,
        toilet: true,
        electricity: true,
        nutrition_stock: true,
        building_condition: 'Good',
      },
      children: [{
        child_name: 'Test Child',
        age: 4,
        gender: 'Female',
        present_today: true,
      }],
    });
    fixtures.anganwadi = anganwadi._id;
    const originalChildId = anganwadi.children[0]._id.toString();

    const facilityUpdate = await invoke(anganwadiController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString() },
      body: { facility: { drinking_water: true } },
    });
    assert.equal(facilityUpdate.statusCode, 200);
    const refreshedAnganwadi = await Anganwadi.findById(anganwadi._id);
    assert.equal(refreshedAnganwadi.facility.drinking_water, true);
    assert.equal(refreshedAnganwadi.facility.toilet, true);
    assert.equal(refreshedAnganwadi.facility.nutrition_stock, true);

    const replaceChildren = await invoke(anganwadiController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString() },
      body: { children: [{ child_name: 'Replaced Child', age: 5, gender: 'Male' }] },
    });
    assert.equal(replaceChildren.statusCode, 400);
    const childrenAfterRejectedUpdate = await Anganwadi.findById(anganwadi._id);
    assert.equal(childrenAfterRejectedUpdate.children.length, 1);
    assert.equal(childrenAfterRejectedUpdate.children[0]._id.toString(), originalChildId);

    const family = await Family.create({
      head_name: 'Test Household',
      village: 'Test Village',
      asha_id: ownerId,
      conditions: { toilet: false, water_source: 'Well', electricity: true, lpg: true },
      members: [{ name: 'Existing Member', age: 30, relation: 'Spouse' }],
    });
    fixtures.family = family._id;
    const originalMemberId = family.members[0]._id.toString();

    const familyUpdate = await invoke(crudController.updateFamily, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: family._id.toString() },
      body: { conditions: { toilet: true } },
    });
    assert.equal(familyUpdate.statusCode, 200);
    const refreshedFamily = await Family.findById(family._id);
    assert.equal(refreshedFamily.conditions.toilet, true);
    assert.equal(refreshedFamily.conditions.water_source, 'Well');
    assert.equal(refreshedFamily.conditions.electricity, true);

    const replaceMembers = await invoke(crudController.updateFamily, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: family._id.toString() },
      body: { members: [{ name: 'Replacement Member' }] },
    });
    assert.equal(replaceMembers.statusCode, 400);
    const familyAfterRejectedUpdate = await Family.findById(family._id);
    assert.equal(familyAfterRejectedUpdate.members[0]._id.toString(), originalMemberId);

    const followUp = await FollowUp.create({
      asha_id: ownerId,
      patient_name: 'Test Patient',
      next_followup_date: new Date('2030-01-01T00:00:00.000Z'),
      visit_history: [{ visit_date: new Date('2026-01-01T00:00:00.000Z'), observations: 'Original entry' }],
    });
    fixtures.followUp = followUp._id;
    const originalVisitId = followUp.visit_history[0]._id.toString();

    const replaceHistory = await invoke(followUpController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: followUp._id.toString() },
      body: {
        status: 'Completed',
        visit_history: [{ visit_date: '2026-02-01T00:00:00.000Z', observations: 'Replacement entry' }],
      },
    });
    assert.equal(replaceHistory.statusCode, 400);
    const historyAfterRejectedUpdate = await FollowUp.findById(followUp._id);
    assert.equal(historyAfterRejectedUpdate.visit_history.length, 1);
    assert.equal(historyAfterRejectedUpdate.visit_history[0]._id.toString(), originalVisitId);

    const appendHistory = await invoke(followUpController.addVisitHistory, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: followUp._id.toString() },
      body: { visit_date: '2026-02-01T00:00:00.000Z', observations: 'Appended entry' },
    });
    assert.equal(appendHistory.statusCode, 201);
    const historyAfterAppend = await FollowUp.findById(followUp._id);
    assert.equal(historyAfterAppend.visit_history.length, 2);
    assert.equal(historyAfterAppend.visit_history[0]._id.toString(), originalVisitId);
    assert.equal(historyAfterAppend.visit_history[1].observations, 'Appended entry');

    process.stdout.write('MongoDB controller integration checks passed\n');
  } finally {
    if (fixtures.anganwadi) await Anganwadi.deleteOne({ _id: fixtures.anganwadi });
    if (fixtures.family) await Family.deleteOne({ _id: fixtures.family });
    if (fixtures.followUp) await FollowUp.deleteOne({ _id: fixtures.followUp });
    await mongoose.disconnect();
  }
}

run().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
