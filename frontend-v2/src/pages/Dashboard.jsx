import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { statService, authService } from '../services/api';

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
// Stat Card
// ---------------------------------------------------------------------------
const StatCard = ({ icon, title, value, change, accentColor }) => (
  <motion.div
    whileHover={{ y: -5 }}
    className="glass p-6 rounded-xl group hover:bg-surface-variant/40 transition-all duration-300"
  >
    <div className="flex justify-between items-start mb-4">
      <span className={`material-symbols-outlined text-${accentColor} text-3xl`}>{icon}</span>
      <span className={`text-[10px] font-bold text-${accentColor} tracking-widest`}>{change}</span>
    </div>
    <h3 className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1">{title}</h3>
    <p className="text-2xl font-black text-on-surface">{value}</p>
  </motion.div>
);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
const Dashboard = () => {
  const [stats, setStats]     = useState({ total_documents: 0, total_courses: 0, study_hours: 0, quizzes_taken: 0, courses: [], recent_questions: [], daily_activity: {} });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState('1m');

  const user        = authService.getCurrentUser();
  const displayName = user?.email?.split('@')[0] || 'Architect';

  useEffect(() => {
    statService.getOverview()
      .then(r => setStats(r.data))
      .catch(e => console.error('Failed to fetch dashboard stats:', e))
      .finally(() => setLoading(false));
  }, []);

  // Build chart rows from raw daily_activity
  const allRows = useMemo(() => buildDailyRows(stats.daily_activity), [stats.daily_activity]);

  const statsCards = [
    { label: 'Active Courses', value: stats.total_courses,    icon: 'school',     color: 'primary'   },
    { label: 'Documents',    value: stats.total_documents,  icon: 'psychology', color: 'secondary' },
    { label: 'Study Hours',    value: `${stats.study_hours}h`,icon: 'timer',      color: 'primary'   },
    { label: 'Evaluations',    value: stats.quizzes_taken,    icon: 'analytics',  color: 'secondary' },
  ];

  const topCourse    = stats.courses.length > 0 ? stats.courses.reduce((a, b) => a.mastery > b.mastery ? a : b) : null;
  const auraInsight  = topCourse ? `You are ${topCourse.mastery}% through mastering ${topCourse.name}.` : 'Upload your first document to begin.';
  const topConcepts  = [...(stats.courses  || [])].sort((a, b) => b.mastery - a.mastery).slice(0, 3);
  const recentQueries= [...(stats.recent_questions || [])].reverse().slice(0, 3);

  return (
    <div className="lg:pl-64 pt-24 px-8 pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4"
      >
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-on-surface mb-1">Welcome back, {displayName}!</h1>
          <p className="text-on-surface-variant text-sm tracking-wide">What course do you plan on overhauling today?</p>
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

      {/* Stat Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {statsCards.map((card, i) => (
          <StatCard key={i} icon={card.icon} title={card.label} value={loading ? '—' : card.value} change={i % 2 === 0 ? 'OPTIMAL' : 'ACTIVE'} accentColor={card.color} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
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
                <div key={i}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-bold truncate pr-2">{course.name}</span>
                    <span className="text-secondary shrink-0">{course.mastery}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${course.mastery}%` }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.2 }}
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
                    ></motion.div>
                  </div>
                </div>
              )) : (
                <p className="text-xs text-on-surface-variant text-center py-4">Take quizzes to see mastery scores.</p>
              )}
            </div>
            <Link to="/knowledge">
              <button className="w-full mt-8 py-3 text-xs font-bold uppercase tracking-widest border border-primary/20 rounded-lg hover:bg-primary/5 transition-all">
                View All Circuits
              </button>
            </Link>
          </div>

          {/* Recent Queries */}
          <div className="glass p-6 rounded-2xl">
            <h2 className="text-xl font-bold text-on-surface mb-6">Recent Questions</h2>
            <div className="space-y-4">
              {recentQueries.length > 0 ? recentQueries.map((q, i) => (
                <div key={i} className={`p-3 rounded-lg bg-surface-container-highest/50 border-l-2 ${i % 2 === 0 ? 'border-primary' : 'border-secondary'} hover:bg-surface-container-highest transition-all`}>
                  <p className="text-xs text-on-surface mb-1 line-clamp-2">"{q.question}"</p>
                  <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest">{q.course || 'General'}</span>
                </div>
              )) : (
                <p className="text-xs text-on-surface-variant text-center py-4">Ask the AI Tutor questions to see them here.</p>
              )}
            </div>
          </div>

          {/* Upgrade CTA */}
          <div className="signature-gradient p-6 rounded-2xl relative overflow-hidden group cursor-pointer shadow-2xl">
            <div className="absolute -right-4 -top-4 opacity-10 rotate-12 group-hover:scale-110 transition-transform duration-700">
              <span className="material-symbols-outlined text-[120px]">bolt</span>
            </div>
            <h3 className="text-on-primary-fixed text-xl font-black mb-2">Upgrade to Ultra</h3>
            <p className="text-on-primary-fixed/80 text-xs mb-4">Unlock the neural-direct interface and unlimited concept mapping.</p>
            <button className="bg-on-primary-fixed text-primary px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest">Go Ultra</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
