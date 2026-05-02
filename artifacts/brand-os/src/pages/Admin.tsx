import { Fragment, useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  Shield, TrendingUp, Users, BarChart2, Zap, Search, Trash2,
  ChevronDown, ChevronUp, RefreshCw, Loader2, Filter,
} from "lucide-react";

const ADMIN_EMAIL = "odmlawal@gmail.com";

// ── Types ──────────────────────────────────────────────────────────────────────
type Stats = {
  totalUsers: number; signupsToday: number; signupsWeek: number; signupsMonth: number;
  activationRate: number; demoLoginsToday: number;
  signupsByDay: DayCount[]; dauByDay: DayCount[]; demoLoginsByDay: DayCount[];
};
type DayCount = { date: string; count: number };
type AdminUser = {
  id: number; email: string; displayName: string; createdAt: string;
  onboarded: boolean; lastActive: string | null;
  draftCount: number; publishedCount: number; carouselCount: number; visualCount: number;
  tone: string | null; persona: string | null; objective: string | null;
  brandRole: string | null; brandAudience: string | null; brandBelief: string | null;
  backgroundTheme: string | null; siteTheme: string | null;
};
type FunnelData = { totalSignups: number; completedOnboarding: number; createdDraft: number; publishedDraft: number; totalDraftsCreated: number; totalDraftsPublished: number };
type RetentionData = { d1: number | null; d7: number | null; d30: number | null; d1Eligible: number; d7Eligible: number; d30Eligible: number };
type Insights = {
  tones: { tone: string; count: number }[];
  personas: { persona: string; count: number }[];
  audiences: { objective: string; count: number }[];
  formats: { format: string; count: number }[];
  topUsers: { email: string; displayName: string; draftCount: number }[];
};
type DemoData = {
  demoLoginsToday: number; demoLoginsByDay: DayCount[];
  draftTypes: { type: string; count: number; published: number }[];
  recentDrafts: { raw_input: string; status: string; created_at: string }[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────
async function adminFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/admin${path}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load admin data");
  return res.json() as Promise<T>;
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmtDate = (d: string) => {
  const p = d.split("-");
  return `${MONTHS[parseInt(p[1] ?? "1") - 1]} ${parseInt(p[2] ?? "1")}`;
};
const fmtRelDate = (d: string | null) => {
  if (!d) return "Never";
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
};
const fmtJoined = (d: string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

// ── Shared UI ──────────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>;
}
function ErrorBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-red-500">{msg}</p>
      <button onClick={onRetry} className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1">
        <RefreshCw className="w-3 h-3" /> Try again
      </button>
    </div>
  );
}
function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-black text-[#0F1F3D] leading-none">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-1.5">{sub}</p>}
    </div>
  );
}
function MiniBar({ data, color, label }: { data: DayCount[]; color: string; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-gray-200">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 9, fill: "#9ca3af" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, "Count"]} labelFormatter={fmtDate} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
function MiniLine({ data, color, label }: { data: DayCount[]; color: string; label: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">{label}</p>
      {data.length === 0 ? (
        <div className="h-32 flex items-center justify-center text-sm text-gray-200">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height={130}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 9, fill: "#9ca3af" }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip formatter={(v) => [v, "Active users"]} labelFormatter={fmtDate} contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }} />
            <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-700 w-32 truncate flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">{count} ({pct}%)</span>
    </div>
  );
}
function SectionHeader({ title, onRefresh }: { title: string; onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{title}</h2>
      <button onClick={onRefresh} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-gray-700">
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
    </div>
  );
}

// ── Growth tab ─────────────────────────────────────────────────────────────────
function GrowthTab() {
  const [data, setData] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await adminFetch<Stats>("/stats")); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox msg={error ?? "No data"} onRetry={load} />;

  return (
    <div className="space-y-6">
      <SectionHeader title="Growth Overview" onRefresh={load} />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total Users" value={data.totalUsers} />
        <StatCard label="Signups Today" value={data.signupsToday} />
        <StatCard label="This Week" value={data.signupsWeek} />
        <StatCard label="This Month" value={data.signupsMonth} />
        <StatCard label="Activation Rate" value={`${data.activationRate}%`} sub="completed onboarding" />
        <StatCard label="Demo Visits Today" value={data.demoLoginsToday} sub="demo@brandos.app logins" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <MiniBar data={data.signupsByDay} color="#0F1F3D" label="New Signups — Last 30 Days" />
        <MiniLine data={data.dauByDay} color="#0A66C2" label="Daily Active Users — Last 30 Days" />
      </div>
      <MiniLine data={data.demoLoginsByDay} color="#8B5CF6" label="Demo Visitor Logins — Last 30 Days" />
    </div>
  );
}

type SortCol = "email" | "createdAt" | "lastActive" | "draftCount";

// ── Users tab ──────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortCol>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleteToken, setDeleteToken] = useState<string | null>(null);
  const [requestingToken, setRequestingToken] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number, q: string, col: SortCol, ord: "asc" | "desc") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), sort: col, order: ord, ...(q ? { search: q } : {}) });
      const res = await adminFetch<{ users: AdminUser[]; total: number }>(`/users?${params}`);
      setUsers(res.users);
      setTotal(res.total);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(1, "", "createdAt", "desc"); }, [load]);

  const handleSearch = (q: string) => { setSearch(q); setPage(1); void load(1, q, sortBy, sortOrder); };
  const handlePage = (p: number) => { setPage(p); void load(p, search, sortBy, sortOrder); };

  const handleSort = (col: SortCol) => {
    const nextOrder = sortBy === col && sortOrder === "desc" ? "asc" : "desc";
    setSortBy(col); setSortOrder(nextOrder); setPage(1);
    void load(1, search, col, nextOrder);
  };

  const handleRequestDelete = async (id: number) => {
    setRequestingToken(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/delete-request`, {
        method: "POST", credentials: "include",
      });
      if (!res.ok) return;
      const data = await res.json() as { token: string };
      setDeleteToken(data.token);
      setDeleteConfirmId(id);
    } catch { /* ignore */ }
    finally { setRequestingToken(false); }
  };

  const handleDelete = async (id: number) => {
    if (!deleteToken) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: deleteToken }),
      });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        setTotal(prev => prev - 1);
        setDeleteConfirmId(null);
        setDeleteToken(null);
        setExpandedId(null);
      }
    } catch { /* ignore */ }
    finally { setDeleting(false); }
  };

  const totalPages = Math.ceil(total / 20);

  const SortIcon = ({ col }: { col: SortCol }) => (
    <span className={`ml-1 ${sortBy === col ? "text-[#0F1F3D]" : "text-gray-300"}`}>
      {sortBy === col && sortOrder === "asc" ? "↑" : "↓"}
    </span>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">User Management</h2>
        <span className="text-xs text-gray-400">{total} users</span>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
        <input
          type="text" placeholder="Search by email or name…" value={search}
          onChange={e => handleSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-gray-400 bg-white"
        />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {loading ? <Spinner /> : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-300">No users found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("email")}>
                    Email / Name<SortIcon col="email" />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("createdAt")}>
                    Joined<SortIcon col="createdAt" />
                  </th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-400 uppercase tracking-wider hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort("lastActive")}>
                    Last Active<SortIcon col="lastActive" />
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Onboarded</th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer select-none" onClick={() => handleSort("draftCount")}>
                    Drafts<SortIcon col="draftCount" />
                  </th>
                  <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Published</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <Fragment key={u.id}>
                    <tr
                      className="border-b border-gray-50 hover:bg-gray-50/70 cursor-pointer transition-colors"
                      onClick={() => { setExpandedId(expandedId === u.id ? null : u.id); setDeleteConfirmId(null); }}
                    >
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-800 truncate max-w-[190px]">{u.email}</p>
                        <p className="text-[11px] text-gray-400">{u.displayName}</p>
                      </td>
                      <td className="px-4 py-3 text-[11px] text-gray-400 hidden md:table-cell">{fmtJoined(u.createdAt)}</td>
                      <td className="px-4 py-3 text-[11px] text-gray-400 hidden md:table-cell">{fmtRelDate(u.lastActive)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${u.onboarded ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                          {u.onboarded ? "✓" : "–"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-gray-700">{u.draftCount}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{u.publishedCount}</td>
                      <td className="px-4 py-3 text-right">
                        {expandedId === u.id
                          ? <ChevronUp className="w-4 h-4 text-gray-300 ml-auto" />
                          : <ChevronDown className="w-4 h-4 text-gray-300 ml-auto" />}
                      </td>
                    </tr>
                    {expandedId === u.id && (
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="grid md:grid-cols-3 gap-5 text-sm mb-4">
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Brand Voice</p>
                              <div className="space-y-1.5">
                                {[["Tone", u.tone], ["Persona", u.persona], ["Audience", u.objective]].map(([k, v]) => (
                                  <p key={k}><span className="text-gray-400 text-xs">{k}: </span><span className="font-semibold text-gray-800">{v || "—"}</span></p>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Brand Copy</p>
                              <div className="space-y-1.5">
                                {[["Role", u.brandRole], ["Audience", u.brandAudience], ["Belief", u.brandBelief]].map(([k, v]) => (
                                  <p key={k} className="text-xs text-gray-600 leading-relaxed"><span className="text-gray-400">{k}: </span>{v || "—"}</p>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Content</p>
                              <div className="space-y-1.5">
                                {[
                                  ["Posts", u.draftCount - u.carouselCount - u.visualCount],
                                  ["Carousels", u.carouselCount], ["Visuals", u.visualCount],
                                  ["Published", u.publishedCount],
                                ].map(([k, v]) => (
                                  <p key={String(k)}><span className="text-gray-400 text-xs">{k}: </span><span className="font-semibold text-gray-800">{v}</span></p>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-gray-200 pt-3 flex items-center gap-3">
                            {deleteConfirmId === u.id ? (
                              <>
                                <p className="text-xs text-red-600 font-semibold">Permanently delete {u.email}?</p>
                                <button
                                  onClick={() => void handleDelete(u.id)}
                                  disabled={deleting}
                                  className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                                >
                                  {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                  Confirm Delete
                                </button>
                                <button
                                  onClick={() => { setDeleteConfirmId(null); setDeleteToken(null); }}
                                  className="text-xs text-gray-400 hover:text-gray-700"
                                >Cancel</button>
                              </>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); void handleRequestDelete(u.id); }}
                                disabled={requestingToken}
                                className="flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                              >
                                {requestingToken ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                Delete account
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => handlePage(page - 1)} disabled={page === 1} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Prev</button>
          <span className="text-xs text-gray-400">{page} / {totalPages}</span>
          <button onClick={() => handlePage(page + 1)} disabled={page === totalPages} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next</button>
        </div>
      )}
    </div>
  );
}

// ── Funnel tab ─────────────────────────────────────────────────────────────────
function FunnelTab() {
  const [data, setData] = useState<{ funnel: FunnelData; retention: RetentionData } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await adminFetch<{ funnel: FunnelData; retention: RetentionData }>("/funnel")); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox msg={error ?? "No data"} onRetry={load} />;

  const { funnel, retention } = data;
  const steps = [
    { label: "Signed Up", count: funnel.totalSignups, color: "#0F1F3D" },
    { label: "Completed Onboarding", count: funnel.completedOnboarding, color: "#0A66C2" },
    { label: "Created First Draft", count: funnel.createdDraft, color: "#8B5CF6" },
    { label: "Published First Post", count: funnel.publishedDraft, color: "#10B981" },
  ];
  const max = steps[0]?.count || 1;

  const retColor = (p: number | null) => p === null ? "text-gray-300" : p >= 40 ? "text-green-600" : p >= 20 ? "text-amber-500" : "text-red-500";

  return (
    <div className="space-y-6">
      <SectionHeader title="Onboarding Funnel" onRefresh={load} />
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {steps.map((step, i) => {
          const prev = steps[i - 1];
          const pct = Math.round((step.count / max) * 100);
          const drop = prev && prev.count > 0 ? Math.round(((prev.count - step.count) / prev.count) * 100) : null;
          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-700">{step.label}</span>
                <div className="flex items-center gap-3">
                  {drop !== null && drop > 0 && <span className="text-[11px] text-red-400">−{drop}% drop</span>}
                  <span className="text-sm font-black text-[#0F1F3D]">{step.count.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, background: step.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mt-2">Draft Funnel</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-5">
        {[
          { label: "Total Drafts Created", count: funnel.totalDraftsCreated, color: "#8B5CF6" },
          { label: "Total Drafts Published", count: funnel.totalDraftsPublished, color: "#10B981" },
        ].map((step, i, arr) => {
          const prev = arr[i - 1];
          const base = arr[0]?.count || 1;
          const pct = Math.round((step.count / base) * 100);
          const drop = prev && prev.count > 0 ? Math.round(((prev.count - step.count) / prev.count) * 100) : null;
          return (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-semibold text-gray-700">{step.label}</span>
                <div className="flex items-center gap-3">
                  {drop !== null && drop > 0 && <span className="text-[11px] text-red-400">−{drop}% unpublished</span>}
                  <span className="text-sm font-black text-[#0F1F3D]">{step.count.toLocaleString()}</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-3">
                <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, background: step.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Retention</h2>
      <div className="grid grid-cols-3 gap-4">
        {(["d1", "d7", "d30"] as const).map(k => {
          const pct = retention[k];
          const eligible = retention[`${k}Eligible` as keyof RetentionData] as number;
          return (
            <div key={k} className="bg-white rounded-2xl border border-gray-100 p-5 text-center">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                {k === "d1" ? "Day 1" : k === "d7" ? "Day 7" : "Day 30"}
              </p>
              <p className={`text-4xl font-black leading-none ${retColor(pct)}`}>{pct !== null ? `${pct}%` : "—"}</p>
              <p className="text-[10px] text-gray-400 mt-2">
                {eligible > 0 ? `${eligible} eligible` : "Need more data"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Insights tab ───────────────────────────────────────────────────────────────
function InsightsTab() {
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await adminFetch<Insights>("/content-insights")); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox msg={error ?? "No data"} onRetry={load} />;

  const totalOf = (arr: { count: number }[]) => arr.reduce((s, x) => s + x.count, 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Content Insights" onRefresh={load} />
      <div className="grid md:grid-cols-2 gap-4">
        {[
          { title: "Tone", items: data.tones.map(t => ({ label: t.tone, count: t.count })), color: "#0F1F3D" },
          { title: "Persona", items: data.personas.map(t => ({ label: t.persona, count: t.count })), color: "#0A66C2" },
          { title: "Audience", items: data.audiences.map(t => ({ label: t.objective, count: t.count })), color: "#8B5CF6" },
          { title: "Content Format", items: data.formats.map(t => ({ label: t.format, count: t.count })), color: "#10B981" },
        ].map(({ title, items, color }) => {
          const tot = totalOf(items);
          return (
            <div key={title} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{title}</p>
              {tot === 0
                ? <p className="text-sm text-gray-200">No data yet</p>
                : items.map(item => <DistBar key={item.label} label={item.label} count={item.count} total={tot} color={color} />)
              }
            </div>
          );
        })}
      </div>

      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Top Users by Drafts — Last 30 Days</h2>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {data.topUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-300">No draft activity in the last 30 days</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">#</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">User</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Drafts</th>
            </tr></thead>
            <tbody>
              {data.topUsers.map((u, i) => (
                <tr key={u.email} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 text-gray-300 text-xs font-bold">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-semibold text-gray-800 truncate max-w-[240px]">{u.email}</p>
                    <p className="text-[11px] text-gray-400">{u.displayName}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-black text-[#0F1F3D]">{u.draftCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Demo tab ───────────────────────────────────────────────────────────────────
function DemoTab() {
  const [data, setData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await adminFetch<DemoData>("/demo")); }
    catch (e) { setError(e instanceof Error ? e.message : "Error"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox msg={error ?? "No data"} onRetry={load} />;

  const totalLogins30d = data.demoLoginsByDay.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      <SectionHeader title="Demo Activity" onRefresh={load} />
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Demo Logins Today" value={data.demoLoginsToday} sub="demo@brandos.app" />
        <StatCard label="Demo Logins (30d)" value={totalLogins30d} sub="total demo sessions" />
      </div>
      <MiniBar data={data.demoLoginsByDay} color="#0A66C2" label="Demo Logins — Last 30 Days" />

      <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Demo Content Types</h2>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {data.draftTypes.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-300">No demo drafts yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Type</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Created</th>
              <th className="text-right px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider">Published</th>
            </tr></thead>
            <tbody>
              {data.draftTypes.map(t => (
                <tr key={t.type} className="border-b border-gray-50">
                  <td className="px-4 py-2.5 font-semibold text-gray-800">{t.type}</td>
                  <td className="px-4 py-2.5 text-right font-black text-[#0F1F3D]">{t.count}</td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{t.published}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {data.recentDrafts.length > 0 && (
        <>
          <h2 className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Recent Demo Drafts</h2>
          <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
            {data.recentDrafts.map((d, i) => (
              <div key={i} className="px-4 py-3">
                <p className="text-sm text-gray-700 truncate">{d.raw_input}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${d.status === "published" ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>{d.status}</span>
                  <span className="text-[10px] text-gray-400">{fmtRelDate(d.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "growth" as const, label: "Growth", icon: TrendingUp },
  { id: "users" as const, label: "Users", icon: Users },
  { id: "funnel" as const, label: "Funnel", icon: Filter },
  { id: "insights" as const, label: "Insights", icon: BarChart2 },
  { id: "demo" as const, label: "Demo", icon: Zap },
];

export default function Admin() {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<typeof TABS[number]["id"]>("growth");

  useEffect(() => {
    if (!isLoading && user && user.email !== ADMIN_EMAIL) navigate("/");
  }, [user, isLoading, navigate]);

  if (isLoading || !user || user.email !== ADMIN_EMAIL) return null;

  return (
    <AppShell>
      <div className="min-h-screen" style={{ background: "#F7F8FA", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "#0F1F3D" }}>
            <Shield className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-black text-[#0F1F3D] leading-tight">Admin Dashboard</h1>
            <p className="text-[10px] text-gray-400">{ADMIN_EMAIL}</p>
          </div>
        </div>

        <div className="bg-white border-b border-gray-100 px-4 flex gap-0.5 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id ? "border-[#0F1F3D] text-[#0F1F3D]" : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>

        <div className="p-6 max-w-5xl mx-auto">
          {activeTab === "growth" && <GrowthTab />}
          {activeTab === "users" && <UsersTab />}
          {activeTab === "funnel" && <FunnelTab />}
          {activeTab === "insights" && <InsightsTab />}
          {activeTab === "demo" && <DemoTab />}
        </div>
      </div>
    </AppShell>
  );
}
