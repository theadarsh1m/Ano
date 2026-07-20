"use client";

import { API_URL } from "@/lib/config";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUserStore } from "@/store/useUserStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { 
  Users, MessageSquare, ShieldAlert, Bug, BarChart3, Settings, 
  Megaphone, Gift, FileText, Check, Trash2, Ban, Star, LogOut, Loader2
} from "lucide-react";

type Section = 'dashboard' | 'users' | 'reviews' | 'bugs' | 'reports' | 'games' | 'announcements' | 'rewards' | 'settings' | 'audit_logs';

export default function AdminPortal() {
  const router = useRouter();
  const { role, id: userId, email: adminEmail } = useUserStore();
  const [activeSection, setActiveSection] = useState<Section>('dashboard');

  // Core stats
  const [stats, setStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Users data
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Reviews data
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewStats, setReviewStats] = useState<any>(null);
  const [reviewStars, setReviewStars] = useState("");
  const [reviewCategory, setReviewCategory] = useState("");
  const [reviewSearch, setReviewSearch] = useState("");
  const [loadingReviews, setLoadingReviews] = useState(false);

  // Bug reports
  const [bugs, setBugs] = useState<any[]>([]);
  const [loadingBugs, setLoadingBugs] = useState(false);

  // User reports
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  // Games config
  const [games, setGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  // Announcements
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annDesc, setAnnDesc] = useState("");
  const [annColor, setAnnColor] = useState("red");
  const [annIcon, setAnnIcon] = useState("📢");
  const [annExpiry, setAnnExpiry] = useState("");

  // Rewards
  const [rewardType, setRewardType] = useState("COINS");
  const [rewardValue, setRewardValue] = useState("");
  const [recipientType, setRecipientType] = useState("ALL");
  const [selectedUserIds, setSelectedUserIds] = useState("");
  const [rewarding, setRewarding] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Settings
  const [settings, setSettings] = useState({
    registration: true,
    googleLogin: true,
    maintenanceMode: false,
    ratingsEnabled: true
  });
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Reward success
  const [rewardSuccess, setRewardSuccess] = useState(false);

  // Debounce timer refs
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reviewSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Verify Admin Role and load initial dashboard stats
  useEffect(() => {
    if (role !== 'SUPER_ADMIN') {
      router.push("/dashboard");
      return;
    }
    fetchStats();
  }, [role, router]);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/dashboard`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStats(false);
    }
  };

  // Section specific fetches
  useEffect(() => {
    if (role !== 'SUPER_ADMIN') return;

    if (activeSection === 'users') {
      fetchUsers();
    } else if (activeSection === 'reviews') {
      fetchReviews();
    } else if (activeSection === 'bugs') {
      fetchBugs();
    } else if (activeSection === 'reports') {
      fetchReports();
    } else if (activeSection === 'games') {
      fetchGames();
    } else if (activeSection === 'announcements') {
      fetchAnnouncements();
    } else if (activeSection === 'audit_logs') {
      fetchLogs();
    } else if (activeSection === 'settings') {
      fetchSettings();
    }
  }, [activeSection, role, userFilter]);

  // Debounced search for users
  useEffect(() => {
    if (activeSection !== 'users') return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  // Debounced search for reviews
  useEffect(() => {
    if (activeSection !== 'reviews') return;
    if (reviewSearchTimerRef.current) clearTimeout(reviewSearchTimerRef.current);
    reviewSearchTimerRef.current = setTimeout(() => {
      fetchReviews();
    }, 300);
    return () => { if (reviewSearchTimerRef.current) clearTimeout(reviewSearchTimerRef.current); };
  }, [reviewStars, reviewCategory, reviewSearch]);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users?search=${encodeURIComponent(searchQuery)}&filter=${userFilter}`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchReviews = async () => {
    setLoadingReviews(true);
    try {
      const res = await fetch(
        `${API_URL}/api/admin/reviews?stars=${reviewStars}&category=${reviewCategory}&search=${encodeURIComponent(reviewSearch)}`,
        { headers: { 'x-user-id': userId || '' } }
      );
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setReviewStats(data.stats);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const fetchBugs = async () => {
    setLoadingBugs(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/bugs`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        setBugs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBugs(false);
    }
  };

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        setReports(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };

  const fetchGames = async () => {
    setLoadingGames(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/games`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        setGames(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGames(false);
    }
  };

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/announcements`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        setAnnouncements(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingAnnouncements(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/audit-logs`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        setAuditLogs(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  // User Actions
  const handleBanUser = async (targetId: string, ban: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${targetId}/${ban ? 'ban' : 'unban'}`, {
        method: 'POST',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = async (targetId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user account?")) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${targetId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  // Reviews actions
  const handleMarkReviewRead = async (reviewId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reviews/${reviewId}/read`, {
        method: 'POST',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) fetchReviews();
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchiveReview = async (reviewId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reviews/${reviewId}/archive`, {
        method: 'POST',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) fetchReviews();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) fetchReviews();
    } catch (err) {
      console.error(err);
    }
  };

  // Bugs status change
  const handleBugStatus = async (bugId: string, status: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/bugs/${bugId}/status`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-id': userId || '' 
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) fetchBugs();
    } catch (err) {
      console.error(err);
    }
  };

  // Report actions
  const handleReportAction = async (reportId: string, actionType: string, reportedUserId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/reports/${reportId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({ actionType, reportedUserId })
      });
      if (res.ok) fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  // Game config actions
  const handleToggleGame = async (gameId: string, field: string, value: boolean) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/games/${gameId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({ [field]: value })
      });
      if (res.ok) fetchGames();
    } catch (err) {
      console.error(err);
    }
  };

  // Announcement actions
  const handlePublishAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle.trim() || !annDesc.trim()) return;

    try {
      const res = await fetch(`${API_URL}/api/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({
          title: annTitle,
          description: annDesc,
          color: annColor,
          icon: annIcon,
          expiryDate: annExpiry || null
        })
      });

      if (res.ok) {
        setAnnTitle("");
        setAnnDesc("");
        setAnnExpiry("");
        fetchAnnouncements();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteAnnouncement = async (annId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/admin/announcements/${annId}`, {
        method: 'DELETE',
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) fetchAnnouncements();
    } catch (err) {
      console.error(err);
    }
  };

  // Reward actions
  const handleGrantReward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardValue.trim()) return;
    setRewarding(true);

    try {
      const res = await fetch(`${API_URL}/api/admin/rewards/grant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({
          rewardType,
          value: rewardValue,
          recipientType,
          selectedUserIds: selectedUserIds.split(',').map(i => i.trim()).filter(Boolean)
        })
      });
      if (res.ok) {
        setRewardValue("");
        setSelectedUserIds("");
        setRewardSuccess(true);
        setTimeout(() => setRewardSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRewarding(false);
    }
  };

  // Settings fetch/save
  const fetchSettings = async () => {
    setLoadingSettings(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        headers: { 'x-user-id': userId || '' }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          registration: data.registrationOpen,
          googleLogin: data.googleLoginEnabled,
          maintenanceMode: data.maintenanceMode,
          ratingsEnabled: data.ratingsEnabled
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSettings(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId || ''
        },
        body: JSON.stringify({
          registrationOpen: settings.registration,
          googleLoginEnabled: settings.googleLogin,
          maintenanceMode: settings.maintenanceMode,
          ratingsEnabled: settings.ratingsEnabled
        })
      });
      if (res.ok) {
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white flex-col gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <h1 className="text-xl font-bold uppercase tracking-widest text-zinc-400">Verifying Admin Access...</h1>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#07080b] text-zinc-100 overflow-hidden font-sans">
      
      {/* ── SIDEBAR ── */}
      <aside className="w-64 bg-zinc-950 border-r border-zinc-800 flex flex-col justify-between p-4 flex-shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-4">
            <span className="text-2xl font-black text-blue-500 tracking-wider">Ano Admin</span>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'users', label: 'Users', icon: Users },
              { id: 'reviews', label: 'Ratings & Reviews', icon: Star },
              { id: 'bugs', label: 'Bug Reports', icon: Bug },
              { id: 'reports', label: 'User Reports', icon: ShieldAlert },
              { id: 'games', label: 'Games', icon: Megaphone },
              { id: 'announcements', label: 'Announcements', icon: Megaphone },
              { id: 'rewards', label: 'Rewards', icon: Gift },
              { id: 'settings', label: 'Settings', icon: Settings },
              { id: 'audit_logs', label: 'Audit Logs', icon: FileText }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as Section)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeSection === item.id 
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <button onClick={() => router.push("/dashboard")} className="flex items-center gap-3 px-3 py-2.5 text-zinc-500 hover:text-zinc-300 font-semibold text-sm hover:bg-zinc-900/50 rounded-xl transition-all">
          <LogOut className="w-4 h-4" /> Return to Dashboard
        </button>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/20">
          <h2 className="text-lg font-black uppercase tracking-wider text-zinc-200 capitalize">
            {activeSection.replace('_', ' ')}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs bg-blue-500/10 border border-blue-500/20 text-blue-400 px-2.5 py-1 rounded-full font-bold">
              SUPER ADMIN
            </span>
            <span className="text-sm text-zinc-400 font-semibold">{adminEmail}</span>
          </div>
        </header>

        {/* Section View Scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ──── VIEW: DASHBOARD ──── */}
          {activeSection === 'dashboard' && (
            <>
              {/* Metrics cards grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats?.totalUsers, color: "text-blue-400", sub: "Registered accounts" },
                  { label: "Online Users", value: stats?.onlineUsers, color: "text-green-400", sub: "Currently active" },
                  { label: "Active Rooms", value: stats?.activeRooms, color: "text-purple-400", sub: "User chat rooms" },
                  { label: "Average Rating", value: stats?.averageRating ? `${stats.averageRating}★` : "N/A", color: "text-yellow-400", sub: "Based on user feedback" },
                  { label: "Games Today", value: stats?.gamesPlayedToday, color: "text-orange-400", sub: "Matches finished today" },
                  { label: "Bug Reports", value: stats?.bugReports, color: "text-red-400", sub: "Open issues pending fix" },
                  { label: "User Reports", value: stats?.openUserReports, color: "text-rose-400", sub: "Open mod flags" },
                  { label: "Pending Reviews", value: stats?.reviewsPending, color: "text-cyan-400", sub: "Feedback unread" }
                ].map((c, i) => (
                  <GlassCard key={i} className="p-5 flex flex-col justify-between min-h-[110px] border-zinc-800">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500">{c.label}</span>
                    {loadingStats ? (
                      <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded-md mt-2" />
                    ) : (
                      <div className={`text-2xl font-black ${c.color} mt-1`}>{c.value ?? 0}</div>
                    )}
                    <span className="text-[9px] text-zinc-500 mt-2 font-medium">{c.sub}</span>
                  </GlassCard>
                ))}
              </div>

              {/* Announcements Quick View / Config Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GlassCard className="p-6 border-zinc-800 flex flex-col gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Quick Tools</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs font-semibold">
                    <button onClick={() => setActiveSection('announcements')} className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-colors">
                      📢 Broadcast Alert
                    </button>
                    <button onClick={() => setActiveSection('rewards')} className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-colors">
                      🎁 Grant Coins/Title
                    </button>
                    <button onClick={() => setActiveSection('users')} className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-colors">
                      🚫 Moderation Queue
                    </button>
                    <button onClick={() => setActiveSection('settings')} className="p-3 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl text-left transition-colors">
                      ⚙️ Maintenance Settings
                    </button>
                  </div>
                </GlassCard>
                
                <GlassCard className="p-6 border-zinc-800 flex flex-col gap-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">System Logs</h3>
                  <div className="text-xs text-zinc-500 font-mono flex items-center justify-center py-8">
                    Select "Audit Logs" to view complete system actions track history.
                  </div>
                </GlassCard>
              </div>
            </>
          )}

          {/* ──── VIEW: USERS ──── */}
          {activeSection === 'users' && (
            <div className="space-y-4">
              <div className="flex gap-4 items-center justify-between">
                <input 
                  type="text" 
                  placeholder="Search by nickname, email, ID..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl text-sm w-80 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700"
                />
                <select 
                  value={userFilter}
                  onChange={e => setUserFilter(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl text-sm text-zinc-300 focus:outline-none"
                >
                  <option value="all">All Users</option>
                  <option value="online">Online</option>
                  <option value="admin">Admins</option>
                  <option value="banned">Banned</option>
                </select>
              </div>

              {loadingUsers ? (
                <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-widest text-[9px] font-bold bg-zinc-900/25">
                        <th className="p-4">User</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">ID</th>
                        <th className="p-4">Status / Role</th>
                        <th className="p-4">Joined</th>
                        <th className="p-4">Last Seen</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {users.map(u => (
                        <tr key={u.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="p-4 flex items-center gap-3">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center font-bold text-zinc-400">{u.nickname.substring(0,2).toUpperCase()}</div>
                            )}
                            <span className="font-bold text-zinc-200">{u.nickname}</span>
                          </td>
                          <td className="p-4 text-zinc-400 font-medium">{u.email || 'N/A'}</td>
                          <td className="p-4 text-zinc-600 font-mono">{u.id}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] mr-1.5 ${u.role === 'SUPER_ADMIN' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-zinc-800 text-zinc-500'}`}>{u.role}</span>
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${u.isBanned ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>{u.isBanned ? 'BANNED' : 'ACTIVE'}</span>
                          </td>
                          <td className="p-4 text-zinc-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                          <td className="p-4 text-zinc-500">{new Date(u.lastSeen).toLocaleString()}</td>
                          <td className="p-4 text-right flex items-center justify-end gap-1.5">
                            {u.isBanned ? (
                              <button onClick={() => handleBanUser(u.id, false)} className="px-2.5 py-1.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 rounded-lg font-bold transition-colors">Unban</button>
                            ) : (
                              <button onClick={() => handleBanUser(u.id, true)} className="px-2.5 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-lg font-bold transition-colors">Ban</button>
                            )}
                            <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {users.length === 0 && <div className="text-center py-10 text-zinc-600 font-bold uppercase tracking-widest">No users found</div>}
                </div>
              )}
            </div>
          )}

          {/* ──── VIEW: RATINGS & REVIEWS ──── */}
          {activeSection === 'reviews' && (
            <div className="space-y-6">
              
              {/* Star statistics panel */}
              {reviewStats && (
                <div className="grid grid-cols-3 gap-6">
                  <GlassCard className="p-6 border-zinc-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500">Average Rating</span>
                      <h4 className="text-3xl font-black text-yellow-400 mt-2">{reviewStats.average} ★</h4>
                    </div>
                    <span className="text-[9px] text-zinc-600">Calculated from total user reviews</span>
                  </GlassCard>
                  
                  <GlassCard className="p-6 border-zinc-800 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-500">Total Feedback</span>
                      <h4 className="text-3xl font-black text-zinc-200 mt-2">{reviewStats.total} reviews</h4>
                    </div>
                    <span className="text-[9px] text-zinc-600">Cumulative reviews submitted</span>
                  </GlassCard>

                  <GlassCard className="p-5 border-zinc-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 mb-2 block">Distribution</span>
                    <div className="space-y-1">
                      {[5, 4, 3, 2, 1].map(stars => {
                        const count = reviewStats.distribution[stars] || 0;
                        const percentage = reviewStats.total > 0 ? (count / reviewStats.total) * 100 : 0;
                        return (
                          <div key={stars} className="flex items-center gap-2">
                            <span className="w-3 font-bold text-zinc-500">{stars}</span>
                            <div className="flex-1 bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                              <div className="bg-yellow-500 h-full rounded-full" style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="w-6 text-right font-bold text-zinc-500">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-4 items-center">
                <input 
                  type="text" 
                  placeholder="Search reviews..."
                  value={reviewSearch}
                  onChange={e => setReviewSearch(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl text-sm w-60 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                />
                <select 
                  value={reviewStars}
                  onChange={e => setReviewStars(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl text-sm text-zinc-300 focus:outline-none"
                >
                  <option value="">All Star ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
                <select 
                  value={reviewCategory}
                  onChange={e => setReviewCategory(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-xl text-sm text-zinc-300 focus:outline-none"
                >
                  <option value="">All Categories</option>
                  <option value="UI">UI</option>
                  <option value="GAMEPLAY">Gameplay</option>
                  <option value="MULTIPLAYER">Multiplayer</option>
                  <option value="PERFORMANCE">Performance</option>
                  <option value="BUG">Bug</option>
                  <option value="SUGGESTION">Suggestion</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              {loadingReviews ? (
                <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {reviews.map(r => (
                    <GlassCard key={r.id} className={`p-5 flex flex-col justify-between border-zinc-800 ${r.isRead ? 'opacity-60' : 'border-blue-500/20'}`}>
                      <div>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-zinc-200">{r.user?.nickname || 'Guest'}</span>
                            <span className="text-[10px] bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full font-bold">{r.category}</span>
                          </div>
                          <div className="text-yellow-500 font-bold text-xs">{'★'.repeat(r.stars)}</div>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2 font-medium leading-relaxed">{r.content}</p>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-zinc-900/50 mt-4 pt-3">
                        <span className="text-[9px] text-zinc-600">{new Date(r.createdAt).toLocaleString()}</span>
                        <div className="flex gap-2">
                          {!r.isRead && (
                            <button onClick={() => handleMarkReviewRead(r.id)} className="p-1.5 hover:bg-zinc-800 text-green-400 border border-green-500/20 rounded-lg text-[10px] font-bold flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Read
                            </button>
                          )}
                          <button onClick={() => handleArchiveReview(r.id)} className="p-1.5 hover:bg-zinc-800 text-zinc-400 border border-zinc-800 rounded-lg text-[10px] font-bold">Archive</button>
                          <button onClick={() => handleDeleteReview(r.id)} className="p-1.5 hover:bg-zinc-800 hover:text-red-400 text-zinc-600 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </GlassCard>
                  ))}
                  {reviews.length === 0 && <div className="col-span-2 text-center py-20 text-zinc-600 font-bold uppercase tracking-widest">No reviews found</div>}
                </div>
              )}
            </div>
          )}

          {/* ──── VIEW: BUG REPORTS ──── */}
          {activeSection === 'bugs' && (
            <div className="space-y-4">
              {loadingBugs ? (
                <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-widest text-[9px] font-bold bg-zinc-900/25">
                        <th className="p-4">Reporter</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Game</th>
                        <th className="p-4">Platform</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Date</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {bugs.map(b => (
                        <tr key={b.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="p-4 font-bold text-zinc-200">{b.user?.nickname || 'Guest'}</td>
                          <td className="p-4 max-w-sm">
                            <p className="truncate text-zinc-400 font-medium">{b.description}</p>
                            {b.screenshot && <a href={b.screenshot} target="_blank" className="text-[10px] text-blue-400 hover:underline mt-1 block">View Screenshot</a>}
                          </td>
                          <td className="p-4 font-bold text-zinc-500">{b.game || 'Global'}</td>
                          <td className="p-4 text-zinc-600 leading-normal font-medium">{b.browser || 'N/A'} ({b.device || 'N/A'})</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${
                              b.status === 'FIXED' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                              b.status === 'CLOSED' ? 'bg-zinc-800 text-zinc-500' :
                              b.status === 'IN_PROGRESS' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' :
                              'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}>{b.status}</span>
                          </td>
                          <td className="p-4 text-zinc-500">{new Date(b.createdAt).toLocaleString()}</td>
                          <td className="p-4 text-right">
                            <select 
                              value={b.status}
                              onChange={e => handleBugStatus(b.id, e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg text-[10px] text-zinc-300 font-semibold focus:outline-none"
                            >
                              <option value="OPEN">Open</option>
                              <option value="INVESTIGATING">Investigating</option>
                              <option value="IN_PROGRESS">In Progress</option>
                              <option value="FIXED">Fixed</option>
                              <option value="CLOSED">Closed</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {bugs.length === 0 && <div className="text-center py-10 text-zinc-600 font-bold uppercase tracking-widest">No bug reports found</div>}
                </div>
              )}
            </div>
          )}

          {/* ──── VIEW: USER REPORTS ──── */}
          {activeSection === 'reports' && (
            <div className="space-y-4">
              {loadingReports ? (
                <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-widest text-[9px] font-bold bg-zinc-900/25">
                        <th className="p-4">Reporter</th>
                        <th className="p-4">Reported Player</th>
                        <th className="p-4">Reason</th>
                        <th className="p-4">Details</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Report Date</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {reports.map(r => (
                        <tr key={r.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="p-4 font-bold text-zinc-400">{r.reporter?.nickname || 'Guest'}</td>
                          <td className="p-4 flex items-center gap-2">
                            <span className="font-bold text-zinc-200">{r.reported?.nickname}</span>
                            <span className={`text-[9px] uppercase font-black ${r.reported?.isBanned ? 'text-red-500' : 'text-zinc-600'}`}>{r.reported?.isBanned ? '(BANNED)' : ''}</span>
                          </td>
                          <td className="p-4 font-bold text-zinc-500">{r.reason}</td>
                          <td className="p-4 text-zinc-400 font-medium">{r.details || 'N/A'}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${r.status === 'OPEN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-zinc-800 text-zinc-500'}`}>{r.status}</span>
                          </td>
                          <td className="p-4 text-zinc-500">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="p-4 text-right">
                            {r.status === 'OPEN' ? (
                              <div className="flex gap-1 justify-end">
                                <button onClick={() => handleReportAction(r.id, 'WARN', r.reportedId)} className="px-2 py-1 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/25 border border-yellow-500/20 rounded-lg text-[10px] font-bold">Warn</button>
                                <button onClick={() => handleReportAction(r.id, 'BAN', r.reportedId)} className="px-2 py-1 bg-red-500/10 text-red-500 hover:bg-red-500/25 border border-red-500/20 rounded-lg text-[10px] font-bold">Ban</button>
                                <button onClick={() => handleReportAction(r.id, 'CLOSE', r.reportedId)} className="px-2 py-1 bg-zinc-900 text-zinc-400 border border-zinc-850 hover:bg-zinc-800 rounded-lg text-[10px] font-bold">Close</button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-600 font-semibold uppercase">Resolved</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {reports.length === 0 && <div className="text-center py-10 text-zinc-600 font-bold uppercase tracking-widest">No moderation reports found</div>}
                </div>
              )}
            </div>
          )}

          {/* ──── VIEW: GAMES CONFIG ──── */}
          {activeSection === 'games' && (
            <div className="space-y-4">
              {loadingGames ? (
                <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {games.map(g => (
                    <GlassCard key={g.id} className="p-5 border-zinc-800 flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-sm text-zinc-200">{g.id.replace('_', ' ')}</h4>
                          <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] ${g.isEnabled ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>{g.isEnabled ? 'ENABLED' : 'DISABLED'}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4 text-[10px] text-zinc-500">
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-zinc-600 font-bold">Total Matches</span>
                            <span className="text-sm font-bold text-zinc-300 mt-0.5 block">{g.totalMatches}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] uppercase tracking-wider text-zinc-600 font-bold">Avg Match Duration</span>
                            <span className="text-sm font-bold text-zinc-300 mt-0.5 block">{g.avgDurationSeconds}s</span>
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-zinc-900/50 pt-3 flex justify-between items-center gap-2">
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase">
                          <input 
                            type="checkbox" 
                            checked={g.isEnabled}
                            onChange={e => handleToggleGame(g.id, 'isEnabled', e.target.checked)}
                            className="accent-blue-500" 
                          /> Enabled
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase">
                          <input 
                            type="checkbox" 
                            checked={g.isFeatured}
                            onChange={e => handleToggleGame(g.id, 'isFeatured', e.target.checked)}
                            className="accent-yellow-500" 
                          /> Featured
                        </label>
                        <label className="flex items-center gap-2 text-[10px] text-zinc-400 font-bold uppercase">
                          <input 
                            type="checkbox" 
                            checked={g.isMaintenance}
                            onChange={e => handleToggleGame(g.id, 'isMaintenance', e.target.checked)}
                            className="accent-orange-500" 
                          /> Maint.
                        </label>
                      </div>
                    </GlassCard>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ──── VIEW: ANNOUNCEMENTS ──── */}
          {activeSection === 'announcements' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Creator Form */}
              <GlassCard className="p-5 border-zinc-800 flex flex-col gap-4 h-fit">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Create Announcement</h3>
                <form onSubmit={handlePublishAnnouncement} className="space-y-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500">Title</label>
                    <input 
                      type="text" 
                      placeholder="Maintenance Tonight..."
                      value={annTitle}
                      onChange={e => setAnnTitle(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-100 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500">Description</label>
                    <textarea 
                      placeholder="Announcement description content..."
                      value={annDesc}
                      onChange={e => setAnnDesc(e.target.value)}
                      rows={4}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-100 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-500">Color</label>
                      <select 
                        value={annColor}
                        onChange={e => setAnnColor(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-300 focus:outline-none"
                      >
                        <option value="red">Red Alert</option>
                        <option value="blue">Blue Info</option>
                        <option value="yellow">Yellow Warning</option>
                        <option value="green">Green Event</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-bold text-zinc-500">Expiry Date</label>
                      <input 
                        type="datetime-local" 
                        value={annExpiry}
                        onChange={e => setAnnExpiry(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 p-2 rounded-xl text-zinc-300 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] mt-2 transition-colors">
                    Publish Announcement
                  </button>
                </form>
              </GlassCard>

              {/* Active List */}
              <div className="col-span-2 space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Active Announcements</h3>
                {loadingAnnouncements ? (
                  <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
                ) : (
                  <div className="space-y-3">
                    {announcements.map(ann => (
                      <GlassCard key={ann.id} className="p-4 border-zinc-800 flex justify-between items-start gap-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl mt-0.5">{ann.icon}</span>
                          <div>
                            <h4 className="font-bold text-sm text-zinc-200 flex items-center gap-2">
                              {ann.title}
                              <span className={`w-2.5 h-2.5 rounded-full ${
                                ann.color === 'red' ? 'bg-red-500' :
                                ann.color === 'blue' ? 'bg-blue-500' :
                                ann.color === 'yellow' ? 'bg-yellow-500' : 'bg-green-500'
                              }`} />
                            </h4>
                            <p className="text-xs text-zinc-400 mt-1 font-medium leading-relaxed">{ann.description}</p>
                            {ann.expiryDate && (
                              <span className="text-[9px] text-zinc-500 mt-2 block font-semibold">Expires: {new Date(ann.expiryDate).toLocaleString()}</span>
                            )}
                          </div>
                        </div>

                        <button onClick={() => handleDeleteAnnouncement(ann.id)} className="p-2 hover:bg-zinc-800 text-zinc-600 hover:text-red-400 border border-transparent hover:border-zinc-700/50 rounded-xl transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </GlassCard>
                    ))}
                    {announcements.length === 0 && <div className="text-center py-20 text-zinc-600 font-bold uppercase tracking-widest">No active announcements</div>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ──── VIEW: REWARDS ──── */}
          {activeSection === 'rewards' && (
            <GlassCard className="p-6 border-zinc-800 max-w-lg mx-auto">
              <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-4">Grant Rewards</h3>
              <form onSubmit={handleGrantReward} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500">Reward Type</label>
                  <select 
                    value={rewardType}
                    onChange={e => setRewardType(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-300 focus:outline-none"
                  >
                    <option value="COINS">🪙 Coins</option>
                    <option value="TITLE">👑 Title / Nickname Badges</option>
                    <option value="COSMETIC">🎭 Cosmetic Item</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500">Value / Item ID</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 500, 'CHAMBER_CHAMP'..."
                    value={rewardValue}
                    onChange={e => setRewardValue(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-100 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-zinc-500">Recipients</label>
                  <select 
                    value={recipientType}
                    onChange={e => setRecipientType(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-300 focus:outline-none"
                  >
                    <option value="ALL">Everyone</option>
                    <option value="SELECTED">Selected User IDs</option>
                  </select>
                </div>

                {recipientType === 'SELECTED' && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-zinc-500">Comma-separated User IDs</label>
                    <input 
                      type="text" 
                      placeholder="google_10382, guest_1064"
                      value={selectedUserIds}
                      onChange={e => setSelectedUserIds(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 p-2.5 rounded-xl text-zinc-100 focus:outline-none font-mono"
                    />
                  </div>
                )}

                <button type="submit" disabled={rewarding} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] transition-colors mt-2">
                  {rewarding ? <Loader2 className="w-4 h-4 mx-auto animate-spin" /> : "Grant Reward ➔"}
                </button>

                {rewardSuccess && (
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-xl mt-2">
                    <Check className="w-4 h-4" /> Rewards granted successfully!
                  </div>
                )}
              </form>
            </GlassCard>
          )}

          {/* ──── VIEW: AUDIT LOGS ──── */}
          {activeSection === 'audit_logs' && (
            <div className="space-y-4">
              {loadingLogs ? (
                <div className="flex justify-center py-20 text-zinc-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
              ) : (
                <div className="overflow-x-auto border border-zinc-800/80 rounded-xl bg-zinc-950">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 uppercase tracking-widest text-[9px] font-bold bg-zinc-900/25">
                        <th className="p-4">Admin Email</th>
                        <th className="p-4">Action</th>
                        <th className="p-4">Target / Description</th>
                        <th className="p-4">IP Address</th>
                        <th className="p-4">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {auditLogs.map(l => (
                        <tr key={l.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="p-4 font-bold text-zinc-200">{l.adminEmail}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full font-bold uppercase text-[9px] bg-zinc-800 text-zinc-400 border border-zinc-700/50">{l.action}</span>
                          </td>
                          <td className="p-4 text-zinc-400 font-medium font-mono max-w-sm truncate">{l.target}</td>
                          <td className="p-4 text-zinc-600 font-mono">{l.ipAddress || 'N/A'}</td>
                          <td className="p-4 text-zinc-500">{new Date(l.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {auditLogs.length === 0 && <div className="text-center py-10 text-zinc-600 font-bold uppercase tracking-widest">No audit logs found</div>}
                </div>
              )}
            </div>
          )}

          {/* ──── VIEW: SETTINGS ──── */}
          {activeSection === 'settings' && (
            <div className="max-w-lg mx-auto space-y-6">
              <GlassCard className="p-6 border-zinc-800 flex flex-col gap-6 text-xs">
                <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300">Feature Flags</h3>
                
                {loadingSettings ? (
                  <div className="flex justify-center py-10 text-zinc-500"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong className="block text-zinc-300">New Registration</strong>
                      <span className="text-[10px] text-zinc-500">Allow guests and new Google user signups.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.registration} 
                      onChange={e => setSettings({...settings, registration: e.target.checked})}
                      className="w-4 h-4 accent-blue-500" 
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/50 pt-4">
                    <div>
                      <strong className="block text-zinc-300">Google Authentication</strong>
                      <span className="text-[10px] text-zinc-500">Allow users to log in using Google credentials.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.googleLogin} 
                      onChange={e => setSettings({...settings, googleLogin: e.target.checked})}
                      className="w-4 h-4 accent-blue-500" 
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/50 pt-4">
                    <div>
                      <strong className="block text-zinc-300">Global Maintenance Mode</strong>
                      <span className="text-[10px] text-zinc-500">Locks non-admin users out of matches.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.maintenanceMode} 
                      onChange={e => setSettings({...settings, maintenanceMode: e.target.checked})}
                      className="w-4 h-4 accent-orange-500" 
                    />
                  </div>

                  <div className="flex items-center justify-between border-t border-zinc-900/50 pt-4">
                    <div>
                      <strong className="block text-zinc-300">Ratings & Reviews</strong>
                      <span className="text-[10px] text-zinc-500">Allow users to submit feedback and stars.</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.ratingsEnabled} 
                      onChange={e => setSettings({...settings, ratingsEnabled: e.target.checked})}
                      className="w-4 h-4 accent-blue-500" 
                    />
                  </div>
                </div>
                )}

                <button onClick={handleSaveSettings} className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold uppercase tracking-wider text-[10px] mt-2 transition-colors">
                  Save Settings Configurations
                </button>

                {settingsSaved && (
                  <div className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-xl">
                    <Check className="w-4 h-4" /> Settings saved successfully!
                  </div>
                )}
              </GlassCard>
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
