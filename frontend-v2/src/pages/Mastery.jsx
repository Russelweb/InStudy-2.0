/**
 * Mastery.jsx — Phase 5 redesign
 *
 * 4-tab layout — all in one route, no page navigations:
 *   Overview    — course mastery cards + today's XP + first-visit explanation
 *   Course      — full 4-tier tree for one course (Doc → Concept → Subtopic)
 *   Review Queue— urgency-sorted list of stale/decaying subtopics
 *   Progress    — XP charts, daily breakdown, study time
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import { masteryService, statService } from '../services/api';
import { ConfirmModal } from '../components/Modal';
import { showToast } from '../components/Toast';
import { useAura, useAuraHelp } from '../context/AuraContext';

// ─────────────────────────────────────────────────────────────────────────────
// Small shared helpers
// ─────────────────────────────────────────────────────────────────────────────

const getMasteryColor = (pct) => {
  const p = pct ?? 0;
  if (p >= 60) return '#69f6b8'; // Green
  if (p >= 40) return '#bd9dff'; // Purple
  if (p >= 25) return '#dff16d'; // Yellow
  return '#f96787'; // Lighter Red
};

const MasteryBar = ({ pct, color, height = 'h-1.5' }) => {
  const barColor = color || getMasteryColor(pct);
  return (
    <div className={`w-full ${height} bg-surface-container-highest rounded-full overflow-hidden`}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="h-full rounded-full"
        style={{ backgroundColor: barColor }}
      />
    </div>
  );
};

const MasteryRing = ({ pct, size = 56, stroke = 4 }) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;
  const color = getMasteryColor(pct);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black"
        style={{ color }}>
        {Math.round(pct)}%
      </span>
    </div>
  );
};

const ToolDot = ({ tool }) => {
  const map = {
    flashcard: { color: '#bd9dff', label: 'F' },
    quiz:      { color: '#69f6b8', label: 'Q' },
    tutor:     { color: '#e7fff3', label: 'T' },
    reading:   { color: '#7a807a', label: 'R' },
  };
  const t = map[tool] || { color: '#7a807a', label: '?' };
  return (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-black"
      style={{ backgroundColor: `${t.color}20`, color: t.color }}>
      {t.label}
    </span>
  );
};

const EmptySection = ({ icon, title, desc, actionLabel, onAction }) => (
  <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
    <span className="material-symbols-outlined text-5xl text-on-surface-variant/20">{icon}</span>
    <div>
      <p className="font-black text-on-surface text-base mb-1">{title}</p>
      <p className="text-xs text-on-surface-variant max-w-xs leading-relaxed">{desc}</p>
    </div>
    {actionLabel && (
      <button onClick={onAction}
        className="mt-2 px-5 py-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-primary/20 transition-all">
        {actionLabel}
      </button>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Tab bar
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'overview',  label: 'Overview',     icon: 'dashboard' },
  { id: 'detail',    label: 'Course Detail', icon: 'account_tree' },
  { id: 'review',    label: 'Review Queue',  icon: 'pending_actions' },
  { id: 'progress',  label: 'Progress',      icon: 'show_chart' },
];

const TabBar = ({ active, onChange }) => (
  <div className="flex gap-1 border-b border-outline-variant/15 mb-8 overflow-x-auto">
    {TABS.map(t => (
      <button
        key={t.id}
        onClick={() => onChange(t.id)}
        className={`flex items-center gap-2 px-4 py-3 text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all border-b-2 -mb-px ${
          active === t.id
            ? 'border-primary text-primary'
            : 'border-transparent text-on-surface-variant hover:text-on-surface'
        }`}
      >
        <span className="material-symbols-outlined text-sm">{t.icon}</span>
        {t.label}
        {t.id === 'review' && <ReviewBadge />}
      </button>
    ))}
  </div>
);

// Small red badge on Review Queue tab if there are urgent items
const ReviewBadge = () => {
  // Purely cosmetic — actual count comes from parent
  return null; // populated below after data loads
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — Overview
// ─────────────────────────────────────────────────────────────────────────────

const EXPLAIN_KEY = 'instudy_mastery_explain_seen';

const OverviewTab = ({ courses, loading, onSelectCourse, dailySummaries }) => {
  const [explainDismissed, setExplainDismissed] = useState(
    () => localStorage.getItem(EXPLAIN_KEY) === 'true'
  );
  const dismiss = () => {
    localStorage.setItem(EXPLAIN_KEY, 'true');
    setExplainDismissed(true);
  };

  // Total XP today across all courses
  const totalXpToday = dailySummaries.reduce((s, d) => s + (d.total_xp_today || 0), 0);

  return (
    <div className="space-y-8">
      {/* First-visit explanation strip */}
      <AnimatePresence>
        {!explainDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-start gap-4 p-4 bg-primary/8 border border-primary/20 rounded-2xl"
          >
            <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">info</span>
            <div className="min-w-0">
              <p className="text-sm font-black text-on-surface mb-1">How mastery works</p>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Your <span className="text-primary font-bold">mastery %</span> shows how much of your uploaded course material you've demonstrated understanding of — across flashcards, quizzes, and the AI Tutor.
                It's calculated per document, then rolled up to give you an honest course-level score.
                <span className="text-primary font-bold"> 100% is reachable</span> — it means you've engaged with every concept extracted from every document you uploaded.
              </p>
            </div>
            <button onClick={dismiss} className="shrink-0 text-on-surface-variant/40 hover:text-on-surface-variant transition-colors">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Today's XP banner */}
      {totalXpToday > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between px-6 py-4 bg-secondary/10 border border-secondary/20 rounded-2xl"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-secondary text-2xl">bolt</span>
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-secondary">Today's Progress</p>
              <p className="text-2xl font-black text-on-surface">+{totalXpToday} <span className="text-secondary">XP</span></p>
            </div>
          </div>
          <div className="flex gap-4">
            {dailySummaries.filter(d => d.total_xp_today > 0).map((d, i) => (
              <div key={i} className="text-right">
                <p className="text-[10px] text-on-surface-variant uppercase tracking-widest truncate max-w-[120px]">{d.course_name}</p>
                <p className="text-sm font-black text-secondary">+{d.total_xp_today} XP</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Course mastery grid */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest text-on-surface-variant mb-4">
          All Courses — click to drill down
        </h2>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map(i => (
              <div key={i} className="h-40 bg-surface-container-low rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <EmptySection icon="school" title="No courses yet"
            desc="Create a course in the Knowledge Base and upload your study material."
            actionLabel="Go to Knowledge Base"
            onAction={() => window.location.href = '/knowledge'} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course, i) => {
              const summary = dailySummaries.find(d => d.course_id === course.id);
              const xpToday = summary?.total_xp_today || 0;
              const docs = course.v2_mastery?.documents ?? [];

              // Extraction status indicators
              const extractionProcessing = docs.some(
                d => d.extraction_status === 'pending' || d.extraction_status === 'processing'
              );
              const noV2Data = docs.length === 0;
              const needsAttention = docs.some(
                d => d.mastery_pct < 20 && d.extraction_status === 'complete'
              );
              // Use V2 mastery if available, else fall back to legacy score
              const displayPct = course.v2_mastery?.course_mastery_pct ?? course.mastery ?? 0;

              return (
                <motion.button
                  key={course.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onSelectCourse(course.id)}
                  className="text-left p-5 bg-surface-container-low border border-outline-variant/15 rounded-2xl hover:border-primary/30 transition-all group relative overflow-hidden"
                >
                  {needsAttention && !extractionProcessing && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-error animate-pulse" title="Needs attention" />
                  )}
                  {extractionProcessing && (
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary animate-pulse" title="Indexing concepts…" />
                  )}

                  <div className="flex items-start justify-between mb-4">
                    <div className="min-w-0 pr-3">
                      <h3 className="font-black text-on-surface text-base truncate group-hover:text-primary transition-colors">
                        {course.name}
                      </h3>
                      <p className="text-[10px] text-on-surface-variant mt-0.5 uppercase tracking-widest">
                        {course.document_count} doc{course.document_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <MasteryRing pct={displayPct} size={52} />
                  </div>

                  {/* Per-document mini bars — shown when V2 data exists */}
                  {docs.length > 0 ? (
                    <div className="space-y-1.5 mb-3">
                      {docs.slice(0, 3).map((doc, di) => (
                        <div key={di} className="flex items-center gap-2">
                          <span className="text-[9px] text-on-surface-variant/60 truncate flex-1 max-w-[120px]">
                            {doc.filename.length > 18 ? doc.filename.slice(0, 15) + '…' : doc.filename}
                          </span>
                          <div className="flex-1">
                            {doc.extraction_status === 'complete' ? (
                              <MasteryBar pct={doc.mastery_pct}
                                color={getMasteryColor(doc.mastery_pct)}
                                height="h-1" />
                            ) : (
                              <div className="w-full h-1 bg-primary/20 rounded-full overflow-hidden">
                                <div className="h-full bg-primary/40 rounded-full animate-pulse w-1/2" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] font-black w-7 text-right"
                            style={{ color: doc.extraction_status === 'complete'
                              ? getMasteryColor(doc.mastery_pct)
                              : '#b0b8af' }}>
                            {doc.extraction_status === 'complete' ? `${Math.round(doc.mastery_pct)}%` : '…'}
                          </span>
                        </div>
                      ))}
                      {docs.length > 3 && (
                        <p className="text-[9px] text-on-surface-variant/40">
                          +{docs.length - 3} more documents
                        </p>
                      )}
                    </div>
                  ) : noV2Data && course.document_count > 0 ? (
                    /* V2 hasn't indexed this course yet — show legacy mastery info */
                    <div className="mb-3 py-2 px-3 bg-surface-container/50 rounded-lg border border-outline-variant/10">
                      <p className="text-[9px] text-on-surface-variant/60 leading-relaxed">
                        ⟳ Concept indexing pending — upload a new document or re-open Knowledge Base to trigger it.
                        Legacy mastery score shown.
                      </p>
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant/10">
                    <span className="text-[9px] text-on-surface-variant/60 uppercase tracking-widest">View detail →</span>
                    {xpToday > 0 && (
                      <span className="text-[9px] font-black text-secondary">+{xpToday} XP today</span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — Course Detail (4-tier tree)
// ─────────────────────────────────────────────────────────────────────────────

const SubtopicRow = ({ sub }) => {
  const pct = sub.mastery_pct ?? 0;
  const color = getMasteryColor(pct);
  const totalXp = sub.total_xp ?? 0;
  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-surface-container/50 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-on-surface font-medium truncate">{sub.concept_name}</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0`}
            style={{ backgroundColor: `${color}18`, color }}>
            {sub.weight}
          </span>
        </div>
        <MasteryBar pct={pct} color={color} height="h-1" />
      </div>
      <div className="shrink-0 text-right min-w-[80px]">
        <p className="text-xs font-black" style={{ color }}>{Math.round(pct)}%</p>
        <p className="text-[9px] text-on-surface-variant">{totalXp} / 100 XP</p>
      </div>
      {/* XP source dots */}
      <div className="flex gap-1 shrink-0">
        {sub.flashcard_xp > 0 && <ToolDot tool="flashcard" />}
        {sub.quiz_xp > 0 && <ToolDot tool="quiz" />}
        {sub.tutor_xp > 0 && <ToolDot tool="tutor" />}
      </div>
    </div>
  );
};

const ConceptAccordion = ({ concept, courseId, navigate }) => {
  const [open, setOpen] = useState(concept.mastery_pct < 60);
  const pct = concept.mastery_pct ?? 0;
  const color = getMasteryColor(pct);
  return (
    <div className="border border-outline-variant/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-container/50 transition-colors text-left"
      >
        <span className="material-symbols-outlined text-sm text-on-surface-variant transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          chevron_right
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-black text-on-surface truncate">{concept.concept_name}</span>
          </div>
          <MasteryBar pct={pct} color={color} height="h-1" />
        </div>
        <span className="text-sm font-black shrink-0" style={{ color }}>{Math.round(pct)}%</span>
        <span className="text-[9px] text-on-surface-variant shrink-0">
          {concept.subtopics?.length ?? 0} subtopics
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-outline-variant/10 bg-surface-container-lowest/40 px-2 py-1 space-y-0.5"
          >
            {concept.subtopics?.length > 0 ? (
              concept.subtopics.map(sub => <SubtopicRow key={sub.concept_id} sub={sub} />)
            ) : (
              <p className="text-xs text-on-surface-variant/50 py-4 text-center">
                No subtopics extracted yet.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DocumentAccordion = ({ doc, courseId, navigate }) => {
  const [open, setOpen] = useState(doc.mastery_pct < 80);
  const pct = doc.mastery_pct ?? 0;
  const statusColors = {
    complete: 'text-secondary',
    processing: 'text-primary',
    pending: 'text-on-surface-variant',
    failed: 'text-error',
  };
  return (
    <div className="bg-surface-container-low border border-outline-variant/15 rounded-2xl overflow-hidden">
      {/* Document header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-surface-container/60 transition-colors text-left"
      >
        <span className="material-symbols-outlined text-primary text-xl shrink-0">description</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-black text-on-surface truncate">{doc.display_name || doc.filename}</span>
            <span className={`text-[9px] font-black uppercase tracking-wider shrink-0 ${statusColors[doc.extraction_status] ?? 'text-on-surface-variant'}`}>
              {doc.extraction_status === 'complete' ? '✓ indexed' :
               doc.extraction_status === 'processing' ? '⟳ indexing…' :
               doc.extraction_status === 'pending' ? '○ pending' : '✗ failed'}
            </span>
          </div>
          <MasteryBar pct={pct}
            color={getMasteryColor(pct)} />
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-black" style={{
            color: getMasteryColor(pct)
          }}>{Math.round(pct)}%</p>
          <p className="text-[9px] text-on-surface-variant">weight {doc.document_weight?.toFixed(1)}</p>
        </div>
        <span className="material-symbols-outlined text-on-surface-variant text-sm shrink-0 transition-transform"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="border-t border-outline-variant/10 px-4 py-3 space-y-2"
          >
            {doc.extraction_status !== 'complete' ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">
                {doc.extraction_status === 'processing'
                  ? 'Concepts are being extracted — check back in a moment.'
                  : doc.extraction_status === 'failed'
                  ? 'Concept extraction failed. Try re-uploading this document.'
                  : 'Concept extraction is queued.'}
              </p>
            ) : doc.concepts?.length === 0 ? (
              <p className="text-xs text-on-surface-variant py-4 text-center">
                No concepts found in this document.
              </p>
            ) : (
              doc.concepts?.map(c => (
                <ConceptAccordion key={c.concept_id} concept={c} courseId={courseId} navigate={navigate} />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailTab = ({ courseGraph, selectedCourseId, courses, onSelectCourse, loading, navigate, onReset }) => {
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const currentCourse = courses.find(c => c.id === selectedCourseId);

  const handleReindex = async () => {
    if (!selectedCourseId || reindexing) return;
    setReindexing(true);
    try {
      const res = await masteryService.v2.triggerExtraction(selectedCourseId);
      showToast(res.data?.message || 'Concept extraction queued.', 'success');
    } catch {
      showToast('Failed to trigger extraction. Check your API key in Settings.', 'error');
    } finally {
      setTimeout(() => setReindexing(false), 3000);
    }
  };

  // Weakest 5 subtopics for the attention panel
  const weakest = courseGraph?.documents
    ?.flatMap(d => d.concepts?.flatMap(c => c.subtopics?.map(s => ({
      ...s, doc_filename: d.filename, concept_name_parent: c.concept_name
    })) ?? []) ?? [])
    .filter(s => (s.mastery_pct ?? 0) < 50)
    .sort((a, b) => (a.mastery_pct ?? 0) - (b.mastery_pct ?? 0))
    .slice(0, 5) ?? [];

  if (!selectedCourseId) {
    return (
      <EmptySection icon="account_tree" title="Select a course"
        desc="Go to Overview and click a course card to explore its full concept tree." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Course header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <select
              value={selectedCourseId}
              onChange={e => onSelectCourse(e.target.value)}
              className="bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm font-black text-on-surface focus:ring-1 focus:ring-primary/50 transition-all"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-on-surface-variant">
            {courseGraph?.documents?.length ?? 0} documents ·{' '}
            <span className="text-primary font-bold">
              {Math.round(courseGraph?.course_mastery_pct ?? 0)}% overall mastery
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* XP legend */}
          <div className="flex items-center gap-3 text-[10px] text-on-surface-variant">
            <span className="flex items-center gap-1"><ToolDot tool="flashcard" /> Flashcard</span>
            <span className="flex items-center gap-1"><ToolDot tool="quiz" /> Quiz</span>
            <span className="flex items-center gap-1"><ToolDot tool="tutor" /> Tutor</span>
          </div>
          <button
            onClick={handleReindex}
            disabled={reindexing}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 border border-primary/20 rounded-lg transition-all disabled:opacity-50"
            title="Re-run concept extraction for all documents in this course"
          >
            <span className={`material-symbols-outlined text-sm ${reindexing ? 'animate-spin' : ''}`}>
              {reindexing ? 'sync' : 'hub'}
            </span>
            {reindexing ? 'Indexing…' : 'Re-index'}
          </button>
          <button
            onClick={() => setResetModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-error hover:bg-error/10 border border-error/20 rounded-lg transition-all"
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            Reset
          </button>
        </div>
      </div>

      <ConfirmModal
        open={resetModalOpen}
        title="Reset Course Progress?"
        description={`This permanently deletes all mastery data for "${currentCourse?.name}". Cannot be undone.`}
        confirmLabel="Yes, Reset" cancelLabel="Keep Progress" danger
        onConfirm={() => { setResetModalOpen(false); onReset(selectedCourseId); }}
        onCancel={() => setResetModalOpen(false)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* Left: document/concept tree */}
          <div className="space-y-4 min-w-0">
            {courseGraph?.documents?.length > 0 ? (
              courseGraph.documents.map(doc => (
                <DocumentAccordion
                  key={doc.doc_id}
                  doc={doc}
                  courseId={selectedCourseId}
                  navigate={navigate}
                />
              ))
            ) : (
              <EmptySection icon="psychology" title="No concept data yet"
                desc="Upload documents and use flashcards or quizzes to build your mastery profile."
                actionLabel="Go to Flashcards"
                onAction={() => navigate(`/flashcards?id=${selectedCourseId}`)} />
            )}
          </div>

          {/* Right: attention panel */}
          {weakest.length > 0 && (
            <div className="bg-error-container/5 border border-error-dim/20 rounded-2xl p-5 self-start sticky top-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-error text-base">warning</span>
                <h3 className="text-xs font-black uppercase tracking-widest text-error">Needs Attention</h3>
              </div>
              <div className="space-y-3">
                {weakest.map((sub, i) => (
                  <div key={i} className="p-3 bg-surface-container-lowest/60 rounded-xl border border-outline-variant/10">
                    <p className="text-xs font-black text-on-surface truncate mb-0.5">{sub.concept_name}</p>
                    <p className="text-[9px] text-on-surface-variant truncate mb-2">
                      {sub.concept_name_parent} · {sub.doc_filename}
                    </p>
                    <MasteryBar pct={sub.mastery_pct ?? 0} color={getMasteryColor(sub.mastery_pct ?? 0)} height="h-1" />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[9px] font-black" style={{ color: getMasteryColor(sub.mastery_pct ?? 0) }}>{Math.round(sub.mastery_pct ?? 0)}%</span>
                      <button
                        onClick={() => {
                          navigate(`/flashcards?id=${selectedCourseId}&focus=${encodeURIComponent(sub.concept_name)}`);
                        }}
                        className="text-[9px] font-black text-primary uppercase tracking-widest hover:text-secondary transition-colors"
                      >
                        Study →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate(`/flashcards?id=${selectedCourseId}`)}
                className="w-full mt-4 py-2.5 bg-primary text-on-primary font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-primary-fixed transition-all"
              >
                Address Weak Areas
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3 — Review Queue
// ─────────────────────────────────────────────────────────────────────────────

const URGENCY = [
  { key: 'urgent', label: 'Urgent', color: '#f96787', bg: 'bg-error/5', border: 'border-error-dim/25', desc: 'Mastery critically low or not touched in 21+ days', icon: 'priority_high' },
  { key: 'soon',   label: 'Review Soon', color: '#bd9dff', bg: 'bg-primary/5', border: 'border-primary/20', desc: '14–21 days since last review', icon: 'schedule' },
  { key: 'later',  label: 'Later', color: '#69f6b8', bg: 'bg-secondary/5', border: 'border-secondary/20', desc: 'Healthy but approaching review window', icon: 'event' },
];

const ReviewTab = ({ staleSubtopics, selectedCourseId, courses, onSelectCourse, loading, navigate }) => {
  const [dismissed, setDismissed] = useState(new Set());

  // Reset dismissed set when course or stale data changes
  const staleKey = staleSubtopics.map(s => s.concept_id ?? s.concept_name).join(',');
  const [prevStaleKey, setPrevStaleKey] = useState(staleKey);
  if (prevStaleKey !== staleKey) { setPrevStaleKey(staleKey); setDismissed(new Set()); }

  const handleStudy = (item) => {
    // Mark item as dismissed locally (dynamic removal)
    const key = item.concept_id ?? item.concept_name;
    setDismissed(prev => new Set([...prev, key]));
    // Navigate with the subtopic name as a URL param — Flashcards reads it synchronously
    navigate(`/flashcards?id=${selectedCourseId}&focus=${encodeURIComponent(item.concept_name)}`);
  };

  // Bucket stale subtopics by urgency, excluding dismissed items
  const visible = staleSubtopics.filter(s => !dismissed.has(s.concept_id ?? s.concept_name));
  const buckets = {
    urgent: visible.filter(s => s.days_since >= 21 || (s.mastery_pct ?? 0) < 20),
    soon:   visible.filter(s => s.days_since >= 14 && s.days_since < 21 && (s.mastery_pct ?? 0) >= 20),
    later:  visible.filter(s => s.days_since >= 7  && s.days_since < 14),
  };
  const totalReview = Object.values(buckets).reduce((s, b) => s + b.length, 0);

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-on-surface">What to study next</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Based on the Ebbinghaus forgetting curve — concepts decay over time without review.
          </p>
        </div>
        <select
          value={selectedCourseId || ''}
          onChange={e => onSelectCourse(e.target.value)}
          className="bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm font-black text-on-surface focus:ring-1 focus:ring-primary/50 transition-all"
        >
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : totalReview === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center py-16 gap-4"
        >
          <div className="w-16 h-16 rounded-full bg-secondary/15 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-3xl">check_circle</span>
          </div>
          <div className="text-center">
            <p className="font-black text-on-surface text-base mb-1">All clear</p>
            <p className="text-xs text-on-surface-variant max-w-xs">
              No concepts need review right now. Keep studying to maintain your mastery.
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6">
          {URGENCY.map(u => {
            const items = buckets[u.key];
            if (items.length === 0) return null;
            return (
              <div key={u.key} className={`${u.bg} border ${u.border} rounded-2xl p-5`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-sm" style={{ color: u.color }}>{u.icon}</span>
                  <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: u.color }}>
                    {u.label}
                  </h3>
                  <span className="ml-auto text-xs font-black px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: `${u.color}18`, color: u.color }}>
                    {items.length}
                  </span>
                </div>
                <p className="text-[10px] text-on-surface-variant mb-4">{u.desc}</p>
                <AnimatePresence mode="popLayout">
                  {items.map((item, i) => (
                    <motion.div
                      key={item.concept_id ?? item.concept_name ?? i}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: 30, height: 0, marginBottom: 0 }}
                      transition={{ duration: 0.22 }}
                      className="flex items-center gap-3 p-3 mb-2 bg-surface-container-lowest/50 rounded-xl border border-outline-variant/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-on-surface truncate">{item.concept_name}</p>
                        <p className="text-[9px] text-on-surface-variant truncate">
                          {item.filename} · {item.days_since}d ago
                        </p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <MasteryBar pct={item.mastery_pct ?? 0} color={u.color} height="h-1" />
                          <span className="text-[9px] font-black shrink-0" style={{ color: u.color }}>
                            {Math.round(item.mastery_pct ?? 0)}%
                          </span>
                          {item.predicted_pct !== undefined && item.predicted_pct < item.mastery_pct && (
                            <span className="text-[9px] text-error shrink-0">
                              ↓{Math.round(item.mastery_pct - item.predicted_pct)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleStudy(item)}
                        className="shrink-0 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border hover:scale-105 active:scale-95"
                        style={{
                          backgroundColor: `${u.color}15`,
                          borderColor: `${u.color}30`,
                          color: u.color
                        }}
                        title={`Study '${item.concept_name}' focused flashcards`}
                      >
                        Study →
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TAB 4 — Progress
// ─────────────────────────────────────────────────────────────────────────────

const ToolColors = { flashcard: '#bd9dff', quiz: '#69f6b8', tutor: '#e7fff3', reading: '#7a807a' };

const ProgressTab = ({ selectedCourseId, courses, onSelectCourse, xpSummary, dailySummary, studyTime, loading }) => {
  // Build XP bar chart data — group by date, stack by tool
  const chartData = (() => {
    if (!xpSummary?.data) return [];
    const byDate = {};
    xpSummary.data.forEach(row => {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date };
      byDate[row.date][row.tool] = (byDate[row.date][row.tool] || 0) + row.xp_earned;
    });
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  })();

  const todayConcepts = dailySummary?.subtopics ?? [];
  const studyTimeByTool = studyTime?.by_tool ?? {};
  const totalStudyMins = Math.round((studyTime?.total_seconds ?? 0) / 60);

  return (
    <div className="space-y-8">
      {/* Course selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-on-surface">Progress & Analytics</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">XP earned over time and today's study breakdown.</p>
        </div>
        <select
          value={selectedCourseId || ''}
          onChange={e => onSelectCourse(e.target.value)}
          className="bg-surface-container-high border border-outline-variant/20 rounded-xl px-3 py-2 text-sm font-black text-on-surface focus:ring-1 focus:ring-primary/50 transition-all"
        >
          {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Today's study time strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Productive time', value: `${totalStudyMins}m`, color: 'text-secondary', desc: 'Active interactions only' },
          { label: 'XP today', value: `+${dailySummary?.total_xp_today ?? 0}`, color: 'text-primary', desc: 'Across all tools' },
          { label: 'Mastery gained', value: `+${(dailySummary?.mastery_gained_today ?? 0).toFixed(1)}%`, color: 'text-secondary', desc: 'Sub-Topic % change' },
          { label: 'Topics studied', value: todayConcepts.length, color: 'text-primary', desc: 'Subtopics touched' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-container-low border border-outline-variant/10 rounded-xl p-4">
            <p className="text-[9px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">{stat.label}</p>
            <p className={`text-xl font-black ${stat.color}`}>{loading ? '—' : stat.value}</p>
            <p className="text-[9px] text-on-surface-variant/60 mt-1">{stat.desc}</p>
          </div>
        ))}
      </div>

      {/* XP chart — stacked by tool */}
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-black text-on-surface">XP Earned — Last 30 Days</h3>
          <div className="flex gap-3">
            {Object.entries(ToolColors).map(([tool, color]) => (
              <div key={tool} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-on-surface-variant capitalize font-bold">{tool}</span>
              </div>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="date"
                  tick={{ fill: 'rgba(248,254,246,0.4)', fontSize: 9, fontWeight: 600 }}
                  tickLine={false} axisLine={false}
                  tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fill: 'rgba(248,254,246,0.4)', fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: '#242e25', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12 }}
                  labelStyle={{ color: '#d8e8d6', fontSize: 10, fontWeight: 700 }}
                  itemStyle={{ fontSize: 10 }}
                />
                {Object.entries(ToolColors).map(([tool, color]) => (
                  <Bar key={tool} dataKey={tool} stackId="a" fill={color} radius={tool === 'reading' ? [3,3,0,0] : [0,0,0,0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-52 flex flex-col items-center justify-center gap-3 border border-dashed border-outline-variant/20 rounded-xl">
            <span className="material-symbols-outlined text-4xl text-on-surface-variant/20">bar_chart</span>
            <p className="text-xs text-on-surface-variant">No XP data yet — start studying to see progress here.</p>
          </div>
        )}
      </div>

      {/* Today's activity feed */}
      <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6">
        <h3 className="text-sm font-black text-on-surface mb-4">Today's Activity</h3>
        {todayConcepts.length === 0 ? (
          <p className="text-xs text-on-surface-variant/60 py-6 text-center">No activity recorded yet today.</p>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {todayConcepts.map((item, i) => {
              const tools = (item.tools_used || '').split(',').filter(Boolean);
              return (
                <div key={i} className="flex items-center gap-3 p-3 bg-surface-container/50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-on-surface truncate">{item.concept_name}</p>
                    <p className="text-[9px] text-on-surface-variant">{item.filename}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {tools.map(t => <ToolDot key={t} tool={t} />)}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-black text-secondary">+{item.xp_today} XP</p>
                    {item.mastery_delta_today > 0 && (
                      <p className="text-[9px] text-secondary/70">+{item.mastery_delta_today.toFixed(1)}%</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Study time by tool */}
      {Object.keys(studyTimeByTool).length > 0 && (
        <div className="bg-surface-container-low border border-outline-variant/10 rounded-2xl p-6">
          <h3 className="text-sm font-black text-on-surface mb-4">Productive Time by Tool — Today</h3>
          <div className="space-y-3">
            {Object.entries(studyTimeByTool).map(([tool, seconds]) => {
              const mins = Math.round(seconds / 60);
              const color = ToolColors[tool] || '#7a807a';
              const pct = totalStudyMins > 0 ? (mins / totalStudyMins) * 100 : 0;
              return (
                <div key={tool} className="flex items-center gap-3">
                  <ToolDot tool={tool} />
                  <span className="text-xs text-on-surface capitalize w-20 shrink-0">{tool}</span>
                  <div className="flex-1">
                    <MasteryBar pct={pct} color={color} height="h-2" />
                  </div>
                  <span className="text-xs font-black shrink-0" style={{ color }}>{mins}m</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Mastery component
// ─────────────────────────────────────────────────────────────────────────────

const Mastery = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useAuraHelp(
    'Your mastery % shows real course completion not just flashcard scores. Click a course card to see the full concept tree, or check Review Queue to see what needs attention.',
    { label: 'Go to Flashcards', onClick: () => navigate('/flashcards') }
  );

  const urlCourseId  = searchParams.get('id');
  const urlTab       = searchParams.get('tab') || 'overview';

  const [activeTab, setActiveTab] = useState(urlTab);
  const [courses, setCourses]     = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(urlCourseId || localStorage.getItem('activeCourse') || null);

  // V2 data state
  const [courseGraphs, setCourseGraphs]     = useState({});   // { courseId: graph }
  const [dailySummaries, setDailySummaries] = useState([]);
  const [xpSummary, setXpSummary]           = useState(null);
  const [dailyBreakdown, setDailyBreakdown] = useState(null);
  const [staleSubtopics, setStaleSubtopics] = useState([]);
  const [studyTime, setStudyTime]           = useState(null);
  const [loading, setLoading]               = useState(false);

  const switchTab = useCallback((tab) => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      return p;
    });
  }, [setSearchParams]);

  const selectCourse = useCallback((id) => {
    setSelectedCourse(id);
    localStorage.setItem('activeCourse', id);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('id', id);
      return p;
    });
    if (activeTab === 'overview') switchTab('detail');
  }, [activeTab, setSearchParams, switchTab]);

  // Fetch course list + per-course V2 mastery summary for the overview cards
  useEffect(() => {
    const load = async () => {
      try {
        const res = await statService.getCourses();
        const list = res.data.courses || [];
        setCourses(list);
        if (list.length > 0 && !selectedCourse) {
          setSelectedCourse(list[0].id);
          localStorage.setItem('activeCourse', list[0].id);
        }

        // Fetch course mastery overview for each course (lightweight)
        const summaries = await Promise.allSettled(
          list.map(c => masteryService.v2.getCourseMastery(c.id)
            .then(r => ({ course_id: c.id, ...r.data }))
          )
        );
        const graphs = {};
        summaries.forEach((r, i) => {
          if (r.status === 'fulfilled') {
            graphs[list[i].id] = r.value;
          }
        });
        // Attach V2 mastery to course objects — fall back to legacy mastery% if V2 has none
        setCourses(list.map(c => ({
          ...c,
          v2_mastery: graphs[c.id] ?? null,
          // If V2 has no documents yet, legacy mastery % is still shown on the ring
          display_mastery: graphs[c.id]?.course_mastery_pct ?? c.mastery ?? 0,
        })));

        // Daily XP summaries for the overview banner
        const dailyRes = await Promise.allSettled(
          list.map(c => masteryService.v2.getDaily(c.id)
            .then(r => ({ course_id: c.id, course_name: c.name, ...r.data }))
          )
        );
        setDailySummaries(
          dailyRes.filter(r => r.status === 'fulfilled').map(r => r.value)
        );
      } catch (e) {
        console.error('Mastery overview load error', e);
      }
    };
    load();
  }, []);

  // Load tab-specific data when tab or course changes
  useEffect(() => {
    if (!selectedCourse) return;

    const loadDetail = async () => {
      if (courseGraphs[selectedCourse]) return; // already loaded
      setLoading(true);
      try {
        const res = await masteryService.v2.getCourseGraph(selectedCourse);
        setCourseGraphs(prev => ({ ...prev, [selectedCourse]: res.data }));
      } catch (e) {
        console.error('Course graph load error', e);
      } finally {
        setLoading(false);
      }
    };

    const loadReview = async () => {
      setLoading(true);
      try {
        const res = await masteryService.v2.getStale(selectedCourse, 7);
        setStaleSubtopics(res.data.stale_subtopics || []);
      } catch (e) {
        console.error('Stale load error', e);
      } finally {
        setLoading(false);
      }
    };

    const loadProgress = async () => {
      setLoading(true);
      try {
        const [xp, breakdown, daily] = await Promise.all([
          masteryService.v2.getXpSummary(selectedCourse, 30),
          masteryService.v2.getDailyBreakdown(selectedCourse),
          masteryService.v2.getDaily(selectedCourse),
        ]);
        setXpSummary(xp.data);
        // Merge daily summary fields + today's subtopic breakdown into one object
        setDailyBreakdown({
          ...daily.data,                          // total_xp_today, mastery_gained_today
          subtopics: breakdown.data?.subtopics ?? [], // per-subtopic activity feed
        });
        setStudyTime(daily.data?.study_time ?? null);
        // Also update the overview banner daily summaries
        setDailySummaries(prev => prev.map(d =>
          d.course_id === selectedCourse ? { ...d, ...daily.data } : d
        ));
      } catch (e) {
        console.error('Progress load error', e);
      } finally {
        setLoading(false);
      }
    };

    if (activeTab === 'detail') loadDetail();
    else if (activeTab === 'review') loadReview();
    else if (activeTab === 'progress') loadProgress();
    // Always pre-load progress data for the XP banner on overview
    if (activeTab === 'overview') loadProgress();
  }, [activeTab, selectedCourse]);

  const handleReset = async (courseId) => {
    try {
      await masteryService.v2.reset(courseId);
      showToast('Course mastery reset.', 'success');
      // Clear cached graph so it reloads fresh
      setCourseGraphs(prev => { const n = {...prev}; delete n[courseId]; return n; });
    } catch {
      showToast('Reset failed. Please try again.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 relative overflow-hidden">
      <div className="fixed top-1/4 -right-64 h-[600px] w-[600px] bg-primary/4 blur-[150px] rounded-full pointer-events-none z-0" />

      <div className="max-w-[1400px] mx-auto relative z-10">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8"
        >
          <div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-on-surface">
              Mastery
            </h1>
            <p className="text-on-surface-variant text-xs mt-1.5 max-w-sm">
              Track your real course completion — concepts extracted from your documents, scored across every tool.
            </p>
          </div>

          {/* Overall mastery pill */}
          {courses.length > 0 && (() => {
            const avg = courses.reduce((s, c) => s + (c.v2_mastery?.course_mastery_pct ?? c.mastery ?? 0), 0) / courses.length;
            return (
              <div className="flex items-center gap-3 px-5 py-3 bg-secondary/10 border border-secondary/20 rounded-full">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-secondary font-black">Overall</p>
                  <p className="text-2xl font-black text-secondary">{Math.round(avg)}%</p>
                </div>
                <MasteryRing pct={avg} size={48} stroke={3} />
              </div>
            );
          })()}
        </motion.div>

        {/* Tab bar */}
        <TabBar active={activeTab} onChange={switchTab} />

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'overview' && (
              <OverviewTab
                courses={courses}
                loading={courses.length === 0}
                onSelectCourse={selectCourse}
                dailySummaries={dailySummaries}
              />
            )}
            {activeTab === 'detail' && (
              <DetailTab
                courseGraph={courseGraphs[selectedCourse]}
                selectedCourseId={selectedCourse}
                courses={courses}
                onSelectCourse={selectCourse}
                loading={loading}
                navigate={navigate}
                onReset={handleReset}
              />
            )}
            {activeTab === 'review' && (
              <ReviewTab
                staleSubtopics={staleSubtopics}
                selectedCourseId={selectedCourse}
                courses={courses}
                onSelectCourse={selectCourse}
                loading={loading}
                navigate={navigate}
              />
            )}
            {activeTab === 'progress' && (
              <ProgressTab
                selectedCourseId={selectedCourse}
                courses={courses}
                onSelectCourse={selectCourse}
                xpSummary={xpSummary}
                dailySummary={dailyBreakdown}
                studyTime={studyTime}
                loading={loading}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Mastery;
