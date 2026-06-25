const Woman = require('../models/Woman');
const Child = require('../models/Child');
const { Visit, DailyWorkReport } = require('../models/index');

exports.getDashboardSummary = async (req, res) => {
  const ashaId = req.user._id;
  const villages = req.user.assigned_villages;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const [
    todayVisits,
    pendingFollowups,
    highRiskWomen,
    totalPregnant,
    severeChildren,
    recentVisits,
  ] = await Promise.all([
    Visit.countDocuments({ asha_id: ashaId, date: { $gte: today, $lt: tomorrow } }),
    Visit.find({
      asha_id: ashaId,
      'follow_up.required': true,
      'follow_up.next_date': { $lte: tomorrow },
    }).sort({ 'follow_up.next_date': 1 }).limit(10).lean(),
    Woman.find({ village: { $in: villages }, high_risk: true, pregnancy_status: true })
      .select('name village medical_metrics pregnancy_month').limit(10).lean(),
    Woman.countDocuments({ village: { $in: villages }, pregnancy_status: true }),
    Child.countDocuments({ village: { $in: villages }, nutrition_status: 'Severe Malnutrition' }),
    Visit.find({ asha_id: ashaId }).sort({ date: -1 }).limit(5).lean(),
  ]);

  res.json({
    success: true,
    data: {
      today_visits: todayVisits,
      total_pregnant: totalPregnant,
      high_risk_count: highRiskWomen.length,
      severe_children: severeChildren,
      pending_followups: pendingFollowups,
      high_risk_women: highRiskWomen,
      recent_visits: recentVisits,
    },
  });
};

exports.submitDailyReport = async (req, res) => {
  const report = await DailyWorkReport.create({ ...req.body, asha_id: req.user._id });
  res.status(201).json({ success: true, data: report });
};

exports.getDailyReports = async (req, res) => {
  const reports = await DailyWorkReport.find({ asha_id: req.user._id })
    .sort({ date: -1 }).limit(30).lean();
  res.json({ success: true, data: reports });
};
