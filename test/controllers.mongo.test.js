const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createHmac } = require('node:crypto');

// The integration suite tests OTP verification only; email delivery is not invoked.
process.env.RESEND_API_KEY ||= 're_integration_test_dummy_key';
const Anganwadi = require('../models/Anganwadi');
const Woman = require('../models/Woman');
const Child = require('../models/Child');
const FollowUp = require('../models/FollowUp');
const User = require('../models/User');
const { Family, Visit } = require('../models');
const anganwadiController = require('../controllers/anganwadiController');
const crudController = require('../controllers/crudController');
const womanController = require('../controllers/womanController');
const followUpController = require('../controllers/followUpController');
const adminController = require('../controllers/adminController');
const authController = require('../controllers/authController');

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
  process.env.JWT_SECRET ||= 'isolated-mongodb-integration-test-secret';
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
    users: [],
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

    // Correcting DOB and growth measurements must run the Child save derivations.
    const dob24MonthsAgo = new Date(Date.now() - 24 * 30.44 * 24 * 60 * 60 * 1000);
    const childDerivationUpdate = await invoke(crudController.updateChild, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: ownedChild._id.toString() },
      body: { dob: dob24MonthsAgo.toISOString(), growth_metrics: { weight: 7 } },
    });
    assert.equal(childDerivationUpdate.statusCode, 200);
    let derivedChild = await Child.findById(ownedChild._id);
    assert.equal(derivedChild.age_months, 24);
    assert.equal(derivedChild.nutrition_status, 'Severe Malnutrition');

    const measurementCorrection = await invoke(crudController.updateChild, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: ownedChild._id.toString() },
      body: { growth_metrics: { weight: 11 } },
    });
    assert.equal(measurementCorrection.statusCode, 200);
    derivedChild = await Child.findById(ownedChild._id);
    assert.equal(derivedChild.nutrition_status, 'Normal');

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

    // The high-risk flag is derived only; clients cannot set it directly on create/update.
    const manualRiskWoman = await invoke(womanController.create, {
      user: { _id: ownerId, role: 'ASHA' },
      body: { name: 'Manual Risk Flag', age: 30, village: 'Test Village', high_risk: true },
    });
    assert.equal(manualRiskWoman.statusCode, 201);
    fixtures.women.push(manualRiskWoman.body.data._id);
    assert.equal(manualRiskWoman.body.data.high_risk, false);

    const directRiskOverride = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { high_risk: false },
    });
    assert.equal(directRiskOverride.statusCode, 400);

    const diabetesCastUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { hemoglobin: 12, diabetes: 'yes' } },
    });
    assert.equal(diabetesCastUpdate.statusCode, 200);
    refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.medical_metrics.diabetes, true);
    assert.equal(refreshedWoman.high_risk, true);

    const clearDiabetesUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { diabetes: 'no' } },
    });
    assert.equal(clearDiabetesUpdate.statusCode, 200);
    refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.medical_metrics.diabetes, false);
    assert.equal(refreshedWoman.high_risk, false);

    const thyroidCastUpdate = await invoke(womanController.update, {
      user: { _id: ownerId, role: 'ASHA' },
      params: { id: woman._id.toString() },
      body: { medical_metrics: { thyroid: '1' } },
    });
    assert.equal(thyroidCastUpdate.statusCode, 200);
    refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.medical_metrics.thyroid, true);
    assert.equal(refreshedWoman.high_risk, true);

    // Optimistic concurrency rejects a stale metric snapshot rather than overwriting
    // a newer risk calculation with a calculation based on old metrics.
    const concurrentA = await Woman.findById(woman._id);
    const concurrentB = await Woman.findById(woman._id);
    concurrentA.set('medical_metrics.hemoglobin', 10);
    concurrentB.set('medical_metrics.bp_sys', 120);
    await concurrentA.save();
    await assert.rejects(
      concurrentB.save(),
      error => error.name === 'VersionError'
    );
    refreshedWoman = await Woman.findById(woman._id);
    assert.equal(refreshedWoman.medical_metrics.hemoglobin, 10);
    assert.equal(refreshedWoman.high_risk, true);

    // Completed password cleanup only updates records that still contain a value.
    const userSuffix = new mongoose.Types.ObjectId().toString();
    const cleanupTarget = await User.create({
      name: 'Cleanup Target',
      username: `cleanup-target-${userSuffix}`,
      change_request: { type: 'password', status: 'approved', new_value: 'legacy-value' },
    });
    fixtures.users.push(cleanupTarget._id);
    const alreadyCleaned = await User.create({
      name: 'Already Cleaned',
      username: `already-cleaned-${userSuffix}`,
      change_request: { type: 'password', status: 'approved' },
    });
    fixtures.users.push(alreadyCleaned._id);
    const legacyPending = await User.create({
      name: 'Legacy Pending',
      username: `legacy-pending-${userSuffix}`,
      change_request: { type: 'password', status: 'pending', new_value: 'unverified-value' },
    });
    fixtures.users.push(legacyPending._id);
    const alreadyCleanedUpdatedAt = alreadyCleaned.updatedAt.getTime();

    await new Promise(resolve => setTimeout(resolve, 20));
    const cleanupResponse = await invoke(adminController.getChangeRequests, {
      user: { _id: ownerId, role: 'Admin' },
      params: {},
      body: {},
    });
    assert.equal(cleanupResponse.statusCode, 200);
    const cleanedTarget = await User.findById(cleanupTarget._id);
    const unchangedCleaned = await User.findById(alreadyCleaned._id);
    const cancelledPending = await User.findById(legacyPending._id);
    assert.equal(cleanedTarget.change_request.new_value, undefined);
    assert.equal(unchangedCleaned.updatedAt.getTime(), alreadyCleanedUpdatedAt);
    assert.equal(cancelledPending.change_request.status, 'rejected');
    assert.equal(cancelledPending.change_request.new_value, undefined);

    // A recent fifth-attempt reservation is still active and must not be
    // mistaken for a crashed process by a concurrent verification request.
    const otpCode = '482761';
    const otpEmail = `otp-race-${userSuffix}@example.test`;
    const otpDigest = createHmac('sha256', process.env.JWT_SECRET).update(otpCode).digest('hex');
    const activeAttemptStartedAt = new Date();
    const otpUser = await User.create({
      name: 'OTP Race User',
      username: `otp-race-${userSuffix}`,
      email: otpEmail,
      otp: otpDigest,
      otp_expires: new Date(Date.now() + 10 * 60 * 1000),
      otp_attempts: 5,
      otp_attempt_started_at: activeAttemptStartedAt,
    });
    fixtures.users.push(otpUser._id);

    const concurrentVerify = await invoke(authController.verifyOTP, {
      body: { email: otpEmail, otp: otpCode, new_password: 'first-concurrent-password' },
    });
    assert.equal(concurrentVerify.statusCode, 400);
    const stillActiveAttempt = await User.findById(otpUser._id)
      .select('+otp +otp_attempt_started_at +otp_attempts +otp_locked_until');
    assert.equal(stillActiveAttempt.otp, otpDigest);
    assert.equal(stillActiveAttempt.otp_attempts, 5);
    assert.equal(stillActiveAttempt.otp_attempt_started_at.getTime(), activeAttemptStartedAt.getTime());
    assert.equal(stillActiveAttempt.otp_locked_until, undefined);

    // Simulate the original in-flight request finishing after its password hash.
    const activePasswordHash = await bcrypt.hash('first-concurrent-password', 12);
    const finishActiveAttempt = await User.updateOne(
      {
        _id: otpUser._id,
        otp: otpDigest,
        otp_attempts: { $lte: 5 },
        otp_attempt_started_at: activeAttemptStartedAt,
      },
      {
        $set: { password: activePasswordHash, otp_attempts: 0 },
        $unset: { otp: 1, otp_expires: 1, otp_attempt_started_at: 1 },
      }
    );
    assert.equal(finishActiveAttempt.matchedCount, 1);
    const resetUser = await User.findById(otpUser._id)
      .select('+password +otp_attempt_started_at +otp_attempts +otp');
    assert.equal(resetUser.otp, undefined);
    assert.equal(resetUser.otp_attempt_started_at, undefined);
    assert.equal(resetUser.otp_attempts, 0);
    assert.equal(await bcrypt.compare('first-concurrent-password', resetUser.password), true);

    // A genuinely abandoned fifth-attempt reservation is still recovered.
    const abandonedEmail = `otp-abandoned-${userSuffix}@example.test`;
    const abandonedStartedAt = new Date(Date.now() - 3 * 60 * 1000);
    const abandonedOtpUser = await User.create({
      name: 'Abandoned OTP User',
      username: `otp-abandoned-${userSuffix}`,
      email: abandonedEmail,
      otp: createHmac('sha256', process.env.JWT_SECRET).update(otpCode).digest('hex'),
      otp_expires: new Date(Date.now() + 10 * 60 * 1000),
      otp_attempts: 5,
      otp_attempt_started_at: abandonedStartedAt,
    });
    fixtures.users.push(abandonedOtpUser._id);

    const recoverAbandonedAttempt = await invoke(authController.verifyOTP, {
      body: { email: abandonedEmail, otp: otpCode, new_password: 'recovery-password' },
    });
    assert.equal(recoverAbandonedAttempt.statusCode, 400);
    const recoveredUser = await User.findById(abandonedOtpUser._id)
      .select('+otp +otp_attempt_started_at +otp_locked_until');
    assert.ok(recoveredUser.otp_locked_until > new Date());
    assert.equal(recoveredUser.otp, undefined);
    assert.equal(recoveredUser.otp_attempt_started_at, undefined);

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
    if (fixtures.users.length) await User.deleteMany({ _id: { $in: fixtures.users } });
    await mongoose.disconnect();
  }
}

run().catch(error => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
