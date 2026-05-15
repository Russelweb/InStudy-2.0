import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { assetService } from '../services/api';
import { ConfirmModal } from '../components/Modal';
import { showToast } from '../components/Toast';

const SavedAssets = () => {
  const [assets, setAssets] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAssets();
    fetchStats();
  }, [filter]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const assetType = filter === 'all' ? null : filter;
      const response = await assetService.list(assetType);
      setAssets(response.data.assets || []);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await assetService.getStats();
      setStats(response.data.stats || {});
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const handleDelete = async (assetId) => {
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
      showToast('Failed to delete asset. Please try again.', 'error');
    } finally {
      setPendingDeleteId(null);
    }
  };

  const handleLoad = (asset) => {
    // Store the asset data in localStorage with a special key
    localStorage.setItem(`load_asset_${asset.asset_type}`, JSON.stringify(asset));
    
    // Navigate to the appropriate page
    const routes = {
      flashcards: '/flashcards',
      quiz: '/quiz',
      study_plan: '/planner',
      summary: '/summary'
    };
    
    navigate(routes[asset.asset_type] || '/');
  };

  const getIcon = (type) => {
    const icons = {
      flashcards: 'style',
      quiz: 'quiz',
      study_plan: 'event_note',
      summary: 'description'
    };
    return icons[type] || 'folder';
  };

  const getTypeLabel = (type) => {
    const labels = {
      flashcards: 'Flashcard Deck',
      quiz: 'Quiz',
      study_plan: 'Study Plan',
      summary: 'Summary'
    };
    return labels[type] || type;
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

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
          {[
            { type: 'flashcards', label: 'Flashcard Decks', icon: 'style', color: 'primary' },
            { type: 'quiz', label: 'Quizzes', icon: 'quiz', color: 'secondary' },
            { type: 'study_plan', label: 'Study Plans', icon: 'event_note', color: 'tertiary' },
            { type: 'summary', label: 'Summaries', icon: 'description', color: 'primary' }
          ].map(({ type, label, icon, color }) => (
            <motion.div
              key={type}
              whileHover={{ y: -4 }}
              onClick={() => setFilter(type)}
              className={`glass-panel p-4 md:p-6 rounded-xl cursor-pointer transition-all ${
                filter === type ? 'border-' + color + ' bg-' + color + '/5' : 'border-outline-variant/10'
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
          {['all', 'flashcards', 'quiz', 'study_plan', 'summary'].map((f) => (
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
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
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
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ y: -4 }}
                  className="glass-panel rounded-xl p-6 border border-outline-variant/10 hover:border-primary/30 transition-all cursor-pointer group"
                  onClick={() => handleLoad(asset)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-2xl">{getIcon(asset.asset_type)}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(asset.id); }}
                      className="p-2 rounded-lg hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-on-surface mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                    {asset.title}
                  </h3>

                  <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-3">
                    <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-bold uppercase tracking-wider">
                      {getTypeLabel(asset.asset_type)}
                    </span>
                    <span>•</span>
                    <span>{asset.course_id.replace(/_/g, ' ')}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-on-surface-variant pt-3 border-t border-outline-variant/10">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      {formatDate(asset.updated_at)}
                    </span>
                    <span className="text-primary font-bold group-hover:underline">Load →</span>
                  </div>
                </motion.div>
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
