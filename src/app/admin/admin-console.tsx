"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Download, RefreshCw, ShieldCheck } from "lucide-react";
import type { AdminRole } from "@/lib/admin-auth";
import { adminSectionsForRoles, hasAdminPermission } from "@/lib/admin-permissions";

type Overview = {
  users: number;
  activeUsers: number;
  newUsers7Days: number;
  registrations: number;
  submitted: number;
  drafts: number;
  recentSubmissions: number;
  legacyIdeas: number;
};
type Registration = {
  id: string;
  title: string;
  status: "draft" | "submitted";
  step: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  owner: { id: string; mobile: string };
};
type AdminUser = {
  id: string;
  mobile: string;
  fullName?: string | null;
  status: "active" | "suspended";
  mobileVerified: boolean;
  createdAt: string;
  roles?: AdminRole[];
};
type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  occurredAt: string;
  metadata: unknown;
  actor: string;
  subject: string | null;
};
type RegistrationDetail = Record<string, unknown> & {
  id: string;
  status: string;
  data: unknown;
};
type Tab = "overview" | "registrations" | "users" | "audit";

const roleLabels: Record<AdminRole, string> = {
  platform_owner: "مالک سامانه",
  registration_manager: "مدیر ثبت‌ها",
  support: "پشتیبانی",
  analyst: "تحلیل‌گر (فقط‌خواندنی)",
  read_only: "فقط‌خواندنی",
};
const assignableRoles: AdminRole[] = [
  "platform_owner",
  "registration_manager",
  "support",
  "analyst",
  "read_only",
];

function isOwner(roles: AdminRole[]) {
  return roles.includes("platform_owner");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" })
    .format(new Date(value));
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload &&
      typeof payload.error === "string"
      ? payload.error
      : "درخواست انجام نشد.";
    throw new Error(message);
  }
  return payload as T;
}

export default function AdminConsole({
  roles,
  currentUserId,
}: {
  roles: AdminRole[];
  currentUserId: string;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [registrationDetail, setRegistrationDetail] = useState<RegistrationDetail | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [registrationPage, setRegistrationPage] = useState(1);
  const [registrationTotal, setRegistrationTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userTotal, setUserTotal] = useState(0);
  const [includePersonal, setIncludePersonal] = useState(false);
  const [revealUsers, setRevealUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const owner = isOwner(roles);
  const sections = adminSectionsForRoles(roles);
  const canViewRegistrations = sections.includes("registrations");
  const canManageUsers = sections.includes("users");

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOverview(await responseJson<Overview>(await fetch("/api/admin/overview", { cache: "no-store" })));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "گزارش‌ها بارگذاری نشدند.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRegistrations = useCallback(async (page = registrationPage) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), status: statusFilter });
      if (query.trim()) params.set("q", query.trim());
      const payload = await responseJson<{ registrations: Registration[]; total: number }>(
        await fetch(`/api/admin/registrations?${params}`, { cache: "no-store" }),
      );
      setRegistrations(payload.registrations);
      setRegistrationTotal(payload.total);
      setRegistrationDetail(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "ثبت‌ها بارگذاری نشدند.");
    } finally {
      setLoading(false);
    }
  }, [query, statusFilter, registrationPage]);

  const loadUsers = useCallback(async (page = userPage) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      if (revealUsers) params.set("reveal", "1");
      params.set("page", String(page));
      const payload = await responseJson<{ users: AdminUser[]; total: number }>(
        await fetch(`/api/admin/users?${params}`, { cache: "no-store" }),
      );
      setUsers(payload.users);
      setUserTotal(payload.total);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "کاربران بارگذاری نشدند.");
    } finally {
      setLoading(false);
    }
  }, [query, revealUsers, userPage]);

  const loadAudit = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await responseJson<{ events: AuditEvent[] }>(
        await fetch("/api/admin/audit", { cache: "no-store" }),
      );
      setEvents(payload.events);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "گزارش ممیزی بارگذاری نشد.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "overview") void loadOverview();
    if (tab === "registrations" && canViewRegistrations) void loadRegistrations();
    if (tab === "users" && canManageUsers) void loadUsers();
    if (tab === "audit" && owner) void loadAudit();
  }, [tab, canManageUsers, canViewRegistrations, owner, loadAudit, loadOverview, loadRegistrations, loadUsers]);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(searchText.trim());
    if (tab === "registrations") setRegistrationPage(1);
    if (tab === "users") setUserPage(1);
  }

  async function openRegistration(id: string, personal = false) {
    setIncludePersonal(personal);
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ id });
      if (personal) params.set("personal", "1");
      const payload = await responseJson<{ registration: RegistrationDetail }>(
        await fetch(`/api/admin/registrations?${params}`, { cache: "no-store" }),
      );
      setRegistrationDetail(payload.registration);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "جزئیات ثبت باز نشد.");
    } finally {
      setLoading(false);
    }
  }

  async function updateUser(userId: string, patch: { status?: string; roles?: AdminRole[] }) {
    setError("");
    if (
      patch.status === "suspended" &&
      !window.confirm("حساب این کاربر تعلیق شود؟ دسترسی او تا فعال‌سازی دوباره قطع خواهد شد.")
    )
      return;
    try {
      await responseJson(await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }));
      await loadUsers();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "تغییر کاربر انجام نشد.");
    }
  }

  function refresh() {
    if (tab === "overview") void loadOverview();
    if (tab === "registrations") void loadRegistrations();
    if (tab === "users") void loadUsers();
    if (tab === "audit") void loadAudit();
  }

  const navigation: { id: Tab; label: string }[] = [
    { id: "overview", label: "گزارش‌ها" },
    ...(canViewRegistrations ? [{ id: "registrations" as const, label: "ثبت‌ها" }] : []),
    ...(canManageUsers ? [{ id: "users" as const, label: "کاربران" }] : []),
    ...(owner ? [{ id: "audit" as const, label: "گزارش ممیزی" }] : []),
  ];
  const exportParams = new URLSearchParams({ status: statusFilter });
  if (query.trim()) exportParams.set("q", query.trim());
  const exportUrl = `/api/admin/registrations/export?${exportParams.toString()}`;

  return (
    <main className="app-shell glass-shell admin-shell">
      <header className="topbar">
        <Link className="back-link admin-back" href="/">
          <ArrowRight size={18} />
          بازگشت به جوانه
        </Link>
        <div className="admin-identity">
          <ShieldCheck size={18} />
          پنل مدیریت
        </div>
      </header>
      <section className="admin-content">
        <div className="admin-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-line" />دسترسی محدود و ثبت‌شده</p>
            <h1>مدیریت سامانه</h1>
            <p className="form-intro">نقش‌های شما: {roles.map((role) => roleLabels[role]).join("، ")}</p>
          </div>
          <button type="button" className="secondary-button" onClick={refresh} disabled={loading}>
            <RefreshCw size={17} />
            به‌روزرسانی
          </button>
        </div>
        <nav className="admin-tabs" aria-label="بخش‌های مدیریت">
          {navigation.map((item) => (
            <button
              type="button"
              key={item.id}
              className={tab === item.id ? "is-active" : ""}
              onClick={() => {
                setError("");
                setTab(item.id);
                setQuery("");
                setSearchText("");
                setRegistrationPage(1);
                setUserPage(1);
                setRegistrationDetail(null);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {loading && <p className="admin-status" role="status">در حال بارگذاری…</p>}

        {tab === "overview" && overview && (
          <section className="admin-stat-grid" aria-label="گزارش‌های تجمیعی">
            {[
              ["کل کاربران", overview.users],
              ["کاربران فعال", overview.activeUsers],
              ["کاربران جدید (۷ روز)", overview.newUsers7Days],
              ["کل ثبت‌ها", overview.registrations],
              ["ثبت نهایی‌شده", overview.submitted],
              ["پیش‌نویس", overview.drafts],
              ["نهایی‌شده در ۳۰ روز", overview.recentSubmissions],
              ["ایده‌های اولیه", overview.legacyIdeas],
            ].map(([label, value]) => (
              <article className="admin-stat-card" key={label}>
                <span>{label}</span>
                <strong>{Number(value).toLocaleString("fa-IR")}</strong>
              </article>
            ))}
          </section>
        )}

        {tab === "registrations" && (
          <section className="admin-panel">
            {!registrationDetail ? (
              <>
                <form className="admin-search" onSubmit={search}>
                  <label>
                    جست‌وجو در عنوان
                    <input value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={100} />
                  </label>
                  <label>
                    وضعیت
                    <select
                      value={statusFilter}
                      onChange={(event) => {
                        setStatusFilter(event.target.value);
                        setRegistrationPage(1);
                      }}
                    >
                      <option value="all">همه</option>
                      <option value="submitted">نهایی‌شده</option>
                      <option value="draft">پیش‌نویس</option>
                    </select>
                  </label>
                  <button className="primary-button" type="submit">جست‌وجو</button>
                </form>
                <div className="admin-export-actions">
                  {hasAdminPermission(roles, "registrations.export") && (
                    <>
                      <a className="text-button" href={exportUrl}>
                        <Download size={17} /> خروجی محدودشده CSV
                      </a>
                      {hasAdminPermission(roles, "registrations.personal") && (
                        <a className="text-button" href={`${exportUrl}&personal=1`}>
                          <Download size={17} /> خروجی شامل اطلاعات شخصی (ممیزی می‌شود)
                        </a>
                      )}
                    </>
                  )}
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>عنوان</th><th>وضعیت</th><th>شمارهٔ همراه پوشانده‌شده</th><th>آخرین تغییر</th><th>عملیات</th></tr></thead>
                    <tbody>
                      {registrations.map((item) => (
                        <tr key={item.id}>
                          <td>{item.title || "بدون عنوان"}</td>
                          <td>{item.status === "submitted" ? "نهایی‌شده" : "پیش‌نویس"}</td>
                          <td dir="ltr">{item.owner.mobile}</td>
                          <td>{formatDate(item.updatedAt)}</td>
                          <td><button className="text-button" type="button" onClick={() => void openRegistration(item.id)}>مشاهدهٔ جزئیات</button></td>
                        </tr>
                      ))}
                      {!registrations.length && !loading && <tr><td colSpan={5}>موردی پیدا نشد.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <PageControls
                  page={registrationPage}
                  total={registrationTotal}
                  onChange={setRegistrationPage}
                />
              </>
            ) : (
              <div className="admin-detail">
                <div className="admin-detail-heading">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      setIncludePersonal(false);
                      setRegistrationDetail(null);
                    }}
                  >
                    بازگشت به فهرست
                  </button>
                  <strong>ثبت {registrationDetail.id}</strong>
                </div>
                {hasAdminPermission(roles, "registrations.personal") && (
                  <label className="admin-privacy-toggle">
                    <input
                      type="checkbox"
                      checked={includePersonal}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setIncludePersonal(checked);
                        void openRegistration(registrationDetail.id, checked);
                      }}
                    />
                    مشاهدهٔ اطلاعات شخصی (این دسترسی در ممیزی ثبت می‌شود)
                  </label>
                )}
                <pre className="admin-json">{JSON.stringify(registrationDetail, null, 2)}</pre>
              </div>
            )}
          </section>
        )}

        {tab === "users" && (
          <section className="admin-panel">
            <form className="admin-search" onSubmit={search}>
              <label>
                جست‌وجو با بخشی از شمارهٔ همراه
                <input value={searchText} onChange={(event) => setSearchText(event.target.value)} minLength={3} maxLength={40} inputMode="tel" />
              </label>
              <button className="primary-button" type="submit">جست‌وجو</button>
              {hasAdminPermission(roles, "users.personal") && (
                <label className="admin-privacy-toggle">
                  <input
                    type="checkbox"
                    checked={revealUsers}
                    onChange={(event) => setRevealUsers(event.target.checked)}
                  />
                  نمایش شماره و نام (ممیزی می‌شود)
                </label>
              )}
            </form>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>شناسه</th><th>شماره همراه</th><th>وضعیت</th><th>نقش‌ها</th><th>مدیریت</th></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td><code>{user.id}</code>{user.fullName && <small className="admin-subline">{user.fullName}</small>}</td>
                      <td dir="ltr">{user.mobile}</td>
                      <td>{user.status === "active" ? "فعال" : "تعلیق‌شده"}</td>
                      <td>{user.roles?.map((role) => roleLabels[role]).join("، ") || "—"}</td>
                      <td>
                        <div className="admin-user-actions">
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => void updateUser(user.id, { status: user.status === "active" ? "suspended" : "active" })}
                            disabled={user.id === currentUserId && user.status === "active"}
                          >
                            {user.status === "active" ? "تعلیق" : "فعال‌سازی"}
                          </button>
                          {owner && (
                            <details>
                              <summary>تغییر نقش</summary>
                              <RoleEditor
                                key={`${user.id}-${user.roles?.join(",") ?? ""}`}
                                user={user}
                                onSave={(nextRoles) => void updateUser(user.id, { roles: nextRoles })}
                              />
                            </details>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!users.length && !loading && <tr><td colSpan={5}>کاربری پیدا نشد.</td></tr>}
                </tbody>
              </table>
            </div>
            <PageControls page={userPage} total={userTotal} onChange={setUserPage} />
          </section>
        )}

        {tab === "audit" && owner && (
          <section className="admin-panel">
            <p className="form-intro">اقدامات مدیریتی و دسترسی‌های حساس؛ شماره‌ها در این فهرست پوشانده شده‌اند.</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>زمان</th><th>اقدام</th><th>عامل</th><th>موضوع</th><th>جزئیات</th></tr></thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{formatDate(event.occurredAt)}</td>
                      <td dir="ltr">{event.action}</td>
                      <td dir="ltr">{event.actor}</td>
                      <td dir="ltr">{event.subject ?? event.entityType}</td>
                      <td><code>{JSON.stringify(event.metadata ?? {})}</code></td>
                    </tr>
                  ))}
                  {!events.length && !loading && <tr><td colSpan={5}>رویدادی ثبت نشده است.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function RoleEditor({
  user,
  onSave,
}: {
  user: AdminUser;
  onSave: (roles: AdminRole[]) => void;
}) {
  const [selected, setSelected] = useState<AdminRole[]>(
    user.roles ?? [],
  );
  return (
    <div className="admin-role-editor">
      {assignableRoles.map((role) => (
        <label key={role}>
          <input
            type="checkbox"
            checked={selected.includes(role)}
            onChange={(event) => setSelected((current) =>
              event.target.checked
                ? [...current, role]
                : current.filter((item) => item !== role),
            )}
          />
          {roleLabels[role]}
        </label>
      ))}
      <button className="text-button" type="button" onClick={() => onSave(selected)}>ذخیره نقش‌ها</button>
    </div>
  );
}

function PageControls({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / 25));
  if (pages <= 1) return null;
  return (
    <div className="admin-pagination" aria-label="صفحه‌بندی">
      <button type="button" className="text-button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        صفحهٔ قبل
      </button>
      <span>{page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</span>
      <button type="button" className="text-button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
        صفحهٔ بعد
      </button>
    </div>
  );
}
