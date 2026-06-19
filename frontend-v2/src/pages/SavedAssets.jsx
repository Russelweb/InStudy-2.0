import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { assetService } from '../services/api';
import { ConfirmModal } from '../components/Modal';
import { showToast } from '../components/Toast';

const TYPE_CONFIG = {
  flashcards: {
    label: 'Flashcard Deck',
    icon: 'style',
    color: 'primary',
    route: '/flashcards',
    accent: 'border-primary/30 hover:border-primary/50',
    iconBg: 'bg-primary/15 text-primary',
  },
  quiz: {
    label: 'Quiz',
    icon: 'quiz',
    color: 'secondary',
    route: '/quiz',
    accent: 'border-secondary/30 hover:border-secondary/50',
    iconBg: 'bg-secondary/15 text-secondary',
  },
  study_plan: {
    label: 'Study Plan',
    icon: 'event_note',
    color: 'tertiary',
    route: '/planner',
    accent: 'border-tertiary/30 hover:border-tertiary/50',
    iconBg: 'bg-tertiary/15 text-tertiary',
  },
  summary: {
    label: 'Summary',
    icon: 'description',
    color: 'primary',
    route: '/summary-view',
    accent: 'border-primary/30 hover:border-primary/50',
    iconBg: 'bg-primary/15 text-primary',
  },
};

const getMetaLine = (asset) => {
  const m = asset.metadata || {};
  switch (asset.asset_type) {
    case 'flashcards':
      return m.card_count ? `${m.card_count} cards` : null;
    case 'quiz':
      if (m.score != null) return `${Math.round(m.score)}% score Â· ${m.total_questions || '?'} questions`;
      return m.total_questions ? `${m.total_questions} questions` : null;
    case 'study_plan':
      if (m.exam_date) {
        const d = new Date(m.exam_date);
        return `Exam: ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
      }
      return m.topic_count ? `${m.topic_count} topics` : null;
    case 'summary':
      return m.style ? `Style: ${m.style}` : m.document ? `Doc: ${m.document}` : null;
    default:
      return null;
  }
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const AssetCard = ({ asset, onLoad, onDelete }) => {
  const cfg = TYPE_CONFIG[asset.asset_type] || TYPE_CONFIG.flashcards;
  const meta = getMetaLine(asset);
  const isQuiz = asset.asset_type === 'quiz';
  const hasResults = isQuiz && asset.data?.results;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      whileHover={{ y: -3 }}
      className={`glass-panel rounded-xl p-5 border ${cfg.accent} transition-all group flex flex-col`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
          <span className="material-symbols-outlined text-2xl">{cfg.icon}</span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(asset.id); }}
          className="p-2 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
          title="Delete asset"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
        </button>
      </div>

      {/* Title + type tag */}
      <h3 className="text-base font-bold text-on-surface mb-1 line-clamp-2 group-hover:text-primary transition-colors">
        {asset.title}
      </h3>
      <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-2 flex-wrap">
        <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-bold uppercase tracking-wider">
          {cfg.label}
        </span>
        <span className="truncate max-w-[140px]">{asset.course_id.replace(/_/g, ' ')}</span>
      </div>

      {/* Metadata line */}
      {meta && (
        <p className="text-[11px] text-on-surface-variant/80 font-medium mb-3">{meta}</p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-outline-variant/10 space-y-2">
        <div className="flex items-center text-[10px] text-on-surface-variant">
          <span className="flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">schedule</span>
            {formatDate(asset.updated_at)}
          </span>
        </div>

        {/* Actions */}
        {isQuiz ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onLoad(asset, 'retake')}
              className="py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-sm">replay</span>
              Retake
            </button>
            <button
              onClick={() => onLoad(asset, 'results')}
              disabled={!hasResults}
              className="py-2 rounded-lg bg-surface-container-high text-on-surface-variant border border-outline-variant/20 text-[10px] font-black uppercase tracking-wider hover:bg-surface-variant transition-all flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              Results
            </button>
          </div>
        ) : (
          <button
            onClick={() => onLoad(asset, 'default')}
            className="w-full py-2 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 transition-all flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">open_in_new</span>
            Open
          </button>
        )}
      </div>
    </motion.div>
  );
};

const SavedAssets = () => {
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const navigate = useNavigate();

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const assetType = filter === 'all' ? null : filter;
      const response = await assetService.list(assetType);
      setAssets(response.data.assets || []);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      showToast('Failed to load saved assets.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await assetService.getStats();
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
    fetchStats();
  }, [fetchAssets, fetchStats]);

  const handleDelete = (assetId) => {
    setPendingDeleteId(assetId);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    setDeleteModalOpen(false);
    try {
      await assetService.delete(pendingDeleteId);
      fetchAssets();
      fetchStats();
      showToast('Asset deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete asset:', error);
      showToast('Failed to delete asset.', 'error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  // â”€â”€ Handoff via React Router state (clean, synchronous, no localStorage) â”€â”€
  const handleLoad = (asset, loadMode = 'default') => {
    const cfg = TYPE_CONFIG[asset.asset_type];
    if (!cfg) return;
    navigate(cfg.route, { state: { loadedAsset: asset, loadMode } });
  };

  const STAT_CARDS = [
    { type: 'flashcards', label: 'Flashcard Decks', icon: 'style',       color: 'primary'   },
    { type: 'quiz',       label: 'Quizzes',         icon: 'quiz',        color: 'secondary' },
    { type: 'study_plan', label: 'Study Plans',     icon: 'event_note',  color: 'tertiary'  },
    { type: 'summary',    label: 'Summaries',       icon: 'description', color: 'primary'   },
  ];

  const FILTERS = ['all', 'flashcards', 'quiz', 'study_plan', 'summary'];
  const getTypeLabel = (f) => TYPE_CONFIG[f]?.label || 'All Assets';

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tighter text-on-surface mb-2">My Saved Assets</h1>
          <p className="text-on-surface-variant text-xs sm:text-sm">Access your saved flashcards, quizzes, summaries, and study plans</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
          {STAT_CARDS.map(({ type, label, icon, color }) => (
            <motion.div
              key={type}
              whileHover={{ y: -4 }}
              onClick={() => setFilter(type)}
              className={`glass-panel p-4 md:p-6 rounded-xl cursor-pointer transition-all border ${
                filter === type ? `border-${color} bg-${color}/5` : 'border-outline-variant/10'
              }`}
            >
              <span className={`material-symbols-outlined text-2xl md:text-3xl text-${color} mb-2 block`}>{icon}</span>
              <div className="text-2xl md:text-3xl font-black text-on-surface">{stats[type] || 0}</div>
              <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 md:px-4 py-2 rounded-lg text-[10px] md:text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${
                filter === f
                  ? 'bg-primary text-on-primary'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {f === 'all' ? 'All Assets' : getTypeLabel(f)}
            </button>
          ))}
        </div>

        {/* Assets Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-20">
            <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-4 block">folder_open</span>
            <p className="text-on-surface-variant text-lg">No saved assets yet</p>
            <p className="text-on-surface-variant/60 text-sm mt-2">Generate flashcards, quizzes, or study plans and save them for later</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onLoad={handleLoad}
                  onDelete={handleDelete}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Delete confirm modal */}
      <ConfirmModal
        open={deleteModalOpen}
        title="Delete Asset?"
        description="This saved asset will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep It"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => { setDeleteModalOpen(false); setPendingDeleteId(null); }}
      />
    </div>
  );
};

export default SavedAssets;
