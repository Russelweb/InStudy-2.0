import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { adminService } from '../services/api';
import { showToast } from '../components/Toast';
import { usePagination } from '../hooks/usePagination';
import Pagination from '../components/Pagination';

const USERS_PER_PAGE        = 10;
const INTERACTIONS_PER_PAGE = 20;
const LOGS_PER_PAGE         = 25;

const AdminDashboard = () => {
  const [activeTab, setActiveTab]         = useState('overview');
  const [stats, setStats]                 = useState(null);
  const [users, setUsers]                 = useState([]);
  const [interactions, setInteractions]   = useState([]);
  const [allCourses, setAllCourses]       = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [selectedUser, setSelectedUser]   = useState(null);
  const [userCourses, setUserCourses]     = useState([]);
  const [confirmModal, setConfirmModal]   = useState({ show: false, type: '', data: null });

  // Search states
  const [userSearch, setUserSearch]         = useState('');
  const [interactionSearch, setInteractionSearch] = useState('');

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const statsRes      = await adminService.getStats();
      const usersRes      = await adminService.getUsers();
      const interactRes   = await adminService.getInteractions();
      const allCourseRes  = await adminService.getAllCourses();
      setStats(statsRes.data);
      setUsers(usersRes.data.users);
      setInteractions(interactRes.data.interactions);
      setAllCourses(allCourseRes.data.courses);
    } catch (err) {
      console.error(err);
      setError('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setUserCourses([]);
    try {
      const res = await adminService.getUserCourses(user.id);
      setUserCourses(res.data.courses);
    } catch (err) { console.error(err); }
  };

  const handleAction = async (type, data) => {
    try {
      if (type === 'makeAdmin')      await adminService.makeAdmin(data);
      if (type === 'revokeAdmin')    await adminService.revokeAdmin(data);
      if (type === 'deleteUser')     await adminService.deleteUser(data);
      if (type === 'deleteCourse')   await adminService.deleteCourse(data.userId, data.courseId);
      if (type === 'deleteDocument') await adminService.deleteDocument(data.userId, data.courseId, data.filename);
      fetchInitialData();
      if (selectedUser) handleUserClick(selectedUser);
      setConfirmModal({ show: false, type: '', data: null });
    } catch (err) {
      console.error(err);
      showToast('Action failed. Please try again.', 'error');
    }
  };

  // ── Filtered lists ─────────────────────────────────────────────────────────
  const filteredUsers = users.filter((u) =>
    !userSearch ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    String(u.id).includes(userSearch)
  );

  const filteredInteractions = interactions.filter((i) =>
    !interactionSearch ||
    (i.user_email || '').toLowerCase().includes(interactionSearch.toLowerCase()) ||
    (i.course || '').toLowerCase().includes(interactionSearch.toLowerCase()) ||
    (i.content || '').toLowerCase().includes(interactionSearch.toLowerCase())
  );

  // ── Pagination hooks ───────────────────────────────────────────────────────
  const usersPag = usePagination(filteredUsers, USERS_PER_PAGE);
  const interPag = usePagination(filteredInteractions, INTERACTIONS_PER_PAGE);
  const logsPag  = usePagination(interactions, LOGS_PER_PAGE);

  // Reset pages on search change
  useEffect(() => { usersPag.resetPage(); }, [userSearch]);
  useEffect(() => { interPag.resetPage(); }, [interactionSearch]);

  if (loading) return (
    <div className="flex h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[#bd9dff]/20 border-t-[#bd9dff] rounded-full animate-spin"></div>
        <p className="text-[#bd9dff] font-medium animate-pulse">Accessing information...</p>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 pb-32">
      {/* Header */}
      <div className="mb-6 md:mb-10 flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 md:gap-6">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight"
          >
            ADMIN <span className="text-[#bd9dff]">OVERRIDE</span>
          </motion.h1>
          <p className="text-on-surface-variant/60 font-medium mt-1 text-xs sm:text-sm">System Administration & Master Control</p>
        </div>

        <div className="flex p-1 bg-[#202821]/50 rounded-xl border border-white/5 backdrop-blur-md self-stretch md:self-auto overflow-x-auto">
          {['overview', 'users', 'interactions', 'logs'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 md:px-6 py-2 rounded-lg text-xs md:text-sm font-bold transition-all duration-300 capitalize flex-1 md:flex-none whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-[#bd9dff] text-[#0a0f0b] shadow-[0_0_20px_rgba(189,157,255,0.4)]'
                  : 'text-on-surface/60 hover:text-white'
              }`}
            >
              {tab === 'logs' ? 'System Logs' : tab}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-4 gap-6"
          >
            <div className="col-span-1"><StatCard label="Total Users" value={stats?.total_users} icon="groups" color="accent" /></div>
            <div className="col-span-1"><StatCard label="Administrators" value={stats?.total_admins} icon="security" color="primary" /></div>
            <div className="col-span-1"><StatCard label="Active Courses" value={stats?.total_courses} icon="menu_book" color="secondary" /></div>
            <div className="col-span-1"><StatCard label="Documents Processed" value={stats?.total_documents} icon="description" color="tertiary" /></div>

            <div className="col-span-1 md:col-span-2 mt-4">
              <div className="glass-morphism p-6 rounded-2xl border border-white/10">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-green-400">vital_signs</span>
                  System Core Health
                </h3>
                <div className="space-y-4">
                  <HealthItem label="Database Cluster" status="Operational" latency="12ms" />
                  <HealthItem label="Neural Engine (LLM)" status="Operational" latency="1.2s" />
                  <HealthItem label="Vector Storage" status="Optimized" latency="45ms" />
                  <HealthItem label="Auth Gateway" status="Secure" latency="8ms" />
                </div>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2 mt-4">
              <div className="glass-morphism p-6 rounded-2xl border border-white/10 h-full">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#bd9dff]">bolt</span>
                  Live Interaction Pulse
                </h3>
                <div className="space-y-4 text-[10px] font-mono text-on-surface-variant/80">
                  {interactions.slice(0, 5).map((log, i) => (
                    <p key={i} className="border-b border-white/5 pb-2">
                      <span className="text-[#bd9dff]">[{new Date(log.timestamp).toLocaleTimeString()}]</span>{' '}
                      <span className="text-[#69f6b8]">{log.user_email}</span> queried{' '}
                      <span className="text-white">{log.course}</span>:{' '}
                      <span className="italic text-on-surface-variant/60">"{log.content?.substring(0, 40)}..."</span>
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="md:col-span-2 glass-morphism rounded-2xl border border-white/10 overflow-hidden">
              {/* Search bar */}
              <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
                <span className="material-symbols-outlined text-sm text-[#bd9dff]/60">search</span>
                <input
                  type="text"
                  placeholder="Search users by email or ID…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
                />
                {userSearch && (
                  <button onClick={() => setUserSearch('')} className="text-white/30 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#bd9dff] font-black">ID</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#bd9dff] font-black">User Identity</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#bd9dff] font-black">Role</th>
                      <th className="px-6 py-4 text-xs uppercase tracking-widest text-[#bd9dff] font-black">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersPag.pageItems.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => handleUserClick(user)}
                        className={`border-b border-white/5 cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-[#bd9dff]/10' : 'hover:bg-white/5'}`}
                      >
                        <td className="px-6 py-4 text-sm font-mono text-on-surface-variant/60">{user.id}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[#bd9dff]/20 flex items-center justify-center">
                              <span className="material-symbols-outlined text-sm text-[#bd9dff]">person</span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{user.email}</p>
                              <p className="text-[10px] text-on-surface-variant/60">{new Date(user.created_at).toLocaleDateString()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {user.is_admin ? (
                            <span className="px-2 py-1 rounded text-[10px] font-black bg-[#bd9dff]/20 text-[#bd9dff] border border-[#bd9dff]/30 uppercase tracking-tighter">Admin</span>
                          ) : (
                            <span className="px-2 py-1 rounded text-[10px] font-black bg-white/10 text-white/40 border border-white/5 uppercase tracking-tighter">User</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmModal({ show: true, type: user.is_admin ? 'revokeAdmin' : 'makeAdmin', data: user.id }); }}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-on-surface-variant/60 hover:text-[#bd9dff] transition-colors"
                              title={user.is_admin ? 'Revoke Admin' : 'Make Admin'}
                            >
                              <span className="material-symbols-outlined text-lg">{user.is_admin ? 'no_encryption' : 'admin_panel_settings'}</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setConfirmModal({ show: true, type: 'deleteUser', data: user.id }); }}
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-on-surface-variant/60 hover:text-red-400 transition-colors"
                              title="Purge User"
                            >
                              <span className="material-symbols-outlined text-lg">delete_sweep</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {usersPag.pageItems.length === 0 && (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-on-surface-variant/30 italic">
                          No users match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* User pagination */}
              <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
                <p className="text-[10px] text-on-surface-variant/40">
                  {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} · Page {usersPag.page} of {usersPag.totalPages}
                </p>
                <Pagination
                  page={usersPag.page}
                  totalPages={usersPag.totalPages}
                  hasPrev={usersPag.hasPrev}
                  hasNext={usersPag.hasNext}
                  onPrev={usersPag.goPrev}
                  onNext={usersPag.goNext}
                  onPage={usersPag.setPage}
                />
              </div>
            </div>

            {/* Selected User Detail Sidebar */}
            <div className="md:col-span-1">
              <AnimatePresence mode="wait">
                {selectedUser ? (
                  <motion.div
                    key={selectedUser.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="glass-morphism p-6 rounded-2xl border border-[#bd9dff]/20 sticky top-8"
                  >
                    <div className="flex items-start justify-between mb-8">
                      <div>
                        <h3 className="text-xl font-black text-white">{selectedUser.email}</h3>
                        <p className="text-xs text-[#bd9dff] font-mono mt-1 uppercase tracking-widest">ID: {selectedUser.id}</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-[#bd9dff] flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl text-[#0a0f0b]">person_search</span>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 mb-3 font-bold">Repository Access</p>
                        <div className="space-y-3">
                          {userCourses.length > 0 ? (
                            userCourses.map(course => (
                              <div key={course.id} className="p-3 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex justify-between items-center mb-2">
                                  <p className="text-sm font-bold text-white">{course.name}</p>
                                  <button
                                    onClick={() => setConfirmModal({ show: true, type: 'deleteCourse', data: { userId: selectedUser.id, courseId: course.id } })}
                                    className="text-red-400 hover:text-red-300 transition-colors"
                                  >
                                    <span className="material-symbols-outlined text-sm">delete</span>
                                  </button>
                                </div>
                                <div className="space-y-1 mt-2">
                                  {course.documents.map((doc, idx) => (
                                    <div key={idx} className="flex justify-between items-center px-3 py-2 bg-black/20 rounded-lg group/doc">
                                      <span className="text-[10px] text-on-surface-variant/80 truncate max-w-[180px]">{doc}</span>
                                      <button
                                        onClick={() => setConfirmModal({ show: true, type: 'deleteDocument', data: { userId: selectedUser.id, courseId: course.id, filename: doc } })}
                                        className="text-red-500/0 group-hover/doc:text-red-500/60 hover:!text-red-400 transition-all"
                                      >
                                        <span className="material-symbols-outlined text-xs">close</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="p-8 text-center bg-white/5 rounded-xl border border-dashed border-white/10">
                              <span className="material-symbols-outlined text-white/20 text-4xl mb-2">folder_off</span>
                              <p className="text-xs text-white/30">No active knowledge repositories found.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="glass-morphism p-12 rounded-2xl border border-white/5 flex flex-col items-center justify-center text-center">
                    <span className="material-symbols-outlined text-[#bd9dff]/20 text-6xl mb-4">search_check</span>
                    <h3 className="text-white/40 font-bold italic">Select a user identity <br/> to view detailed matrix data.</h3>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* ── Interactions ── */}
        {activeTab === 'interactions' && (
          <motion.div
            key="interactions"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-morphism rounded-2xl border border-white/10 overflow-hidden"
          >
            {/* Header + search */}
            <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Live Neural Interactions</h2>
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase">Live Link Active</span>
              </div>
              <div className="relative shrink-0">
                <span className="material-symbols-outlined text-sm absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none">search</span>
                <input
                  type="text"
                  placeholder="Filter by user, course, or query…"
                  value={interactionSearch}
                  onChange={(e) => setInteractionSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 text-xs bg-white/5 rounded-xl border border-white/10 focus:outline-none focus:border-[#bd9dff]/50 text-white w-full sm:w-64 placeholder:text-white/20 transition-colors"
                />
                {interactionSearch && (
                  <button onClick={() => setInteractionSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-on-surface-variant/60">
                    <th className="px-6 py-4 font-black">Timestamp</th>
                    <th className="px-6 py-4 font-black">Subject</th>
                    <th className="px-6 py-4 font-black">Matrix Path</th>
                    <th className="px-6 py-4 font-black">Query Content</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {interPag.pageItems.map((q, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 text-xs font-mono text-[#bd9dff]">{new Date(q.timestamp).toLocaleString()}</td>
                      <td className="px-6 py-4 text-xs font-bold text-white">{q.user_email}</td>
                      <td className="px-6 py-4 text-xs text-on-surface-variant/60">{q.course}</td>
                      <td className="px-6 py-4 text-xs italic text-on-surface-variant/80">"{q.content}"</td>
                    </tr>
                  ))}
                  {interPag.pageItems.length === 0 && (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-on-surface-variant/30 italic">
                        {interactionSearch ? 'No interactions match your filter.' : 'No interactions detected in current quadrant.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
              <p className="text-[10px] text-on-surface-variant/40">
                {filteredInteractions.length} record{filteredInteractions.length !== 1 ? 's' : ''} · Page {interPag.page} of {interPag.totalPages}
              </p>
              <Pagination
                page={interPag.page}
                totalPages={interPag.totalPages}
                hasPrev={interPag.hasPrev}
                hasNext={interPag.hasNext}
                onPrev={interPag.goPrev}
                onNext={interPag.goNext}
                onPage={interPag.setPage}
              />
            </div>
          </motion.div>
        )}

        {/* ── Logs ── */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="glass-morphism p-8 rounded-3xl border border-white/10 bg-black/40"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              <h2 className="text-xl font-black text-white uppercase tracking-tighter">System Audit Logs</h2>
              <span className="ml-auto text-[10px] text-on-surface-variant/40 font-mono">
                Showing {(logsPag.page - 1) * LOGS_PER_PAGE + 1}–{Math.min(logsPag.page * LOGS_PER_PAGE, interactions.length)} of {interactions.length}
              </span>
            </div>

            <div className="space-y-2 font-mono text-xs mb-8">
              {logsPag.pageItems.map((log, i) => (
                <div key={i} className="flex gap-4 p-2 hover:bg-white/5 rounded border-l-2 border-[#bd9dff]/30">
                  <span className="text-[#bd9dff]/60 shrink-0">[{new Date(log.timestamp).toISOString()}]</span>
                  <span className="text-secondary font-bold shrink-0">INFO</span>
                  <span className="text-white">USER_QUERY: {log.user_email} executed retrieval on '{log.course}'</span>
                  <span className="text-on-surface-variant/40 truncate flex-1">payload: {JSON.stringify(log.content)}</span>
                </div>
              ))}
              {/* Heartbeat entry always at the bottom of last page */}
              {logsPag.page === logsPag.totalPages && (
                <div className="flex gap-4 p-2 hover:bg-white/5 rounded border-l-2 border-primary/30">
                  <span className="text-[#bd9dff]/60 shrink-0">[{new Date().toISOString()}]</span>
                  <span className="text-primary font-bold shrink-0">SYS</span>
                  <span className="text-white">ADMIN_OVERRIDE: Central matrix re-synchronization heartbeat OK</span>
                </div>
              )}
            </div>

            <Pagination
              page={logsPag.page}
              totalPages={logsPag.totalPages}
              hasPrev={logsPag.hasPrev}
              hasNext={logsPag.hasNext}
              onPrev={logsPag.goPrev}
              onNext={logsPag.goNext}
              onPage={logsPag.setPage}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal({ show: false, type: '', data: null })}
              className="absolute inset-0 bg-[#141f16]/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative glass-morphism w-full max-w-md p-8 rounded-3xl border border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]"
            >
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6 mx-auto">
                <span className="material-symbols-outlined text-3xl text-red-500">warning</span>
              </div>
              <h3 className="text-xl font-black text-white text-center mb-2 uppercase tracking-tight">Destructive Action Required</h3>
              <p className="text-on-surface-variant/60 text-center mb-8">
                Are you sure you want to proceed with: <span className="text-red-400 font-bold italic">{confirmModal.type}</span>?{' '}
                This action is logged and affects primary data nodes.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setConfirmModal({ show: false, type: '', data: null })}
                  className="py-3 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors"
                >
                  ABORT
                </button>
                <button
                  onClick={() => handleAction(confirmModal.type, confirmModal.data)}
                  className="py-3 rounded-xl bg-red-500 text-white font-black hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  EXECUTE
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatCard = ({ label, value, icon, color }) => {
  const colors = {
    primary: 'text-[#bd9dff] bg-[#bd9dff]/10 border-[#bd9dff]/20',
    secondary: 'text-[#69f6b8] bg-[#69f6b8]/10 border-[#69f6b8]/20',
    tertiary: 'text-[#ff9dd2] bg-[#ff9dd2]/10 border-[#ff9dd2]/20',
    accent: 'text-[#9dceff] bg-[#9dceff]/10 border-[#9dceff]/20',
  };
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className={`glass-morphism p-4 md:p-6 rounded-2xl border ${colors[color]} backdrop-blur-xl relative overflow-hidden group`}
    >
      <div className="relative z-10">
        <div className="flex justify-between items-start mb-3 md:mb-4">
          <span className="material-symbols-outlined text-xl md:text-2xl opacity-80 group-hover:scale-110 transition-transform">{icon}</span>
        </div>
        <h4 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-1">{value || 0}</h4>
        <p className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold opacity-60">{label}</p>
      </div>
      <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40 bg-current" />
    </motion.div>
  );
};

const HealthItem = ({ label, status, latency }) => (
  <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
    <div className="flex items-center gap-3">
      <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse" />
      <span className="text-sm font-medium text-white/80">{label}</span>
    </div>
    <div className="flex items-center gap-4">
      <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">{status}</span>
      <span className="text-[10px] font-mono text-white/30">{latency}</span>
    </div>
  </div>
);

export default AdminDashboard;
