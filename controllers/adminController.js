const Woman = require('../models/Woman');
const Child = require('../models/Child');
const { Family, Visit, DailyWorkReport } = require('../models/index');
const User = require('../models/User');

exports.getMetrics = async (req, res) => {
  const [
    totalFamilies,
    totalWomen,
    activePregnancies,
    highRiskPregnancies,
    totalChildren,
    normalChildren,
    moderateMAM,
    severeSAM,
    totalVisitsToday,
    totalASHA,
  ] = await Promise.all([
    Family.countDocuments({ active: true }),
    Woman.countDocuments({ active: true }),
    Woman.countDocuments({ pregnancy_status: true, active: true }),
    Woman.countDocuments({ high_risk: true, pregnancy_status: true }),
    Child.countDocuments({ active: true }),
    Child.countDocuments({ nutrition_status: 'Normal' }),
    Child.countDocuments({ nutrition_status: 'Moderate Malnutrition' }),
    Child.countDocuments({ nutrition_status: 'Severe Malnutrition' }),
    Visit.countDocuments({ date: { $gte: new Date().setHours(0, 0, 0, 0) } }),
    User.countDocuments({ role: 'ASHA', active: true }),
  ]);

  res.json({
    success: true,
    data: {
      families: totalFamilies,
      women: totalWomen,
      active_pregnancies: activePregnancies,
      high_risk_pregnancies: highRiskPregnancies,
      children: totalChildren,
      nutrition: { normal: normalChildren, moderate: moderateMAM, severe: severeSAM },
      today_visits: totalVisitsToday,
      asha_workers: totalASHA,
    },
  });
};

exports.getVillageWiseAnalytics = async (req, res) => {
  const [womenByVillage, childrenByVillage] = await Promise.all([
    Woman.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$village', total: { $sum: 1 }, pregnant: { $sum: { $cond: ['$pregnancy_status', 1, 0] } }, high_risk: { $sum: { $cond: ['$high_risk', 1, 0] } } } },
      { $sort: { total: -1 } },
    ]),
    Child.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$village', total: { $sum: 1 }, severe: { $sum: { $cond: [{ $eq: ['$nutrition_status', 'Severe Malnutrition'] }, 1, 0] } }, moderate: { $sum: { $cond: [{ $eq: ['$nutrition_status', 'Moderate Malnutrition'] }, 1, 0] } } } },
      { $sort: { severe: -1 } },
    ]),
  ]);

  res.json({ success: true, data: { women_by_village: womenByVillage, children_by_village: childrenByVillage } });
};

exports.getHighRiskList = async (req, res) => {
  const { village, district } = req.query;
  const filter = { high_risk: true, pregnancy_status: true };
  if (village) filter.village = village;
  if (district) filter.district = district;

  const women = await Woman.find(filter)
    .populate('asha_id', 'name phone')
    .sort({ updatedAt: -1 })
    .lean();
  res.json({ success: true, data: women });
};

exports.getAllASHA = async (req, res) => {
  const workers = await User.find({ role: 'ASHA' }).select('-password').lean();
  res.json({ success: true, data: workers });
};

exports.createASHA = async (req, res) => {
  const { name, username, password, assigned_villages, phone } = req.body;
  const user = await User.create({ name, username, password, role: 'ASHA', assigned_villages, phone });
  res.status(201).json({ success: true, data: user });
};

exports.getDailyReportsDashboard = async (req, res) => {
  try {
    const { date, village, asha_id, status, search } = req.query;

    // Target date (default today)
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(targetDate.getDate() + 1);

    // All ASHA workers
    const workerFilter = { role: 'ASHA', active: true };
    if (search) workerFilter.name = { $regex: search, $options: 'i' };
    const allWorkers = await User.find(workerFilter).select('-password').lean();

    // Reports for target date
    const reportFilter = { date: { $gte: targetDate, $lt: nextDay } };
    if (asha_id) reportFilter.asha_id = asha_id;
    if (village) reportFilter.village = village;
    const reports = await DailyWorkReport.find(reportFilter)
      .populate('asha_id', 'name assigned_villages phone')
      .lean();

    // Map reports by asha_id
    const reportMap = {};
    reports.forEach(r => {
      if (r.asha_id) reportMap[r.asha_id._id.toString()] = r;
    });

    // Build combined cards
    let cards = allWorkers.map(w => ({
      worker: w,
      report: reportMap[w._id.toString()] || null,
      submitted: !!reportMap[w._id.toString()],
    }));

    // Filter by submission status
    if (status === 'submitted')  cards = cards.filter(c => c.submitted);
    if (status === 'pending')    cards = cards.filter(c => !c.submitted);

    // Filter by village (from worker's assigned_villages)
    if (village) cards = cards.filter(c =>
      c.worker.assigned_villages?.includes(village) ||
      c.report?.village === village
    );

    // Summary counts
    const summary = {
      total_workers:    allWorkers.length,
      reports_submitted: cards.filter(c => c.submitted).length,
      reports_pending:   cards.filter(c => !c.submitted).length,
      reports_reviewed:  0, // extend with reviewed flag later
    };

    res.json({ success: true, data: { cards, summary, date: targetDate } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
