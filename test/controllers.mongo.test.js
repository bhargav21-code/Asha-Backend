const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const Anganwadi = require('../models/Anganwadi');
const Woman = require('../models/Woman');
const Child = require('../models/Child');
const FollowUp = require('../models/FollowUp');
const { Family, Visit } = require('../models');
const anganwadiController = require('../controllers/anganwadiController');
const crudController = require('../controllers/crudController');
const womanController = require('../controllers/womanController');
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
  const otherOwnerId = new mongoose.Types.ObjectId();
  const fixtures = {
    anganwadi: [],
    families: [],
    women: [],
    children: [],
    followUps: [],
  };

  try {
    // Anganwadi: partial facility updates preserve sibling fields.
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
    fixtures.anganwadi.push(anganwadi._id);
    const originalAnganwadiChildId = anganwadi.children[0]._id.toString();

    const facilityUpdate = await invoke(anganwadiController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString() },
      body: { facility: { drinking_water: true } },
    });
    assert.equal(facilityUpdate.statusCode, 200);
    let refreshedAnganwadi = await Anganwadi.findById(anganwadi._id);
    assert.equal(refreshedAnganwadi.facility.drinking_water, true);
    assert.equal(refreshedAnganwadi.facility.toilet, true);
    assert.equal(refreshedAnganwadi.facility.nutrition_stock, true);

    const replaceAnganwadiChildren = await invoke(anganwadiController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString() },
      body: { children: [{ child_name: 'Replaced Child', age: 5, gender: 'Male' }] },
    });
    assert.equal(replaceAnganwadiChildren.statusCode, 400);
    refreshedAnganwadi = await Anganwadi.findById(anganwadi._id);
    assert.equal(refreshedAnganwadi.children.length, 1);
    assert.equal(refreshedAnganwadi.children[0]._id.toString(), originalAnganwadiChildId);

    const editAnganwadiChild = await invoke(anganwadiController.updateChild, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString(), childId: originalAnganwadiChildId },
      body: { age: 5, weight: 17.5 },
    });
    assert.equal(editAnganwadiChild.statusCode, 200);
    refreshedAnganwadi = await Anganwadi.findById(anganwadi._id);
    assert.equal(refreshedAnganwadi.children[0].age, 5);
    assert.equal(refreshedAnganwadi.children[0].weight, 17.5);
    assert.equal(refreshedAnganwadi.children[0]._id.toString(), originalAnganwadiChildId);

    const otherOwnerRead = await invoke(anganwadiController.getOne, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString() },
    });
    assert.equal(otherOwnerRead.statusCode, 404);
    const otherOwnerUpdate = await invoke(anganwadiController.update, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString() },
      body: { village: 'Other Village' },
    });
    assert.equal(otherOwnerUpdate.statusCode, 404);
    const otherOwnerChildUpdate = await invoke(anganwadiController.updateChild, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: anganwadi._id.toString(), childId: originalAnganwadiChildId },
      body: { age: 6 },
    });
    assert.equal(otherOwnerChildUpdate.statusCode, 404);

    // Anganwadi create distinguishes invalid user input from database failures.
    const originalCreate = Anganwadi.create;
    try {
      Anganwadi.create = async () => { throw new Error('simulated database outage'); };
      const databaseFailure = await invoke(anganwadiController.create, {
        user: { _id: ownerId, role: 'ASHA' }, body: {},
      });
      assert.equal(databaseFailure.statusCode, 500);

      Anganwadi.create = async () => { throw new mongoose.Error.ValidationError(); };
      const validationFailure = await invoke(anganwadiController.create, {
        user: { _id: ownerId, role: 'ASHA' }, body: {},
      });
      assert.equal(validationFailure.statusCode, 400);
    } finally {
      Anganwadi.create = originalCreate;
    }

    // Cross-ASHA reference fixtures for child and visit ownership validation.
    const otherWoman = await Woman.create({
      name: 'Other Owner Woman',
      age: 27,
      village: 'Other Village',
      asha_id: otherOwnerId,
    });
    fixtures.women.push(otherWoman._id);
    const otherFamily = await Family.create({
      head_name: 'Other Owner Household',
      village: 'Other Village',
      asha_id: otherOwnerId,
      members: [{ name: 'Other Member', age: 40 }],
    });
    fixtures.families.push(otherFamily._id);

    const ownedChild = await Child.create({
      name: 'Owned Child',
      dob: new Date('2022-01-01T00:00:00.000Z'),
      gender: 'Female',
      village: 'Test Village',
      asha_id: ownerId,
    });
    fixtures.children.push(ownedChild._id);

    const createChildWithForeignMother = await invoke(crudController.createChild, {
      user: { _id: ownerId, role: 'ASHA' },
      body: {
        name: 'Invalid Reference Child',
        dob: '2022-03-01T00:00:00.000Z',
        gender: 'Female',
        village: 'Test Village',
        mother_id: otherWoman._id.toString(),
      },
    });
    assert.equal(createChildWithForeignMother.statusCode, 404);

    const createChildWithForeignFamily = await invoke(crudController.createChild, {
      user: { _id: ownerId, role: 'ASHA' },
      body: {
        name: 'Invalid Family Child',
        dob: '2022-04-01T00:00:00.000Z',
        gender: 'Male',
        village: 'Test Village',
        family_id: otherFamily._id.toString(),
      },
    });
    assert.equal(createChildWithForeignFamily.statusCode, 404);

    const updateChildWithForeignMother = await invoke(crudController.updateChild, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: ownedChild._id.toString() },
      body: { mother_id: otherWoman._id.toString() },
    });
    assert.equal(updateChildWithForeignMother.statusCode, 404);

    const updateChildWithForeignFamily = await invoke(crudController.updateChild, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: ownedChild._id.toString() },
      body: { family_id: otherFamily._id.toString() },
    });
    assert.equal(updateChildWithForeignFamily.statusCode, 404);

    const otherOwnerChildRead = await invoke(crudController.getChild, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: ownedChild._id.toString() },
    });
    assert.equal(otherOwnerChildRead.statusCode, 404);
    const otherOwnerChildEdit = await invoke(crudController.updateChild, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: ownedChild._id.toString() },
      body: { village: 'Other Village' },
    });
    assert.equal(otherOwnerChildEdit.statusCode, 404);

    const createVisitWithForeignFamily = await invoke(crudController.createVisit, {
      user: { _id: ownerId, role: 'ASHA' },
      body: { village: 'Test Village', visit_type: 'General', family_id: otherFamily._id.toString() },
    });
    assert.equal(createVisitWithForeignFamily.statusCode, 404);

    const createVisitWithForeignWoman = await invoke(crudController.createVisit, {
      user: { _id: ownerId, role: 'ASHA' },
      body: {
        village: 'Test Village',
        visit_type: 'General',
        individual_type: 'Woman',
        individual_id: otherWoman._id.toString(),
      },
    });
    assert.equal(createVisitWithForeignWoman.statusCode, 404);

    // Family: partial household updates preserve sibling fields.
    const family = await Family.create({
      head_name: 'Test Household',
      village: 'Test Village',
      asha_id: ownerId,
      conditions: { toilet: false, water_source: 'Well', electricity: true, lpg: true },
      members: [{ name: 'Existing Member', age: 30, relation: 'Spouse' }],
    });
    fixtures.families.push(family._id);
    const originalMemberId = family.members[0]._id.toString();

    const familyUpdate = await invoke(crudController.updateFamily, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: family._id.toString() },
      body: { conditions: { toilet: true } },
    });
    assert.equal(familyUpdate.statusCode, 200);
    let refreshedFamily = await Family.findById(family._id);
    assert.equal(refreshedFamily.conditions.toilet, true);
    assert.equal(refreshedFamily.conditions.water_source, 'Well');
    assert.equal(refreshedFamily.conditions.electricity, true);

    const replaceFamilyMembers = await invoke(crudController.updateFamily, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: family._id.toString() },
      body: { members: [{ name: 'Replacement Member' }] },
    });
    assert.equal(replaceFamilyMembers.statusCode, 400);

    const editFamilyMember = await invoke(crudController.updateFamilyMember, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: family._id.toString(), memberId: originalMemberId },
      body: { age: 31, conditions: { bp: true } },
    });
    assert.equal(editFamilyMember.statusCode, 200);
    refreshedFamily = await Family.findById(family._id);
    assert.equal(refreshedFamily.members.length, 1);
    assert.equal(refreshedFamily.members[0].age, 31);
    assert.equal(refreshedFamily.members[0].conditions.bp, true);
    assert.equal(refreshedFamily.members[0]._id.toString(), originalMemberId);

    const otherOwnerFamilyRead = await invoke(crudController.getFamily, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: family._id.toString() },
    });
    assert.equal(otherOwnerFamilyRead.statusCode, 404);
    const otherOwnerFamilyEdit = await invoke(crudController.updateFamilyMember, {
      user: { _id: otherOwnerId, role: 'ASHA' },
      params: { id: family._id.toString(), memberId: originalMemberId },
      body: { age: 50 },
    });
    assert.equal(otherOwnerFamilyEdit.statusCode, 404);

    // Woman: dotted metric updates recalculate high-risk from all persisted metrics.
    const woman = await Woman.create({
      name: 'Test Pregnant Woman',
      age: 28,
      village: 'Test Village',
      asha_id: ownerId,
      pregnancy_status: true,
      medical_metrics: { hemoglobin: 12, bp_sys: 120, bp_dia: 80, diabetes: false, thyroid: false },
    });
    fixtures.women.push(woman._id);
    assert.equal(woman.high_risk, false);

    const highRiskUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { bp_sys: 160 } },
    });
    assert.equal(highRiskUpdate.statusCode, 200);
    let refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.medical_metrics.hemoglobin, 12);
    assert.equal(refreshedWoman.medical_metrics.bp_sys, 160);
    assert.equal(refreshedWoman.high_risk, true);

    const clearHighRiskUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { bp_sys: 120 } },
    });
    assert.equal(clearHighRiskUpdate.statusCode, 200);
    refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.high_risk, false);

    const anemiaUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { hemoglobin: 10 } },
    });
    assert.equal(anemiaUpdate.statusCode, 200);
    const otherMetricUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { bp_sys: 120 } },
    });
    assert.equal(otherMetricUpdate.statusCode, 200);
    refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.medical_metrics.hemoglobin, 10);
    assert.equal(refreshedWoman.high_risk, true);

    // Follow-Up: generic updates cannot replace history; append preserves prior IDs.
    const followUp = await FollowUp.create({
      asha_id: ownerId,
      patient_name: 'Test Patient',
      next_followup_date: new Date('2030-01-01T00:00:00.000Z'),
      visit_history: [{ visit_date: new Date('2026-01-01T00:00:00.000Z'), observations: 'Original entry' }],
    });
    fixtures.followUps.push(followUp._id);
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
    let historyAfterUpdate = await FollowUp.findById(followUp._id);
    assert.equal(historyAfterUpdate.visit_history.length, 1);
    assert.equal(historyAfterUpdate.visit_history[0]._id.toString(), originalVisitId);

    const appendHistory = await invoke(followUpController.addVisitHistory, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: followUp._id.toString() },
      body: { visit_date: '2026-02-01T00:00:00.000Z', observations: 'Appended entry' },
    });
    assert.equal(appendHistory.statusCode, 201);
    historyAfterUpdate = await FollowUp.findById(followUp._id);
    assert.equal(historyAfterUpdate.visit_history.length, 2);
    assert.equal(historyAfterUpdate.visit_history[0]._id.toString(), originalVisitId);
    assert.equal(historyAfterUpdate.visit_history[1].observations, 'Appended entry');

    process.stdout.write('MongoDB controller integration checks passed\n');
  } finally {
    if (fixtures.anganwadi.length) await Anganwadi.deleteMany({ _id: { $in: fixtures.anganwadi } });
    if (fixtures.families.length) await Family.deleteMany({ _id: { $in: fixtures.families } });
    if (fixtures.women.length) await Woman.deleteMany({ _id: { $in: fixtures.women } });
    if (fixtures.children.length) await Child.deleteMany({ _id: { $in: fixtures.children } });
    if (fixtures.followUps.length) await FollowUp.deleteMany({ _id: { $in: fixtures.followUps } });
    await mongoose.disconnect();
  }
}

run().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
