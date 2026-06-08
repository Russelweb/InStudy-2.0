import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { statService, authService, masteryService } from '../services/api';
import WelcomeModal from '../components/WelcomeModal';
import { useAura, useAuraHelp } from '../context/AuraContext';

// ---------------------------------------------------------------------------
// Helpers — transform raw daily_activity from backend into chart rows
// ---------------------------------------------------------------------------
function buildDailyRows(dailyActivity = {}) {
  return Object.entries(dailyActivity)
    .map(([dateStr, day]) => {
      const date = new Date(dateStr.slice(0, 10));
      if (isNaN(date.getTime())) return null;
      const questions = Number(day.questions || 0);
      const explicit  = Number(day.study_time || 0);
      const hours     = parseFloat((explicit + (questions * 5) / 60).toFixed(2));
      return {
        date,
        label: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        hours,
        questions,
        quizzes: Number(day.quizzes || 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function filterByPeriod(rows, period) {
  const now = new Date();
  if (period === '3m') {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
    return rows.filter(r => r.date >= cutoff);
  }
  if (period === '1m') {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 1);
    return rows.filter(r => r.date >= cutoff);
  }
  return rows; // all time
}

// ---------------------------------------------------------------------------
// Custom Tooltip for chart
// ---------------------------------------------------------------------------
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-high border border-outline-variant/20 rounded-xl px-4 py-3 shadow-2xl text-xs">
      <p className="font-bold text-on-surface mb-1">{label}</p>
      <p className="text-secondary">
        <span className="font-black">{payload[0]?.value?.toFixed(2)}h</span> study time
      </p>
      {payload[0]?.payload?.questions > 0 && (
        <p className="text-primary mt-0.5">{payload[0].payload.questions} questions asked</p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Aura Momentum Heatmap — last 7 days
// ---------------------------------------------------------------------------
const AuraMomentumHeatmap = ({ dailyActivity = {} }) => {
  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const data = dailyActivity[key] || {};
      const questions = Number(data.questions || 0);
      const studyTime = Number(data.study_time || 0);
      const hours = studyTime + (questions * 5) / 60;
      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        date: d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        hours: parseFloat(hours.toFixed(2)),
        // Intensity 0–1 (cap at 4h = very active)
        intensity: Math.min(hours / 4, 1),
        isToday: i === 6,
      };
    });
  }, [dailyActivity]);

  const totalWeekHours = days.reduce((s, d) => s + d.hours, 0).toFixed(1);

  return (
    <div className="glass p-6 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold text-on-surface leading-tight">Aura Momentum</h2>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-medium mt-0.5">7-Day Activity</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-secondary">{totalWeekHours}h</p>
          <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">This Week</p>
        </div>
      </div>
      <div className="flex gap-2">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            {/* Heat cell */}
            <div
              className="w-full rounded-lg transition-all duration-700 relative group cursor-default"
              style={{
                height: '56px',
                background: day.intensity === 0
                  ? 'rgba(105,246,184,0.04)'
                  : `rgba(105,246,184,${0.15 + day.intensity * 0.75})`,
                boxShadow: day.intensity > 0.5
                  ? `0 0 ${Math.round(day.intensity * 16)}px rgba(105,246,184,${day.intensity * 0.4})`
                  : 'none',
              }}
            >
              {/* Today ring */}
              {day.isToday && (
                <div className="absolute inset-0 rounded-lg border border-secondary/50"></div>
              )}
              {/* Tooltip on hover */}
              <div className="absolute inset-x-0 -top-10 hidden group-hover:flex items-center justify-center z-20">
                <div className="bg-surface-container-high text-on-surface text-[10px] font-bold px-2 py-1 rounded-lg shadow-xl whitespace-nowrap border border-outline-variant/20">
                  {day.hours > 0 ? `${day.hours}h` : 'No activity'}
                </div>
              </div>
            </div>
            {/* Day label */}
            <span className={`text-[10px] font-bold uppercase tracking-wider ${day.isToday ? 'text-secondary' : 'text-on-surface-variant/60'}`}>
              {day.label}
            </span>
          </div>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-2 mt-3">
        <span className="text-[9px] text-on-surface-variant uppercase tracking-widest">Less</span>
        {[0.04, 0.2, 0.4, 0.65, 0.9].map((op, i) => (
          <div key={i} className="w-4 h-4 rounded-sm" style={{ background: `rgba(105,246,184,${op})` }}></div>
        ))}
        <span className="text-[9px] text-on-surface-variant uppercase tracking-widest">More</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Study Velocity Chart
// ---------------------------------------------------------------------------
const StudyVelocityChart = ({ rows, period, onPeriod }) => {
  const filteredRows = useMemo(() => filterByPeriod(rows, period), [rows, period]);

  const periods = [
    { id: '1m', label: 'This Month' },
    { id: '3m', label: '3 Months'  },
    { id: 'all', label: 'All Time'  },
  ];

  const hasData = filteredRows.length > 0;

  return (
    <div className="glass p-8 rounded-2xl overflow-hidden relative">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-xl font-bold text-on-surface">Study Velocity</h2>
          <p className="text-sm text-on-surface-variant">Daily study hours over time</p>
        </div>
        <div className="flex gap-1.5 bg-surface-container-high rounded-full p-1 border border-outline-variant/10">
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => onPeriod(p.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                period === p.id
                  ? 'bg-primary text-on-primary shadow-lg'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredRows} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="hoursGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#69f6b8" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#69f6b8" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(248,254,246,0.4)', fontSize: 10, fontWeight: 600 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: 'rgba(248,254,246,0.4)', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${v}h`}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(105,246,184,0.2)', strokeWidth: 2 }} />
              <Area
                type="monotone"
                dataKey="hours"
                stroke="#bd9dff"
                strokeWidth={2.5}
                fill="url(#hoursGradient)"
                dot={false}
                activeDot={{ r: 5, fill: '#bd9dff', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center gap-4 border border-dashed border-outline-variant/20 rounded-xl">
          <span className="material-symbols-outlined text-4xl text-on-surface-variant opacity-30">show_chart</span>
          <p className="text-on-surface-variant text-sm font-bold">
            No study data for this period yet.
          </p>
          <p className="text-on-surface-variant/60 text-xs">Start asking questions in the AI Tutor to generate activity.</p>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Onboarding Checklist — shown to new users until they complete step 1
// ---------------------------------------------------------------------------
const ONBOARDING_KEY = 'instudy_onboarding_dismissed';

const OnboardingChecklist = ({ stats, loading }) => {
  const navigate = useNavigate();

  // Dismissed state — persisted in localStorage
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_KEY) === 'true'
  );

  // Don't evaluate steps until stats have loaded
  const hasCourse   = !loading && stats.total_courses > 0;
  const hasDocument = !loading && stats.total_documents > 0;
  const hasActivity = !loading && (stats.quizzes_taken > 0 || stats.study_hours > 0);
  const allDone     = hasCourse && hasDocument && hasActivity;

  // Auto-dismiss once all three steps are done
  useEffect(() => {
    if (!loading && allDone && !dismissed) {
      localStorage.setItem(ONBOARDING_KEY, 'true');
      setDismissed(true);
    }
  }, [loading, allDone, dismissed]);

  // Hide if: explicitly dismissed, or still loading initial stats
  if (dismissed) return null;
  // Don't flash the checklist while stats are loading — wait for real data
  if (loading) return null;
  // If all steps already done on first load (returning power user), dismiss silently
  if (allDone) return null;

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setDismissed(true);
  };

  const steps = [
    {
      done: hasCourse,
      icon: 'school',
      title: 'Create your first course',
      desc: 'Group your study materials by subject.',
      action: () => navigate('/knowledge'),
      actionLabel: 'Go to Knowledge Base',
    },
    {
      done: hasDocument,
      icon: 'upload_file',
      title: 'Upload a document',
      desc: 'PDF, DOCX, TXT — anything you study from.',
      action: () => navigate('/knowledge'),
      actionLabel: 'Upload Now',
    },
    {
      done: hasActivity,
      icon: 'auto_awesome',
      title: 'Generate flashcards or take a quiz',
      desc: 'Let the AI turn your notes into study tools.',
      action: () => navigate('/flashcards'),
      actionLabel: 'Try Flashcards',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const progressPct    = Math.round((completedCount / steps.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="mb-8 bg-surface-container-low border border-primary/20 rounded-2xl p-5 sm:p-6 relative overflow-hidden"
    >
      {/* Subtle glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-black text-on-surface tracking-tight">
            Get started — {completedCount}/{steps.length} done
          </h3>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Complete these steps to unlock the full InStudy experience.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {/* Progress pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
            <div className="w-16 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPct}%` }}
                transition={{ duration: 0.6 }}
                className="h-full bg-primary rounded-full"
              />
            </div>
            <span className="text-[10px] font-black text-primary">{progressPct}%</span>
          </div>
          <button
            onClick={dismiss}
            className="text-on-surface-variant/40 hover:text-on-surface-variant transition-colors"
            title="Dismiss"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={`flex items-start gap-3 p-4 rounded-xl border transition-all ${
              step.done
                ? 'bg-secondary/5 border-secondary/20'
                : 'bg-surface-container border-outline-variant/15'
            }`}
          >
            {/* Check / icon */}
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              step.done ? 'bg-secondary text-background' : 'bg-surface-container-highest text-on-surface-variant'
            }`}>
              <span className="material-symbols-outlined text-sm">
                {step.done ? 'check' : step.icon}
              </span>
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold leading-tight ${step.done ? 'text-secondary line-through opacity-60' : 'text-on-surface'}`}>
                {step.title}
              </p>
              <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">{step.desc}</p>
              {!step.done && (
                <button
                  onClick={step.action}
                  className="mt-2 text-[10px] font-black text-primary uppercase tracking-widest hover:text-secondary transition-colors flex items-center gap-1"
                >
                  {step.actionLabel}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------
const StatCard = ({ icon, title, value, change, accentColor, path }) => (
  <Link to={path} className="block h-full">
    <motion.div
      whileHover={{ y: -5 }}
      className="glass p-4 sm:p-6 rounded-xl group hover:bg-surface-variant/40 transition-all duration-300 cursor-pointer h-full"
    >
      <div className="flex justify-between items-start mb-3 sm:mb-4">
        <span className={`material-symbols-outlined text-${accentColor} text-2xl sm:text-3xl`}>{icon}</span>
        <span className={`text-[9px] sm:text-[10px] font-bold text-${accentColor} tracking-widest`}>{change}</span>
      </div>
      <h3 className="text-on-surface-variant text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-1">{title}</h3>
      <p className="text-xl sm:text-2xl font-black text-on-surface">{value}</p>
    </motion.div>
  </Link>
);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const Dashboard = () => {
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem('is_new_user') === 'true');
  const [stats, setStats]     = useState({ total_documents: 0, total_courses: 0, study_hours: 0, quizzes_taken: 0, courses: [], recent_questions: [], daily_activity: {} });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('1m');
  const navigate              = useNavigate();
  const { triggerAura }       = useAura();
  useAuraHelp('This is your Dashboard — track study hours, mastery progress, and recent activity. Start by creating a course in Knowledge Base.');

  const user        = authService.getCurrentUser();
  const displayName = user?.email?.split('@')[0] || 'Architect';

  useEffect(() => {
    statService.getOverview()
      .then(r => setStats(r.data))
      .catch(e => console.error('Failed to fetch dashboard stats:', e))
      .finally(() => setLoading(false));
  }, []);

  // Aura stale nudge — fires once per session if user hasn't studied in 3+ days
  useEffect(() => {
    if (loading) return;
    const nudgeSeen = sessionStorage.getItem('aura_nudge_shown');
    if (nudgeSeen) return;

    const activeCourse = stats.courses?.[0];
    if (!activeCourse) return;

    masteryService.getStale(activeCourse.id, 3)
      .then(res => {
        const stale = res.data?.stale_concepts || [];
        if (stale.length > 0) {
          sessionStorage.setItem('aura_nudge_shown', 'true');
          const concept = stale[0]?.concept_id || 'some concepts';
          triggerAura(
            'nudge',
            `Your mastery of "${concept}" has started to decay. A quick review will lock it in.`,
            { label: 'Review Flashcards', onClick: () => navigate(`/flashcards?id=${activeCourse.id}`) },
            9000
          );
        }
      })
      .catch(() => {});
  }, [loading, stats.courses]);

  // Aura guide — fires once for new users with no courses
  useEffect(() => {
    if (loading) return;
    if (stats.total_courses > 0) return;
    const guideSeen = sessionStorage.getItem('aura_guide_shown');
    if (guideSeen) return;
    sessionStorage.setItem('aura_guide_shown', 'true');
    setTimeout(() => {
      triggerAura(
        'pointing',
        'Start by creating a course and uploading your study material. I\'ll take it from there.',
        { label: 'Create a Course', onClick: () => navigate('/knowledge') },
        10000
      );
    }, 1500); // slight delay so page has settled
  }, [loading, stats.total_courses]);

  // Build chart rows from raw daily_activity
  const allRows = useMemo(() => buildDailyRows(stats.daily_activity), [stats.daily_activity]);

  // Resolve last active course
  const lastActiveCourse = useMemo(() => {
    if (loading || !stats.courses || stats.courses.length === 0) return null;
    const activeId = localStorage.getItem('activeCourse');
    if (activeId) {
      const found = stats.courses.find(c => c.id === activeId);
      if (found) return found;
    }
    return stats.courses[0];
  }, [loading, stats.courses]);

  const statsCards = [
    { label: 'Active Courses', value: stats.total_courses,     icon: 'school',     color: 'primary',   badge: 'COURSES',   path: '/knowledge' },
    { label: 'Documents',      value: stats.total_documents,   icon: 'psychology', color: 'secondary', badge: 'UPLOADED',  path: '/saved-assets' },
    { label: 'Study Hours',    value: `${stats.study_hours}h`, icon: 'timer',      color: 'primary',   badge: 'LOGGED',    path: '/mastery' },
    { label: 'Evaluations',    value: stats.quizzes_taken,     icon: 'analytics',  color: 'secondary', badge: 'COMPLETED', path: '/quiz' },
  ];

  const topCourse    = stats.courses.length > 0 ? stats.courses.reduce((a, b) => a.mastery > b.mastery ? a : b) : null;
  const auraInsight  = topCourse ? `You are ${topCourse.mastery}% through mastering ${topCourse.name}.` : 'Upload your first document to begin.';
  const topConcepts  = [...(stats.courses  || [])].sort((a, b) => b.mastery - a.mastery).slice(0, 3);
  const recentQueries= [...(stats.recent_questions || [])].reverse().slice(0, 3);

  return (
    <div className="p-4 md:p-8 pb-12">
      {/* Welcome modal — shown once for new users */}
      {showWelcome && <WelcomeModal onClose={() => setShowWelcome(false)} />}

      {/* Onboarding checklist — shown to any user who hasn't dismissed it yet */}
      <AnimatePresence>
        <OnboardingChecklist stats={stats} loading={loading} />
      </AnimatePresence>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-on-surface mb-1">Welcome back, {displayName}!</h1>
          <p className="text-on-surface-variant text-xs sm:text-sm tracking-wide">What course do you plan on overhauling today?</p>
        </div>
        <div className="glass px-6 py-3 rounded-full flex items-center gap-3 border-secondary/20 group hover:scale-105 transition-transform duration-500">
          <span className="flex h-3 w-3 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-secondary"></span>
          </span>
          <span className="text-secondary text-sm font-bold tracking-tight">
            🔥 Aura Insight: <span className="text-on-surface font-normal">{auraInsight}</span>
          </span>
        </div>
      </motion.div>

      {/* Last Course Interaction */}
      {!loading && lastActiveCourse && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-surface-container-low border border-secondary/20 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden group hover:border-secondary/40 transition-colors"
        >
          <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-secondary/5 blur-[50px] rounded-full pointer-events-none" />
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-secondary/15 flex items-center justify-center text-secondary shrink-0 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-2xl">history</span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-secondary/70">Last Interacted Course</span>
              <h3 className="text-lg font-black text-on-surface truncate mt-0.5">{lastActiveCourse.name}</h3>
              <p className="text-xs text-on-surface-variant/80 mt-1">{lastActiveCourse.document_count} Documents · {lastActiveCourse.mastery}% Mastered</p>
            </div>
          </div>
          <Link
            to={`/workspace?id=${lastActiveCourse.id}`}
            onClick={() => localStorage.setItem('activeCourse', lastActiveCourse.id)}
            className="w-full sm:w-auto px-6 py-3 bg-secondary text-on-secondary font-black text-xs uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-transform flex items-center justify-center gap-2 animate-pulse"
          >
            <span className="material-symbols-outlined text-sm">rocket_launch</span>
            Resume Study
          </Link>
        </motion.div>
      )}

      {/* Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-8 sm:mb-12">
        {statsCards.map((card, i) => (
          <StatCard key={i} icon={card.icon} title={card.label} value={loading ? '—' : card.value} change={card.badge} accentColor={card.color} path={card.path} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4 sm:gap-8">
        {/* Left (70%) */}
        <div className="lg:col-span-7 space-y-8">
          {/* Aura Momentum Heatmap */}
          <AuraMomentumHeatmap dailyActivity={stats.daily_activity} />

          {/* Study Velocity Chart */}
          <StudyVelocityChart rows={allRows} period={period} onPeriod={setPeriod} />

          {/* Active Circuits List */}
          <div className="glass p-8 rounded-2xl">
            <h2 className="text-xl font-bold text-on-surface mb-6">Active Courses</h2>
            <div className="space-y-4">
              {loading ? (
                <div className="text-center py-8 text-on-surface-variant text-sm animate-pulse">Loading Courses...</div>
              ) : stats.courses.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-outline-variant/20 rounded-xl">
                  <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block opacity-40">inventory_2</span>
                  <p className="text-sm text-on-surface-variant">No courses yet.</p>
                  <Link to="/knowledge" className="mt-3 inline-block text-xs font-bold text-secondary uppercase tracking-widest hover:underline">
                    Go to Knowledge Base →
                  </Link>
                </div>
              ) : (
                stats.courses.map((course, idx) => (
                  <Link
                    key={idx}
                    to={`/workspace?id=${course.id}`}
                    onClick={() => localStorage.setItem('activeCourse', course.id)}
                    className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer group block"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                        <span className="material-symbols-outlined">{idx % 2 === 0 ? 'description' : 'quiz'}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-on-surface">{course.name}</h4>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{course.document_count} Documents Linked</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-black text-secondary">{course.mastery}%</div>
                      <div className="text-[10px] text-on-surface-variant font-bold">MASTERY</div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right (30%) */}
        <div className="lg:col-span-3 space-y-8">
          {/* Top Concepts */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-on-surface mb-6">Top Courses</h2>
            <div className="space-y-6">
              {topConcepts.length > 0 ? topConcepts.map((course, i) => (
                <Link
                  key={i}
                  to={`/workspace?id=${course.id}`}
                  onClick={() => localStorage.setItem('activeCourse', course.id)}
                  className="block group cursor-pointer hover:bg-surface-variant/20 p-2 rounded-lg transition-all"
                >
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-bold truncate pr-2 group-hover:text-primary transition-colors">{course.name}</span>
                    <span className="text-secondary shrink-0">{course.mastery}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${course.mastery}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                      className="h-full bg-primary rounded-full"
                    ></motion.div>
                  </div>
                </Link>
              )) : (
                <p className="text-xs text-on-surface-variant text-center py-4">Take quizzes to see mastery scores.</p>
              )}
            </div>
            <Link to="/knowledge">
              <button className="w-full mt-8 py-3 text-xs font-bold uppercase tracking-widest border border-primary/20 rounded-lg hover:bg-primary/5 transition-all">
                View All Courses
              </button>
            </Link>
          </div>

          {/* Recent Queries */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-on-surface mb-6">Recent Questions</h2>
            <div className="space-y-4">
              {recentQueries.length > 0 ? recentQueries.map((q, i) => (
                <Link
                  key={i}
                  to={q.course ? `/ai-tutor?id=${q.course}` : '/ai-tutor'}
                  onClick={() => q.course && localStorage.setItem('activeCourse', q.course)}
                  className="block"
                >
                  <div className={`p-3 rounded-lg bg-surface-container-highest/50 border-l-2 ${i % 2 === 0 ? 'border-primary' : 'border-secondary'} hover:bg-surface-container-highest transition-all cursor-pointer`}>
                    <p className="text-xs text-on-surface mb-1 line-clamp-2">{q.question}</p>
                    <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">{q.course || 'General'}</span>
                  </div>
                </Link>
              )) : (
                <p className="text-xs text-on-surface-variant text-center py-4">Ask the AI Tutor questions to see them here.</p>
              )}
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="bg-[#551a8b] p-6 rounded-2xl relative overflow-hidden group cursor-pointer shadow-2xl">
            <div className="absolute -right-4 -top-4 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700">
              <span className="material-symbols-outlined text-[160px]">bolt</span>
            </div>
            <h3 className="text-on-primary-fixed text-xl font-black mb-2 text-white">Upgrade to Ultra</h3>
            <p className="text-on-primary-fixed/80 text-xs mb-4 text-white">Unlock the neural-direct interface and unlimited concept mapping.</p>
            <button className="bg-on-primary-fixed text-white px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest">Go Ultra</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
