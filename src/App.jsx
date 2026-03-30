import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

const OFFLINE_QUEUE_KEY = "ytso_offline_entry_queue_v7";
const SESSION_KEY = "ytso_active_session_v1";
const SESSION_TTL_MS = 30 * 60 * 1000;

const COLORS = {
  blue: "#1d4ed8",
  blue2: "#2563eb",
  blue3: "#60a5fa",
  blue4: "#bfdbfe",
  teal: "#0f766e",
  teal2: "#14b8a6",
  teal3: "#99f6e4",
  violet: "#7c3aed",
  violet2: "#a78bfa",
  violet3: "#ddd6fe",
  amber: "#d97706",
  amber2: "#f59e0b",
  amber3: "#fde68a",
  rose: "#e11d48",
  rose2: "#fb7185",
  rose3: "#fecdd3",
  emerald: "#059669",
  emerald2: "#34d399",
  emerald3: "#bbf7d0",
  slate: "#334155",
  muted: "#64748b",
  soft: "#94a3b8",
  border: "#e2e8f0",
  bg: "#f8fafc",
  bg2: "#f1f5f9",
  white: "#ffffff",
  dark: "#0f172a",
};

const USER_COLORS = [
  COLORS.blue,
  COLORS.teal,
  COLORS.violet,
  COLORS.amber,
  COLORS.rose,
  COLORS.emerald,
  "#9333ea",
  "#0284c7",
];

function getUserColor(index) {
  return USER_COLORS[index % USER_COLORS.length];
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getPreviousMonthKey(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(
    new Date(year, month - 1, 1)
  );
  return `${monthName.toLocaleUpperCase("tr-TR")} ${year}`;
}

function formatToday() {
  return new Intl.DateTimeFormat("tr-TR").format(new Date());
}

function calcDuration(start, end) {
  if (!start || !end) return "0:00";

  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;

  if (diff <= 30) {
    diff = 30;
  } else {
    const remainder = diff % 60;
    if (remainder !== 0) diff += 60 - remainder;
  }

  return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")}`;
}

function parseDurationToMinutes(duration) {
  if (!duration) return 0;
  const [h, m] = duration.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToText(minutes) {
  const safeMinutes = Number(minutes) || 0;
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  return `${h} saat ${String(m).padStart(2, "0")} dakika`;
}

function minutesToShortText(minutes) {
  const safeMinutes = Number(minutes) || 0;
  const h = Math.floor(safeMinutes / 60);
  const m = safeMinutes % 60;
  if (safeMinutes === 0) return "0 sa";
  if (m === 0) return `${h} sa`;
  return `${h}.${String(Math.round((m / 60) * 10)).padStart(1, "0")} sa`;
}

function percentageChange(current, previous) {
  if (!previous && !current) return "0%";
  if (!previous) return "+100%";
  const change = ((current - previous) / previous) * 100;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(1)}%`;
}

function workTypeLabel(value) {
  if (value === "hafta_ici") return "Hafta İçi";
  if (value === "hafta_sonu") return "Hafta Sonu";
  if (value === "resmi_tatil") return "Resmi Tatil";
  return "-";
}

function getDefaultWorkTypeByDate(dateStr) {
  if (!dateStr) return "hafta_ici";
  const d = new Date(dateStr);
  const day = d.getDay();
  if (day === 0 || day === 6) return "hafta_sonu";
  return "hafta_ici";
}

function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function setQueue(items) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
}

function saveSession(user) {
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      user,
      expiresAt: Date.now() + SESSION_TTL_MS,
    })
  );
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.user || !parsed?.expiresAt) return null;
    if (Date.now() > parsed.expiresAt) {
      clearSession();
      return null;
    }
    return parsed.user;
  } catch {
    return null;
  }
}

function EmptyState({ text }) {
  return (
    <div
      style={{
        padding: 18,
        border: `1px dashed ${COLORS.border}`,
        borderRadius: 16,
        color: COLORS.muted,
        fontSize: 13,
        background: COLORS.bg,
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}

function AppShell({ children, mobile }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #f8fbff 0%, #eef4ff 35%, #f8fafc 100%)",
        padding: mobile ? 12 : 24,
        paddingBottom: mobile ? 96 : 24,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: COLORS.dark,
      }}
    >
      <div style={{ maxWidth: 1480, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.97)",
        border: `1px solid ${COLORS.border}`,
        borderRadius: 24,
        boxShadow: "0 12px 32px rgba(15,23,42,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle, action }) {
  return (
    <div
      style={{
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-start",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {title}
        </div>
        {subtitle ? (
          <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {action || null}
    </div>
  );
}

function StatPill({ label, value, strong, color, sub }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "12px 14px",
        background: strong ? "#eff6ff" : COLORS.bg,
        border: strong ? `1px solid ${COLORS.blue4}` : `1px solid ${COLORS.border}`,
        borderLeft: color ? `3px solid ${color}` : undefined,
      }}
    >
      <div style={{ fontSize: 12, color: COLORS.muted }}>{label}</div>
      <div
        style={{
          fontSize: strong ? 18 : 16,
          fontWeight: strong ? 800 : 700,
          marginTop: 2,
          color: color || COLORS.dark,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: 11, color: COLORS.soft, marginTop: 4 }}>{sub}</div>
      ) : null}
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  type = "button",
  full,
  active,
  danger,
  ghost,
  success,
}) {
  let background = COLORS.white;
  let color = COLORS.dark;
  let border = `1px solid ${COLORS.border}`;

  if (success) {
    background = COLORS.emerald;
    color = "#fff";
    border = `1px solid ${COLORS.emerald}`;
  } else if (danger) {
    background = "#fef2f2";
    color = "#b91c1c";
    border = "1px solid #fecaca";
  } else if (active) {
    background = COLORS.blue;
    color = "#fff";
    border = `1px solid ${COLORS.blue}`;
  } else if (ghost) {
    background = "transparent";
    border = "1px solid transparent";
  }

  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        minHeight: 46,
        padding: "12px 16px",
        borderRadius: 14,
        border,
        background,
        color,
        fontWeight: 700,
        cursor: "pointer",
        width: full ? "100%" : undefined,
        transition: "all .2s ease",
      }}
    >
      {children}
    </button>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.white,
        color: COLORS.dark,
        WebkitTextFillColor: COLORS.dark,
        fontSize: 14,
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      style={{
        width: "100%",
        minHeight: 100,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.white,
        color: COLORS.dark,
        WebkitTextFillColor: COLORS.dark,
        fontSize: 14,
        boxSizing: "border-box",
        resize: "vertical",
        ...props.style,
      }}
    />
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        minHeight: 46,
        padding: "12px 14px",
        borderRadius: 14,
        border: `1px solid ${COLORS.border}`,
        background: COLORS.white,
        color: COLORS.dark,
        WebkitTextFillColor: COLORS.dark,
        fontSize: 14,
        boxSizing: "border-box",
        ...props.style,
      }}
    />
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <label
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: COLORS.slate,
          paddingLeft: 2,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function EntryCard({ item, mobile, canEdit, canDelete, onEdit, onDelete }) {
  const typeColor =
    item.work_type === "hafta_ici"
      ? COLORS.blue
      : item.work_type === "hafta_sonu"
      ? COLORS.teal
      : COLORS.violet;

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: mobile ? 12 : 14,
        background: COLORS.white,
        borderLeft: `3px solid ${typeColor}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 800 }}>{item.date}</div>
        <div style={{ color: COLORS.blue, fontWeight: 700 }}>{item.duration}</div>
      </div>

      <div style={{ marginTop: 6, fontSize: 13, color: COLORS.muted }}>
        {item.start} - {item.end}
      </div>

      <div style={{ marginTop: 6, fontSize: 13 }}>
        <span
          style={{
            fontWeight: 700,
            fontSize: 11,
            padding: "2px 8px",
            borderRadius: 999,
            background:
              item.work_type === "hafta_ici"
                ? "#eff6ff"
                : item.work_type === "hafta_sonu"
                ? "#f0fdfa"
                : "#f5f3ff",
            color: typeColor,
            border: `1px solid ${
              item.work_type === "hafta_ici"
                ? COLORS.blue4
                : item.work_type === "hafta_sonu"
                ? COLORS.teal3
                : COLORS.violet3
            }`,
          }}
        >
          {workTypeLabel(item.work_type)}
        </span>
        {" · "}
        <span style={{ color: COLORS.slate }}>{item.user_name}</span>
      </div>

      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45, color: COLORS.slate }}>
        {item.description}
      </div>

      {(canEdit || canDelete) && (
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {canEdit && <PrimaryButton onClick={() => onEdit(item)}>Düzenle</PrimaryButton>}
          {canDelete && (
            <PrimaryButton danger onClick={() => onDelete(item)}>
              Sil
            </PrimaryButton>
          )}
        </div>
      )}
    </div>
  );
}

function EnhancedBarChart({ data, mobile }) {
  const maxValue = Math.max(...data.map((x) => x.minutes), 1);

  if (!data.length || !data.some((d) => d.minutes > 0)) {
    return <EmptyState text="Seçilen ay için grafik verisi bulunamadı." />;
  }

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        padding: mobile ? 14 : 20,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
        Kullanıcı Bazlı Mesai
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 18 }}>
        Seçilen dönemde en yüksekten düşüğe sıralama
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((item, index) => {
          const pct = maxValue > 0 ? (item.minutes / maxValue) * 100 : 0;
          const color = getUserColor(index);

          return (
            <div
              key={`${item.userId}-${index}`}
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                background: "transparent",
                border: `1px solid transparent`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</span>
                  {item.department ? (
                    <span
                      style={{
                        fontSize: 11,
                        color: COLORS.muted,
                        background: COLORS.bg,
                        padding: "2px 8px",
                        borderRadius: 999,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      {item.department}
                    </span>
                  ) : null}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>
                    {item.recordCount} kayıt
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color }}>
                    {minutesToShortText(item.minutes)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  position: "relative",
                  height: 10,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 999,
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    transition: "width .4s cubic-bezier(.4,0,.2,1)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EnhancedDonutChart({ data, mobile }) {
  const filtered = data.filter((x) => x.minutes > 0).slice(0, 8);
  const total = filtered.reduce((sum, item) => sum + item.minutes, 0);

  if (!filtered.length || total <= 0) {
    return <EmptyState text="Seçilen ay için pasta grafik verisi bulunamadı." />;
  }

  const cx = 100;
  const cy = 100;
  const r = 68;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * r;
  let accumulated = 0;

  const segments = filtered.map((item, index) => {
    const fraction = item.minutes / total;
    const segment = fraction * circumference;
    const offset = -accumulated;
    accumulated += segment;
    return { ...item, fraction, segment, offset, color: getUserColor(index) };
  });

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        padding: mobile ? 14 : 20,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
        Kullanıcı Payları
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
        Toplam mesainin dağılımı
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: mobile ? "1fr" : "200px 1fr",
          gap: 20,
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center" }}>
          <svg width="200" height="200" viewBox="0 0 200 200">
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={strokeWidth}
            />

            {segments.map((seg) => (
              <circle
                key={seg.userId}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${seg.segment} ${circumference - seg.segment}`}
                strokeDashoffset={seg.offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            ))}

            <circle
              cx={cx}
              cy={cy}
              r={r - strokeWidth / 2 - 4}
              fill={COLORS.white}
            />

            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={COLORS.slate}
            >
              Toplam
            </text>
            <text
              x={cx}
              y={cy + 14}
              textAnchor="middle"
              fontSize="11"
              fill={COLORS.muted}
            >
              {minutesToShortText(total)}
            </text>
          </svg>
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {segments.map((seg) => (
            <div
              key={seg.userId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                background: "transparent",
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: seg.color,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {seg.name}
                </div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>
                  {minutesToShortText(seg.minutes)} · {seg.recordCount} kayıt
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: seg.color,
                  flexShrink: 0,
                }}
              >
                %{(seg.fraction * 100).toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function EnhancedStatsTable({ data, mobile, onDrilldown, searchTerm }) {
  const [sortKey, setSortKey] = useState("minutes");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = data.filter((item) => {
    const q = (searchTerm || "").trim().toLowerCase();
    if (!q) return true;
    return (
      item.name?.toLowerCase().includes(q) ||
      item.department?.toLowerCase().includes(q)
    );
  });

  if (!filtered.length) {
    return <EmptyState text="Filtreye uygun kullanıcı verisi bulunamadı." />;
  }

  const sorted = [...filtered].sort((a, b) => {
    const aVal = sortKey === "name" ? a.name.localeCompare(b.name) : a[sortKey] - b[sortKey];
    return sortDir === "desc" ? -aVal : aVal;
  });

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const arrow = (key) => (sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : "");

  if (mobile) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        {sorted.map((item, idx) => (
          <div
            key={item.userId}
            style={{
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: 14,
              background: COLORS.white,
              borderLeft: `3px solid ${getUserColor(idx)}`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                  {item.department || "-"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 800, color: COLORS.blue, fontSize: 15 }}>
                  {minutesToShortText(item.minutes)}
                </div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {item.recordCount} kayıt
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: 8,
              }}
            >
              <StatPill label="Hafta İçi" value={minutesToShortText(item.hafta_ici)} color={COLORS.blue} />
              <StatPill label="H. Sonu" value={minutesToShortText(item.hafta_sonu)} color={COLORS.teal} />
              <StatPill label="Tatil" value={minutesToShortText(item.resmi_tatil)} color={COLORS.violet} />
            </div>

            {onDrilldown ? (
              <button
                onClick={() => onDrilldown(item)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "8px 0",
                  borderRadius: 10,
                  border: `1px solid ${COLORS.blue4}`,
                  background: "#eff6ff",
                  color: COLORS.blue,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Detay Gör →
              </button>
            ) : null}
          </div>
        ))}
      </div>
    );
  }

  const thStyle = (key) => ({
    textAlign: "left",
    padding: "12px 14px",
    borderBottom: `2px solid ${COLORS.border}`,
    color: sortKey === key ? COLORS.blue : COLORS.slate,
    fontWeight: 700,
    fontSize: 12,
    cursor: key ? "pointer" : "default",
    userSelect: "none",
    background: COLORS.bg,
    whiteSpace: "nowrap",
    position: "sticky",
    top: 0,
    zIndex: 1,
  });

  return (
    <div
      style={{
        borderRadius: 16,
        overflow: "auto",
        border: `1px solid ${COLORS.border}`,
        maxHeight: 520,
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={thStyle("name")} onClick={() => toggleSort("name")}>
              Kullanıcı{arrow("name")}
            </th>
            <th style={thStyle("")}>Birim</th>
            <th style={thStyle("recordCount")} onClick={() => toggleSort("recordCount")}>
              Kayıt{arrow("recordCount")}
            </th>
            <th style={thStyle("hafta_ici")} onClick={() => toggleSort("hafta_ici")}>
              Hafta İçi{arrow("hafta_ici")}
            </th>
            <th style={thStyle("hafta_sonu")} onClick={() => toggleSort("hafta_sonu")}>
              Hafta Sonu{arrow("hafta_sonu")}
            </th>
            <th style={thStyle("resmi_tatil")} onClick={() => toggleSort("resmi_tatil")}>
              Res. Tatil{arrow("resmi_tatil")}
            </th>
            <th style={thStyle("minutes")} onClick={() => toggleSort("minutes")}>
              Toplam{arrow("minutes")}
            </th>
            {onDrilldown ? <th style={thStyle("")}></th> : null}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item, idx) => {
            const color = getUserColor(idx);
            return (
              <tr
                key={item.userId}
                style={{ background: idx % 2 === 0 ? COLORS.white : "#fafcff" }}
              >
                <td style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontWeight: 700 }}>{item.name}</span>
                  </div>
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.muted,
                  }}
                >
                  {item.department || "-"}
                </td>
                <td
                  style={{
                    padding: "12px 14px",
                    borderBottom: `1px solid ${COLORS.border}`,
                    textAlign: "center",
                  }}
                >
                  <span
                    style={{
                      background: COLORS.bg,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 999,
                      padding: "2px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {item.recordCount}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.blue, fontWeight: 600 }}>
                    {minutesToShortText(item.hafta_ici)}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.teal, fontWeight: 600 }}>
                    {minutesToShortText(item.hafta_sonu)}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ color: COLORS.violet, fontWeight: 600 }}>
                    {minutesToShortText(item.resmi_tatil)}
                  </span>
                </td>
                <td style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                  <span style={{ fontWeight: 800, color, fontSize: 14 }}>
                    {minutesToShortText(item.minutes)}
                  </span>
                </td>
                {onDrilldown ? (
                  <td style={{ padding: "12px 14px", borderBottom: `1px solid ${COLORS.border}` }}>
                    <button
                      onClick={() => onDrilldown(item)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        border: `1px solid ${COLORS.blue4}`,
                        background: "#eff6ff",
                        color: COLORS.blue,
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Detay →
                    </button>
                  </td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MonthlyPersonalChart({ data, mobile }) {
  const maxValue = Math.max(...data.map((x) => x.minutes), 0);

  if (!data.length || !data.some((x) => x.minutes > 0)) {
    return <EmptyState text="Seçilen ay için kişisel grafik verisi bulunamadı." />;
  }

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: mobile ? 12 : 16,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
        Gün Bazlı Mesai
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
        Seçilen ay içindeki günlük mesai görünümü
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          gap: mobile ? 2 : 3,
          alignItems: "end",
          minHeight: 160,
        }}
      >
        {data.map((item, i) => {
          const height = maxValue > 0 ? Math.max(6, (item.minutes / maxValue) * 120) : 6;
          const active = item.minutes > 0;

          return (
            <div
              key={`${item.day}-${i}`}
              title={active ? `${item.label}: ${item.durationText}` : undefined}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 3,
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 14,
                  height: active ? height : 4,
                  borderRadius: 4,
                  background: active
                    ? `linear-gradient(180deg, #5eead4, ${COLORS.teal})`
                    : "#e2e8f0",
                }}
              />
              <div
                style={{
                  fontSize: 9,
                  color: active ? COLORS.slate : COLORS.muted,
                  fontWeight: active ? 700 : 400,
                }}
              >
                {item.day}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TypeBreakdownChart({ haftaIci, haftaSonu, resmiTatil, mobile }) {
  const segments = [
    { label: "Hafta İçi", minutes: haftaIci, color: COLORS.blue },
    { label: "Hafta Sonu", minutes: haftaSonu, color: COLORS.teal },
    { label: "Resmi Tatil", minutes: resmiTatil, color: COLORS.violet },
  ];
  const total = segments.reduce((s, x) => s + x.minutes, 0);

  if (total <= 0) {
    return <EmptyState text="Dağılım grafiği için veri bulunamadı." />;
  }

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: mobile ? 12 : 16,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
        Mesai Türü Dağılımı
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
        Aylık mesai türlerinin oranı
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {segments.map((item) => {
          const pct = total > 0 ? (item.minutes / total) * 100 : 0;
          return (
            <div key={item.label}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: item.color,
                    }}
                  />
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{item.label}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>
                    {minutesToShortText(item.minutes)}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: item.color }}>
                    %{pct.toFixed(1)}
                  </span>
                </div>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: "10px 14px",
          borderRadius: 12,
          background: "#eff6ff",
          border: `1px solid ${COLORS.blue4}`,
        }}
      >
        <span style={{ fontSize: 12, color: COLORS.muted }}>Toplam: </span>
        <span style={{ fontWeight: 800, fontSize: 14, color: COLORS.blue }}>
          {minutesToText(total)}
        </span>
      </div>
    </div>
  );
}

function MiniSixMonthTrend({ data, title, subtitle }) {
  const maxValue = Math.max(...data.map((x) => x.minutes), 0);

  if (!data.some((x) => x.minutes > 0)) {
    return <EmptyState text="Trend verisi bulunamadı." />;
  }

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 16,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>{subtitle}</div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`,
          gap: 8,
          alignItems: "end",
          minHeight: 170,
        }}
      >
        {data.map((item, index) => {
          const height = maxValue > 0 ? Math.max(18, (item.minutes / maxValue) * 110) : 18;
          return (
            <div
              key={`${item.monthKey}-${index}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 6,
              }}
            >
              <div style={{ fontSize: 10, color: COLORS.slate, fontWeight: 700 }}>
                {item.minutes > 0 ? minutesToShortText(item.minutes) : ""}
              </div>
              <div
                style={{
                  width: "100%",
                  maxWidth: 30,
                  height,
                  borderRadius: "10px 10px 4px 4px",
                  background:
                    item.minutes > 0
                      ? `linear-gradient(180deg, ${COLORS.blue3}, ${COLORS.blue})`
                      : "#e2e8f0",
                }}
              />
              <div style={{ fontSize: 10, color: COLORS.muted, fontWeight: 700 }}>
                {item.shortLabel}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DepartmentBarChart({ data, mobile }) {
  const maxValue = Math.max(...data.map((x) => x.minutes), 1);

  if (!data.length || !data.some((x) => x.minutes > 0)) {
    return <EmptyState text="Birim bazlı veri bulunamadı." />;
  }

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: mobile ? 12 : 16,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
        Birim Bazlı Mesai
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
        Birimlere göre toplam mesai görünümü
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {data.map((item, index) => {
          const pct = (item.minutes / maxValue) * 100;
          const color = getUserColor(index);
          return (
            <div key={item.department}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 6,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{item.department}</div>
                <div style={{ fontSize: 12, color: COLORS.muted }}>
                  {minutesToShortText(item.minutes)} · {item.recordCount} kayıt
                </div>
              </div>

              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "#e2e8f0",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekdayHeatmap({ weekdayData }) {
  const maxValue = Math.max(...weekdayData.map((x) => x.minutes), 0);

  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 16,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
        Gün Yoğunluk Haritası
      </div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
        Haftanın günlerine göre yoğunluk
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 10,
        }}
      >
        {weekdayData.map((item) => {
          const intensity = maxValue > 0 ? item.minutes / maxValue : 0;
          const bg =
            intensity === 0
              ? "#f8fafc"
              : intensity < 0.25
              ? "#dbeafe"
              : intensity < 0.5
              ? "#93c5fd"
              : intensity < 0.75
              ? "#60a5fa"
              : "#1d4ed8";

          const color = intensity >= 0.5 ? "#fff" : COLORS.dark;

          return (
            <div
              key={item.label}
              style={{
                borderRadius: 16,
                padding: "16px 10px",
                background: bg,
                border: `1px solid ${COLORS.border}`,
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color }}>{item.label}</div>
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 800, color }}>
                {minutesToShortText(item.minutes)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearlyTrendChart({ data, selectedYear, mobile, currentUserName }) {
  const maxValue = Math.max(...data.map((x) => x.minutes), 0);

  if (!selectedYear) return <EmptyState text="Yıllık grafik için önce yıl seçin." />;
  if (!data.some((x) => x.minutes > 0)) {
    return <EmptyState text={`${selectedYear} yılı için grafik verisi bulunamadı.`} />;
  }

  return (
    <div
      style={{
        marginTop: 18,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 20,
        padding: mobile ? 12 : 20,
        background: COLORS.white,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 800 }}>Yıllık Mesai Trendi</div>
      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 4, marginBottom: 20 }}>
        {currentUserName} · {selectedYear} — aylara göre toplam mesai
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, minmax(0, 1fr))",
          gap: mobile ? 4 : 8,
          alignItems: "end",
          minHeight: 220,
        }}
      >
        {data.map((item, index) => {
          const height = maxValue > 0 ? Math.max(16, (item.minutes / maxValue) * 160) : 16;
          const isActive = item.minutes > 0;

          return (
            <div
              key={`${item.monthKey}-${index}`}
              title={`${item.label}: ${item.durationText}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                gap: 6,
                minHeight: 200,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: isActive ? COLORS.dark : COLORS.muted,
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "center",
                  minHeight: 24,
                }}
              >
                {item.minutes > 0 ? `${(item.minutes / 60).toFixed(1)} sa` : ""}
              </div>

              <div
                style={{
                  width: "100%",
                  maxWidth: 32,
                  height,
                  borderRadius: "8px 8px 4px 4px",
                  background: isActive
                    ? `linear-gradient(180deg, ${COLORS.blue3} 0%, ${COLORS.blue} 100%)`
                    : "#e2e8f0",
                  boxShadow: isActive ? "0 4px 12px rgba(37,99,235,0.12)" : "none",
                }}
              />
              <div
                style={{
                  fontSize: 10,
                  color: COLORS.slate,
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                {item.shortLabel}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: mobile ? "1fr" : "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        <StatPill
          label="Yıllık Toplam"
          value={minutesToText(data.reduce((s, x) => s + x.minutes, 0))}
          strong
        />
        <StatPill
          label="En Yoğun Ay"
          value={
            [...data].sort((a, b) => b.minutes - a.minutes)[0]?.minutes > 0
              ? [...data].sort((a, b) => b.minutes - a.minutes)[0].label
              : "-"
          }
        />
        <StatPill
          label="Aylık Ortalama"
          value={minutesToShortText(Math.round(data.reduce((s, x) => s + x.minutes, 0) / 12))}
        />
      </div>
    </div>
  );
}

function UserDrilldownPanel({ user: targetUser, entries, allMonths, mobile, onClose }) {
  const [drillMonth, setDrillMonth] = useState(allMonths[0] || "");

  const userEntries = useMemo(() => {
    return entries
      .filter((e) => e.user_id === targetUser.userId)
      .filter((e) => !drillMonth || e.date?.startsWith(drillMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, targetUser, drillMonth]);

  const totals = useMemo(() => {
    return userEntries.reduce(
      (acc, item) => {
        const mins = parseDurationToMinutes(item.duration);
        if (item.work_type === "hafta_sonu") acc.hafta_sonu += mins;
        else if (item.work_type === "resmi_tatil") acc.resmi_tatil += mins;
        else acc.hafta_ici += mins;
        acc.total += mins;
        return acc;
      },
      { hafta_ici: 0, hafta_sonu: 0, resmi_tatil: 0, total: 0 }
    );
  }, [userEntries]);

  const dailyData = useMemo(() => {
    if (!drillMonth) return [];
    const [year, month] = drillMonth.split("-").map(Number);
    const days = new Date(year, month, 0).getDate();

    return Array.from({ length: days }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      const dayKey = `${drillMonth}-${day}`;
      const dayEntries = userEntries.filter((e) => e.date === dayKey);
      const mins = dayEntries.reduce((s, e) => s + parseDurationToMinutes(e.duration), 0);
      return { day: String(i + 1), mins };
    });
  }, [drillMonth, userEntries]);

  const maxMins = Math.max(...dailyData.map((d) => d.mins), 1);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(15,23,42,0.45)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: mobile ? "flex-end" : "center",
        justifyContent: "center",
        padding: mobile ? 0 : 24,
      }}
    >
      <div
        style={{
          background: COLORS.white,
          borderRadius: mobile ? "20px 20px 0 0" : 24,
          width: "100%",
          maxWidth: 860,
          maxHeight: mobile ? "90vh" : "85vh",
          overflow: "auto",
          boxShadow: "0 24px 64px rgba(15,23,42,0.2)",
        }}
      >
        <div
          style={{
            padding: mobile ? "16px 16px 12px" : "20px 24px 16px",
            borderBottom: `1px solid ${COLORS.border}`,
            position: "sticky",
            top: 0,
            background: COLORS.white,
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>{targetUser.name}</div>
            <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 2 }}>
              {targetUser.department || "—"} · Kullanıcı Detayı
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bg,
              cursor: "pointer",
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: mobile ? 16 : 24, display: "grid", gap: 20 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "200px 1fr",
              gap: 12,
              alignItems: "end",
            }}
          >
            <Field label="Ay Seçimi">
              <SelectInput value={drillMonth} onChange={(e) => setDrillMonth(e.target.value)}>
                <option value="">Tüm kayıtlar</option>
                {allMonths.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              <StatPill label="Kayıt" value={String(userEntries.length)} />
              <StatPill label="Hafta İçi" value={minutesToShortText(totals.hafta_ici)} color={COLORS.blue} />
              <StatPill label="Hafta Sonu" value={minutesToShortText(totals.hafta_sonu)} color={COLORS.teal} />
              <StatPill label="Toplam" value={minutesToShortText(totals.total)} strong />
            </div>
          </div>

          {drillMonth && dailyData.some((d) => d.mins > 0) ? (
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: mobile ? 12 : 16,
                background: COLORS.white,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14 }}>
                Gün Bazlı Dağılım
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${dailyData.length}, minmax(0, 1fr))`,
                  gap: 3,
                  alignItems: "end",
                  minHeight: 120,
                }}
              >
                {dailyData.map((d, i) => {
                  const h = maxMins > 0 ? Math.max(4, (d.mins / maxMins) * 100) : 4;
                  return (
                    <div
                      key={i}
                      title={d.mins > 0 ? `${d.day}: ${minutesToShortText(d.mins)}` : undefined}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: 4,
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 16,
                          height: d.mins > 0 ? h : 4,
                          borderRadius: 4,
                          background:
                            d.mins > 0
                              ? `linear-gradient(180deg, ${COLORS.blue3}, ${COLORS.blue})`
                              : "#e2e8f0",
                        }}
                      />
                      <div style={{ fontSize: 9, color: COLORS.muted, fontWeight: d.mins > 0 ? 700 : 400 }}>
                        {d.day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 10 }}>
              Kayıt Detayları
            </div>

            {userEntries.length === 0 ? (
              <EmptyState text="Bu dönem için kayıt bulunamadı." />
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {userEntries.map((e, i) => (
                  <div
                    key={e.id}
                    style={{
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      background: i % 2 === 0 ? COLORS.white : COLORS.bg,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{e.date}</span>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>
                        {e.start}–{e.end}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 700,
                          background:
                            e.work_type === "hafta_ici"
                              ? "#eff6ff"
                              : e.work_type === "hafta_sonu"
                              ? "#f0fdfa"
                              : "#f5f3ff",
                          color:
                            e.work_type === "hafta_ici"
                              ? COLORS.blue
                              : e.work_type === "hafta_sonu"
                              ? COLORS.teal
                              : COLORS.violet,
                          border: `1px solid ${
                            e.work_type === "hafta_ici"
                              ? COLORS.blue4
                              : e.work_type === "hafta_sonu"
                              ? COLORS.teal3
                              : COLORS.violet3
                          }`,
                        }}
                      >
                        {workTypeLabel(e.work_type)}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span
                        style={{
                          fontSize: 12,
                          color: COLORS.muted,
                          maxWidth: 220,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {e.description}
                      </span>
                      <span style={{ fontWeight: 800, color: COLORS.blue, fontSize: 14 }}>
                        {e.duration}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(loadSession());
  const [entries, setEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    signature2_name: "Genel Sekreter",
    signature3_name: "Yönetim Kurulu Başkanı",
  });
  const [activeTab, setActiveTab] = useState("entry");
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [syncing, setSyncing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1280
  );

  const [login, setLogin] = useState({ name: "", password: "" });
  const [newUser, setNewUser] = useState({
    name: "",
    password: "",
    department: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [adminPasswordMap, setAdminPasswordMap] = useState({});
  const [form, setForm] = useState({
    date: "",
    start: "",
    end: "",
    description: "",
    work_type: "hafta_ici",
  });
  const [selectedUser, setSelectedUser] = useState("all");
  const [entryUserId, setEntryUserId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [adminStatsMonth, setAdminStatsMonth] = useState("");
  const [personalStatsMonth, setPersonalStatsMonth] = useState("");
  const [reportMode, setReportMode] = useState("monthly");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [drilldownUser, setDrilldownUser] = useState(null);

  const [adminFilterYear, setAdminFilterYear] = useState("");
  const [adminFilterMonth, setAdminFilterMonth] = useState("");
  const [adminFilterUser, setAdminFilterUser] = useState("all");
  const [adminFilterDepartment, setAdminFilterDepartment] = useState("all");
  const [adminFilterWorkType, setAdminFilterWorkType] = useState("all");
  const [adminSearchTerm, setAdminSearchTerm] = useState("");

  const mobile = viewportWidth < 768;
  const tablet = viewportWidth >= 768 && viewportWidth < 1180;

  const loadAll = async () => {
    const [
      { data: usersData },
      { data: entriesData },
      { data: logsData },
      { data: settingsData },
    ] = await Promise.all([
      supabase.from("users").select("*").order("name"),
      supabase.from("entries").select("*").order("date", { ascending: false }),
      supabase.from("logs").select("*").order("created_at", { ascending: false }),
      supabase.from("settings").select("*").limit(1).maybeSingle(),
    ]);

    setUsers(usersData || []);
    setEntries(entriesData || []);
    setLogs(logsData || []);
    if (settingsData) setSettings(settingsData);
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (user) saveSession(user);
    else clearSession();
  }, [user]);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    const touch = () => {
      if (user) saveSession(user);
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener("click", touch);
    window.addEventListener("keydown", touch);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("click", touch);
      window.removeEventListener("keydown", touch);
    };
  }, [user]);

  const addLog = async (message) => {
    if (!online) return;
    await supabase.from("logs").insert({ message });
    const { data } = await supabase
      .from("logs")
      .select("*")
      .order("created_at", { ascending: false });
    setLogs(data || []);
  };

  const syncOfflineQueue = async () => {
    if (!online || syncing) return;
    const queue = getQueue();
    if (!queue.length) return;

    setSyncing(true);
    const remaining = [];
    for (const item of queue) {
      const { error } = await supabase.from("entries").insert(item);
      if (error) remaining.push(item);
    }

    setQueue(remaining);
    await loadAll();

    if (queue.length !== remaining.length) {
      await addLog(`Çevrimdışı kayıtlar senkronize edildi: ${queue.length - remaining.length}`);
    }
    setSyncing(false);
  };

  useEffect(() => {
    if (online) syncOfflineQueue();
  }, [online]);

  const resetEntryForm = () => {
    setForm({
      date: "",
      start: "",
      end: "",
      description: "",
      work_type: "hafta_ici",
    });
    setEntryUserId("");
    setEditingEntryId(null);
  };

  const loginUser = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("name", login.name)
      .maybeSingle();

    if (error || !data) {
      alert("Hatalı giriş");
      return;
    }

    const passwordHash = data.password_hash;
    let ok = false;

    if (passwordHash) {
      ok = await bcrypt.compare(login.password, passwordHash);
    } else if (data.password) {
      ok = login.password === data.password;
      if (ok) {
        const newHash = await bcrypt.hash(login.password, 10);
        await supabase.from("users").update({ password_hash: newHash }).eq("id", data.id);
      }
    }

    if (!ok) {
      alert("Hatalı giriş");
      return;
    }

    setUser(data);
    saveSession(data);
  };

  const logout = () => {
    setUser(null);
    setSelectedUser("all");
    setEntryUserId("");
    setSelectedMonth("");
    setSelectedYear("");
    setAdminStatsMonth("");
    setPersonalStatsMonth("");
    setReportMode("monthly");
    setActiveTab("entry");
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    resetEntryForm();
    clearSession();
  };

  const addUser = async () => {
    if (!newUser.name || !newUser.password || !newUser.department) {
      alert("Ad, şifre ve birim zorunludur.");
      return;
    }

    const password_hash = await bcrypt.hash(newUser.password, 10);
    const { error } = await supabase.from("users").insert({
      name: newUser.name,
      password_hash,
      role: "user",
      department: newUser.department,
    });

    if (error) {
      alert("Kullanıcı eklenemedi: " + error.message);
      return;
    }

    await addLog(`Yeni kullanıcı eklendi: ${newUser.name}`);
    setNewUser({ name: "", password: "", department: "" });
    await loadAll();
    alert("Kullanıcı başarıyla eklendi.");
  };

  const adminUpdateUserPassword = async (targetUser) => {
    const newPassword = adminPasswordMap[targetUser.id] || "";
    if (!newPassword || newPassword.trim().length < 6) {
      alert("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }

    const password_hash = await bcrypt.hash(newPassword.trim(), 10);
    const { error } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("id", targetUser.id);

    if (error) {
      alert("Şifre güncellenemedi: " + error.message);
      return;
    }

    await addLog(`${user.name}, ${targetUser.name} kullanıcısının şifresini güncelledi`);
    setAdminPasswordMap((prev) => ({ ...prev, [targetUser.id]: "" }));
    await loadAll();
    alert(`${targetUser.name} için şifre güncellendi.`);
  };

  const changePassword = async () => {
    if (!user) return;
    if (!passwordForm.oldPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      alert("Tüm şifre alanlarını doldurun.");
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert("Yeni şifreler eşleşmiyor.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      alert("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      alert("Kullanıcı bilgisi alınamadı.");
      return;
    }

    let oldOk = false;
    if (data.password_hash) oldOk = await bcrypt.compare(passwordForm.oldPassword, data.password_hash);
    else if (data.password) oldOk = passwordForm.oldPassword === data.password;

    if (!oldOk) {
      alert("Eski şifre yanlış.");
      return;
    }

    const password_hash = await bcrypt.hash(passwordForm.newPassword, 10);
    const { error: updateError } = await supabase
      .from("users")
      .update({ password_hash })
      .eq("id", user.id);

    if (updateError) {
      alert("Şifre güncellenemedi: " + updateError.message);
      return;
    }

    await addLog(`${user.name} şifresini değiştirdi`);
    setPasswordForm({
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    await loadAll();
    alert("Şifre başarıyla güncellendi.");
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`${name} kullanıcısını silmek istiyor musunuz?`)) return;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      alert("Kullanıcı silinemedi: " + error.message);
      return;
    }
    await addLog(`Kullanıcı silindi: ${name}`);
    await loadAll();
    alert("Kullanıcı silindi.");
  };

  const saveSettings = async () => {
    const { data: current } = await supabase
      .from("settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    if (current?.id) {
      await supabase
        .from("settings")
        .update({
          signature2_name: settings.signature2_name,
          signature3_name: settings.signature3_name,
        })
        .eq("id", current.id);
    } else {
      await supabase.from("settings").insert({
        signature2_name: settings.signature2_name,
        signature3_name: settings.signature3_name,
      });
    }

    await addLog("İmzacı bilgileri güncellendi");
    await loadAll();
    alert("İmzacı bilgileri kaydedildi.");
  };

  const submitEntry = async (e) => {
    e.preventDefault();
    if (!user) return;

    if (!form.date || !form.start || !form.end || !form.description || !form.work_type) {
      alert("Tüm alanları doldurun.");
      return;
    }

    const targetUser =
      user.role === "admin" && entryUserId
        ? users.find((u) => u.id === entryUserId)
        : editingEntryId
        ? users.find((u) => u.id === entryUserId) || user
        : user;

    if (!targetUser) {
      alert("Lütfen kayıt girilecek kullanıcıyı seçin.");
      return;
    }

    const payload = {
      user_id: targetUser.id,
      user_name: targetUser.name,
      date: form.date,
      start: form.start,
      end: form.end,
      description: form.description,
      work_type: form.work_type,
      duration: calcDuration(form.start, form.end),
    };

    if (editingEntryId) {
      const { error } = await supabase
        .from("entries")
        .update(payload)
        .eq("id", editingEntryId);

      if (error) {
        alert("Mesai kaydı güncellenemedi: " + error.message);
        return;
      }

      await addLog(`${user.name}, ${targetUser.name} için mesai kaydını güncelledi`);
      resetEntryForm();
      await loadAll();
      alert("Mesai kaydı güncellendi.");
      return;
    }

    if (!online) {
      const queue = getQueue();
      queue.push({ ...payload, _queuedAt: new Date().toISOString() });
      setQueue(queue);
      setEntries((prev) => [{ id: `offline-${Date.now()}`, ...payload }, ...prev]);
      resetEntryForm();
      alert("İnternet yok. Kayıt cihazda tutuldu; bağlantı gelince gönderilecek.");
      return;
    }

    const { error } = await supabase.from("entries").insert(payload);
    if (error) {
      alert("Mesai kaydı eklenemedi: " + error.message);
      return;
    }

    if (user.role === "admin" && targetUser.id !== user.id) {
      await addLog(`${user.name}, ${targetUser.name} adına mesai kaydı ekledi`);
    } else {
      await addLog(`${targetUser.name} mesai kaydı ekledi`);
    }

    resetEntryForm();
    await loadAll();
    alert("Mesai kaydedildi.");
  };

  const startEditEntry = (entry) => {
    setEditingEntryId(entry.id);
    setEntryUserId(entry.user_id || "");
    setForm({
      date: entry.date || "",
      start: entry.start || "",
      end: entry.end || "",
      description: entry.description || "",
      work_type: entry.work_type || "hafta_ici",
    });
    setActiveTab("entry");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDeleteEntry = async (entry) => {
    const ok = window.confirm(`${entry.date} tarihli mesai kaydı silinsin mi? Bu işlem geri alınamaz.`);
    if (!ok) return;

    const { error } = await supabase.from("entries").delete().eq("id", entry.id);
    if (error) {
      alert("Mesai kaydı silinemedi: " + error.message);
      return;
    }

    if (editingEntryId === entry.id) resetEntryForm();
    await addLog(`${user.name}, ${entry.user_name} için mesai kaydını sildi`);
    await loadAll();
    alert("Mesai kaydı silindi.");
  };

  const months = [...new Set(entries.map((x) => x.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const years = [...new Set(entries.map((x) => x.date?.slice(0, 4)).filter(Boolean))].sort().reverse();
  const departments = [...new Set(users.map((u) => u.department).filter(Boolean))].sort();

  useEffect(() => {
    const currentMonth = getCurrentMonthKey();
    if (!adminStatsMonth) {
      setAdminStatsMonth(months.includes(currentMonth) ? currentMonth : months[0] || "");
    }
    if (!adminFilterMonth) {
      setAdminFilterMonth(months.includes(currentMonth) ? currentMonth : months[0] || "");
    }
    if (!adminFilterYear) {
      const y = (months.includes(currentMonth) ? currentMonth : months[0] || "").slice(0, 4);
      setAdminFilterYear(y);
    }
  }, [months, adminStatsMonth, adminFilterMonth, adminFilterYear]);

  useEffect(() => {
    const currentMonth = getCurrentMonthKey();
    if (!personalStatsMonth) {
      setPersonalStatsMonth(months.includes(currentMonth) ? currentMonth : months[0] || currentMonth);
    }
  }, [months, personalStatsMonth]);

  const visibleEntries = useMemo(() => {
    let data = user?.role === "admin" ? entries : entries.filter((x) => x.user_id === user?.id);

    if (user?.role === "admin" && selectedUser !== "all") {
      data = data.filter((x) => x.user_id === selectedUser);
    }
    if (reportMode === "monthly" && selectedMonth) {
      data = data.filter((x) => x.date?.startsWith(selectedMonth));
    }
    if (reportMode === "yearly" && selectedYear) {
      data = data.filter((x) => x.date?.startsWith(selectedYear));
    }
    return data;
  }, [entries, user, selectedUser, selectedMonth, selectedYear, reportMode]);

  const ownMonthlyEntries = useMemo(() => {
    if (!user || !personalStatsMonth) return [];
    return entries
      .filter((x) => x.user_id === user.id)
      .filter((x) => x.date?.startsWith(personalStatsMonth))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [entries, user, personalStatsMonth]);

  const personalMonthlyTotals = useMemo(() => {
    return ownMonthlyEntries.reduce(
      (acc, item) => {
        const mins = parseDurationToMinutes(item.duration);
        if (item.work_type === "hafta_sonu") acc.hafta_sonu += mins;
        else if (item.work_type === "resmi_tatil") acc.resmi_tatil += mins;
        else acc.hafta_ici += mins;
        acc.total += mins;
        acc.recordCount += 1;
        return acc;
      },
      { hafta_ici: 0, hafta_sonu: 0, resmi_tatil: 0, total: 0, recordCount: 0 }
    );
  }, [ownMonthlyEntries]);

  const personalBestDay = useMemo(() => {
    const map = {};
    ownMonthlyEntries.forEach((item) => {
      map[item.date] = (map[item.date] || 0) + parseDurationToMinutes(item.duration);
    });
    const best = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
    return best ? { date: best[0], minutes: best[1] } : null;
  }, [ownMonthlyEntries]);

  const personalDailyChartData = useMemo(() => {
    if (!personalStatsMonth) return [];
    const [year, month] = personalStatsMonth.split("-").map(Number);
    if (!year || !month) return [];

    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const dayKey = `${personalStatsMonth}-${day}`;
      const dayEntries = ownMonthlyEntries.filter((x) => x.date === dayKey);
      const totalMinutes = dayEntries.reduce(
        (sum, item) => sum + parseDurationToMinutes(item.duration),
        0
      );

      return {
        day: String(index + 1),
        label: dayKey,
        minutes: totalMinutes,
        durationText: minutesToText(totalMinutes),
      };
    });
  }, [personalStatsMonth, ownMonthlyEntries]);

  const personalSixMonthTrend = useMemo(() => {
    const baseMonth = personalStatsMonth || getCurrentMonthKey();
    const [y, m] = baseMonth.split("-").map(Number);
    const list = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(y, m - 1 - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthEntries = entries.filter((e) => e.user_id === user?.id && e.date?.startsWith(monthKey));
      const minutes = monthEntries.reduce((s, x) => s + parseDurationToMinutes(x.duration), 0);
      const monthName = new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(d);
      list.push({
        monthKey,
        shortLabel: monthName.slice(0, 3),
        minutes,
      });
    }
    return list;
  }, [entries, user, personalStatsMonth]);

  const adminBaseEntries = useMemo(() => {
    let data = [...entries];

    if (adminFilterYear) {
      data = data.filter((x) => x.date?.startsWith(adminFilterYear));
    }
    if (adminFilterMonth) {
      data = data.filter((x) => x.date?.startsWith(adminFilterMonth));
    }
    if (adminFilterUser !== "all") {
      data = data.filter((x) => x.user_id === adminFilterUser);
    }
    if (adminFilterDepartment !== "all") {
      const deptUsers = users.filter((u) => u.department === adminFilterDepartment).map((u) => u.id);
      data = data.filter((x) => deptUsers.includes(x.user_id));
    }
    if (adminFilterWorkType !== "all") {
      data = data.filter((x) => x.work_type === adminFilterWorkType);
    }
    return data;
  }, [
    entries,
    users,
    adminFilterYear,
    adminFilterMonth,
    adminFilterUser,
    adminFilterDepartment,
    adminFilterWorkType,
  ]);

  const adminMonthlyStats = useMemo(() => {
    if (user?.role !== "admin") return [];

    const baseUsers =
      adminFilterUser !== "all"
        ? users.filter((u) => u.id === adminFilterUser)
        : adminFilterDepartment !== "all"
        ? users.filter((u) => u.department === adminFilterDepartment && u.role !== "admin")
        : users.filter((u) => u.role !== "admin");

    const result = baseUsers.map((u) => {
      const userEntries = adminBaseEntries.filter((x) => x.user_id === u.id);
      const totals = userEntries.reduce(
        (acc, item) => {
          const mins = parseDurationToMinutes(item.duration);
          if (item.work_type === "hafta_sonu") acc.hafta_sonu += mins;
          else if (item.work_type === "resmi_tatil") acc.resmi_tatil += mins;
          else acc.hafta_ici += mins;
          acc.total += mins;
          acc.recordCount += 1;
          return acc;
        },
        { hafta_ici: 0, hafta_sonu: 0, resmi_tatil: 0, total: 0, recordCount: 0 }
      );

      return {
        userId: u.id,
        name: u.name,
        department: u.department,
        recordCount: totals.recordCount,
        hafta_ici: totals.hafta_ici,
        hafta_sonu: totals.hafta_sonu,
        resmi_tatil: totals.resmi_tatil,
        minutes: totals.total,
        durationText: minutesToText(totals.total),
      };
    });

    return result.sort((a, b) => b.minutes - a.minutes);
  }, [user, users, adminBaseEntries, adminFilterUser, adminFilterDepartment]);

  const adminStatsTotals = useMemo(() => {
    return adminMonthlyStats.reduce(
      (acc, item) => {
        acc.totalMinutes += item.minutes;
        acc.totalRecords += item.recordCount;
        if (item.minutes > 0) acc.activeUsers += 1;
        return acc;
      },
      { totalMinutes: 0, totalRecords: 0, activeUsers: 0 }
    );
  }, [adminMonthlyStats]);

  const previousMonthStatsTotals = useMemo(() => {
    const prevMonth = getPreviousMonthKey(adminFilterMonth || adminStatsMonth || getCurrentMonthKey());
    if (!prevMonth) return { totalMinutes: 0, totalRecords: 0, activeUsers: 0 };

    let data = entries.filter((x) => x.date?.startsWith(prevMonth));

    if (adminFilterUser !== "all") {
      data = data.filter((x) => x.user_id === adminFilterUser);
    }
    if (adminFilterDepartment !== "all") {
      const deptUsers = users.filter((u) => u.department === adminFilterDepartment).map((u) => u.id);
      data = data.filter((x) => deptUsers.includes(x.user_id));
    }
    if (adminFilterWorkType !== "all") {
      data = data.filter((x) => x.work_type === adminFilterWorkType);
    }

    const totals = data.reduce(
      (acc, item) => {
        acc.totalMinutes += parseDurationToMinutes(item.duration);
        acc.totalRecords += 1;
        acc.userSet.add(item.user_id);
        return acc;
      },
      { totalMinutes: 0, totalRecords: 0, userSet: new Set() }
    );

    return {
      totalMinutes: totals.totalMinutes,
      totalRecords: totals.totalRecords,
      activeUsers: totals.userSet.size,
    };
  }, [entries, users, adminFilterMonth, adminStatsMonth, adminFilterUser, adminFilterDepartment, adminFilterWorkType]);

  const adminKpi = useMemo(() => {
    const avgRecordMinutes = adminStatsTotals.totalRecords
      ? Math.round(adminStatsTotals.totalMinutes / adminStatsTotals.totalRecords)
      : 0;

    const dayMap = {};
    adminBaseEntries.forEach((e) => {
      dayMap[e.date] = (dayMap[e.date] || 0) + parseDurationToMinutes(e.duration);
    });
    const bestDay = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];

    return {
      totalMinutes: adminStatsTotals.totalMinutes,
      totalRecords: adminStatsTotals.totalRecords,
      activeUsers: adminStatsTotals.activeUsers,
      avgRecordMinutes,
      bestDay,
      monthChange: percentageChange(
        adminStatsTotals.totalMinutes,
        previousMonthStatsTotals.totalMinutes
      ),
    };
  }, [adminStatsTotals, adminBaseEntries, previousMonthStatsTotals]);

  const adminChartData = useMemo(() => adminMonthlyStats.slice(0, 8), [adminMonthlyStats]);
  const adminPieData = useMemo(() => adminMonthlyStats, [adminMonthlyStats]);

  const adminDeptData = useMemo(() => {
    const map = {};
    adminBaseEntries.forEach((e) => {
      const u = users.find((x) => x.id === e.user_id);
      const dept = u?.department || "Birim Yok";
      if (!map[dept]) map[dept] = { department: dept, minutes: 0, recordCount: 0 };
      map[dept].minutes += parseDurationToMinutes(e.duration);
      map[dept].recordCount += 1;
    });
    return Object.values(map).sort((a, b) => b.minutes - a.minutes);
  }, [adminBaseEntries, users]);

  const adminWeekdayHeatmap = useMemo(() => {
    const labels = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
    const values = Array.from({ length: 7 }, (_, i) => ({
      label: labels[i],
      minutes: 0,
    }));

    adminBaseEntries.forEach((e) => {
      const d = new Date(e.date);
      const jsDay = d.getDay();
      const idx = jsDay === 0 ? 6 : jsDay - 1;
      values[idx].minutes += parseDurationToMinutes(e.duration);
    });

    return values;
  }, [adminBaseEntries]);

  const adminSixMonthTrend = useMemo(() => {
    const baseMonth = adminFilterMonth || adminStatsMonth || getCurrentMonthKey();
    const [y, m] = baseMonth.split("-").map(Number);
    const list = [];

    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(y, m - 1 - i, 1);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      let monthEntries = entries.filter((e) => e.date?.startsWith(monthKey));

      if (adminFilterUser !== "all") {
        monthEntries = monthEntries.filter((e) => e.user_id === adminFilterUser);
      }
      if (adminFilterDepartment !== "all") {
        const deptUsers = users.filter((u) => u.department === adminFilterDepartment).map((u) => u.id);
        monthEntries = monthEntries.filter((e) => deptUsers.includes(e.user_id));
      }
      if (adminFilterWorkType !== "all") {
        monthEntries = monthEntries.filter((e) => e.work_type === adminFilterWorkType);
      }

      const minutes = monthEntries.reduce((s, x) => s + parseDurationToMinutes(x.duration), 0);
      const monthName = new Intl.DateTimeFormat("tr-TR", { month: "short" }).format(d);

      list.push({
        monthKey,
        shortLabel: monthName.slice(0, 3),
        minutes,
      });
    }

    return list;
  }, [
    entries,
    users,
    adminFilterMonth,
    adminStatsMonth,
    adminFilterUser,
    adminFilterDepartment,
    adminFilterWorkType,
  ]);

  const yearlyTrendData = useMemo(() => {
    if (reportMode !== "yearly" || !selectedYear || !user) return [];

    const monthLabels = [
      { key: "01", label: "Ocak", shortLabel: "Oca" },
      { key: "02", label: "Şubat", shortLabel: "Şub" },
      { key: "03", label: "Mart", shortLabel: "Mar" },
      { key: "04", label: "Nisan", shortLabel: "Nis" },
      { key: "05", label: "Mayıs", shortLabel: "May" },
      { key: "06", label: "Haziran", shortLabel: "Haz" },
      { key: "07", label: "Temmuz", shortLabel: "Tem" },
      { key: "08", label: "Ağustos", shortLabel: "Ağu" },
      { key: "09", label: "Eylül", shortLabel: "Eyl" },
      { key: "10", label: "Ekim", shortLabel: "Eki" },
      { key: "11", label: "Kasım", shortLabel: "Kas" },
      { key: "12", label: "Aralık", shortLabel: "Ara" },
    ];

    return monthLabels.map((month) => {
      const monthKey = `${selectedYear}-${month.key}`;
      const monthEntries = visibleEntries.filter((x) => x.date?.startsWith(monthKey));
      const totalMinutes = monthEntries.reduce(
        (sum, item) => sum + parseDurationToMinutes(item.duration),
        0
      );

      return {
        monthKey,
        label: month.label,
        shortLabel: month.shortLabel,
        minutes: totalMinutes,
        durationText: minutesToText(totalMinutes),
      };
    });
  }, [visibleEntries, reportMode, selectedYear, user]);

  const totalsByType = visibleEntries.reduce(
    (acc, item) => {
      const mins = parseDurationToMinutes(item.duration);
      if (item.work_type === "hafta_sonu") acc.hafta_sonu += mins;
      else if (item.work_type === "resmi_tatil") acc.resmi_tatil += mins;
      else acc.hafta_ici += mins;
      acc.genel += mins;
      return acc;
    },
    { hafta_ici: 0, hafta_sonu: 0, resmi_tatil: 0, genel: 0 }
  );

  const exportPDF = async () => {
    if (reportMode === "monthly" && !selectedMonth) {
      alert("Lütfen ay seçin.");
      return;
    }
    if (reportMode === "yearly" && !selectedYear) {
      alert("Lütfen yıl seçin.");
      return;
    }

    try {
      const pdfMakeModule = await import("pdfmake/build/pdfmake");
      const pdfFontsModule = await import("pdfmake/build/vfs_fonts");
      const pdfMake = pdfMakeModule.default || pdfMakeModule;
      const fontContainer = pdfFontsModule.default || pdfFontsModule;

      if (typeof pdfMake.addVirtualFileSystem === "function") {
        pdfMake.addVirtualFileSystem(fontContainer);
      } else if (fontContainer?.pdfMake?.vfs) {
        pdfMake.vfs = fontContainer.pdfMake.vfs;
      } else if (fontContainer?.vfs) {
        pdfMake.vfs = fontContainer.vfs;
      } else if (fontContainer && typeof fontContainer === "object") {
        pdfMake.vfs = fontContainer;
      }

      let logoDataUrl = "";
      try {
        const response = await fetch("/logo.png");
        if (response.ok) {
          const blob = await response.blob();
          logoDataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        }
      } catch (err) {
        console.warn("Logo yüklenemedi", err);
      }

      const filteredUserName =
        user?.role === "admin"
          ? selectedUser === "all"
            ? "Tüm kullanıcılar"
            : users.find((u) => u.id === selectedUser)?.name || "Seçili kullanıcı"
          : user?.name;

      const periodLabel =
        reportMode === "monthly" ? formatMonth(selectedMonth) : `${selectedYear} YILI`;

      const safeUserName = (filteredUserName || "rapor")
        .replace(/\s+/g, "_")
        .replace(/[^\p{L}\p{N}_-]/gu, "");

      const safePeriod =
        reportMode === "monthly"
          ? (selectedMonth || "donem").replace(/\s+/g, "_")
          : (selectedYear || "yil").replace(/\s+/g, "_");

      const body = [
        ["No", "Tarih", "Başl.", "Bitiş", "Süre", "Mesai Türü", "Açıklama", "Kişi"].map((x) => ({
          text: x,
          style: "tableHeader",
        })),
        ...visibleEntries.map((x, i) => [
          { text: String(i + 1), alignment: "center" },
          x.date || "",
          { text: x.start || "", alignment: "center" },
          { text: x.end || "", alignment: "center" },
          { text: x.duration || "", alignment: "center" },
          workTypeLabel(x.work_type),
          x.description || "",
          x.user_name || "",
        ]),
      ];

      const docDefinition = {
        pageSize: "A4",
        pageOrientation: "landscape",
        pageMargins: [24, 72, 24, 96],
        header: () => ({
          margin: [24, 18, 24, 8],
          columns: [
            {
              width: "*",
              columns: [
                ...(logoDataUrl
                  ? [{ width: 42, image: "logo", fit: [32, 32], margin: [0, 0, 8, 0] }]
                  : []),
                {
                  width: "*",
                  stack: [
                    { text: "Yalova Ticaret ve Sanayi Odası", style: "orgTitle" },
                    {
                      text: filteredUserName ? `Personel: ${filteredUserName}` : "",
                      style: "subInfo",
                    },
                  ],
                },
              ],
            },
            {
              width: 240,
              stack: [
                {
                  text: "FAZLA ÇALIŞMA TAKİP RAPORU",
                  style: "reportTitle",
                  alignment: "right",
                },
                { text: periodLabel, style: "subTitle", alignment: "right" },
                { text: `Tarih: ${formatToday()}`, style: "subInfo", alignment: "right" },
              ],
            },
          ],
        }),
        footer: (currentPage, pageCount) => ({
          margin: [24, 6, 24, 12],
          stack: [
            {
              canvas: [
                {
                  type: "line",
                  x1: 0,
                  y1: 0,
                  x2: 760,
                  y2: 0,
                  lineWidth: 0.6,
                  lineColor: "#cbd5e1",
                },
              ],
              margin: [0, 0, 0, 6],
            },
            {
              columns: [
                {
                  width: "*",
                  columns: [
                    {
                      width: "33%",
                      stack: [
                        { text: "________________________", alignment: "center" },
                        { text: filteredUserName || "", style: "signName", alignment: "center" },
                        { text: "Mesaiyi Yapan", style: "signRole", alignment: "center" },
                      ],
                    },
                    {
                      width: "33%",
                      stack: [
                        { text: "________________________", alignment: "center" },
                        {
                          text: settings.signature2_name || "",
                          style: "signName",
                          alignment: "center",
                        },
                        { text: "Genel Sekreter", style: "signRole", alignment: "center" },
                      ],
                    },
                    {
                      width: "34%",
                      stack: [
                        { text: "________________________", alignment: "center" },
                        {
                          text: settings.signature3_name || "",
                          style: "signName",
                          alignment: "center",
                        },
                        {
                          text: "Yönetim Kurulu Başkanı",
                          style: "signRole",
                          alignment: "center",
                        },
                      ],
                    },
                  ],
                },
                {
                  width: 210,
                  stack: [
                    {
                      text: `Hafta İçi Toplamı: ${minutesToText(totalsByType.hafta_ici)}`,
                      style: "totalLite",
                      alignment: "right",
                    },
                    {
                      text: `Hafta Sonu Toplamı: ${minutesToText(totalsByType.hafta_sonu)}`,
                      style: "totalLite",
                      alignment: "right",
                    },
                    {
                      text: `Resmi Tatil Toplamı: ${minutesToText(totalsByType.resmi_tatil)}`,
                      style: "totalLite",
                      alignment: "right",
                    },
                    {
                      text: `Genel Toplam: ${minutesToText(totalsByType.genel)}`,
                      style: "totalBold",
                      alignment: "right",
                      margin: [0, 2, 0, 0],
                    },
                    {
                      text: `Sayfa ${currentPage} / ${pageCount}`,
                      style: "pageNo",
                      alignment: "right",
                      margin: [0, 6, 0, 0],
                    },
                  ],
                },
              ],
            },
          ],
        }),
        background: () => ({
          text: "YTSO",
          color: "#94a3b8",
          opacity: 0.08,
          bold: true,
          fontSize: 72,
          angle: -30,
          absolutePosition: { x: 315, y: 180 },
        }),
        content: [
          {
            table: {
              headerRows: 1,
              widths: [20, 52, 38, 38, 38, 62, "*", 62],
              body,
            },
            layout: {
              fillColor: (rowIndex) =>
                rowIndex === 0 ? "#f1f5f9" : rowIndex % 2 === 0 ? "#fafcff" : null,
              hLineColor: () => "#cbd5e1",
              vLineColor: () => "#cbd5e1",
              hLineWidth: () => 0.5,
              vLineWidth: () => 0.5,
              paddingLeft: () => 4,
              paddingRight: () => 4,
              paddingTop: () => 3,
              paddingBottom: () => 3,
            },
          },
        ],
        styles: {
          orgTitle: { fontSize: 11, bold: true, color: "#0f172a" },
          reportTitle: { fontSize: 14, bold: true, color: "#0f172a" },
          subTitle: { fontSize: 10, color: "#334155" },
          subInfo: { fontSize: 9, color: "#64748b" },
          tableHeader: {
            bold: true,
            fontSize: 8.5,
            color: "#0f172a",
            alignment: "center",
          },
          signName: {
            fontSize: 8.5,
            bold: true,
            color: "#0f172a",
            margin: [0, 4, 0, 0],
          },
          signRole: { fontSize: 8, color: "#64748b", margin: [0, 2, 0, 0] },
          totalLite: { fontSize: 8, color: "#475569" },
          totalBold: { fontSize: 9, bold: true, color: "#0f172a" },
          pageNo: { fontSize: 8, color: "#64748b" },
        },
        defaultStyle: { font: "Roboto", fontSize: 8, color: "#0f172a" },
        images: logoDataUrl ? { logo: logoDataUrl } : {},
      };

      pdfMake.createPdf(docDefinition).download(`${safeUserName}-${safePeriod}-mesai-raporu.pdf`);
    } catch (error) {
      console.error("PDF oluşturma hatası:", error);
      alert("PDF oluşturulurken hata oluştu. F12 > Console ekranını kontrol edin.");
    }
  };

  if (!user) {
    return (
      <AppShell mobile={mobile}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <Card style={{ padding: mobile ? 18 : 26 }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                marginBottom: 18,
              }}
            >
              <img
                src="/logo.png"
                alt="YTSO Logo"
                style={{ height: mobile ? 56 : 72, objectFit: "contain" }}
              />
              <div
                style={{
                  fontSize: mobile ? 24 : 28,
                  fontWeight: 900,
                  textAlign: "center",
                  lineHeight: 1.15,
                  letterSpacing: "-0.03em",
                }}
              >
                YTSO MESAİ GİRİŞ SİSTEMİ
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, textAlign: "center" }}>
                Mobil ve masaüstü uyumlu kurumsal mesai yönetimi
              </div>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Kullanıcı Adı">
                <TextInput
                  placeholder="Kullanıcı adı"
                  value={login.name}
                  onChange={(e) => setLogin((p) => ({ ...p, name: e.target.value }))}
                />
              </Field>

              <Field label="Şifre">
                <TextInput
                  type="password"
                  placeholder="Şifre"
                  value={login.password}
                  onChange={(e) => setLogin((p) => ({ ...p, password: e.target.value }))}
                />
              </Field>

              <PrimaryButton full active onClick={loginUser}>
                Giriş Yap
              </PrimaryButton>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell mobile={mobile}>
      <div style={{ display: "grid", gap: 16 }}>
        <Card style={{ padding: mobile ? 14 : 18 }}>
          <div
            style={{
              display: "flex",
              flexDirection: mobile ? "column" : "row",
              alignItems: mobile ? "stretch" : "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: mobile ? 24 : 28,
                  fontWeight: 900,
                  letterSpacing: "-0.03em",
                }}
              >
                {user.name}
              </div>
              <div style={{ fontSize: 13, color: COLORS.muted, marginTop: 4 }}>
                {user.department || "-"} · {user.role}
              </div>
              {!online && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: "#b45309",
                    fontWeight: 800,
                  }}
                >
                  Çevrimdışı mod aktif
                </div>
              )}
              {syncing && (
                <div
                  style={{
                    marginTop: 8,
                    fontSize: 12,
                    color: COLORS.blue,
                    fontWeight: 800,
                  }}
                >
                  Senkronizasyon yapılıyor…
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!mobile && <PrimaryButton onClick={exportPDF}>PDF Al</PrimaryButton>}
              <PrimaryButton onClick={logout}>Çıkış</PrimaryButton>
            </div>
          </div>
        </Card>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : tablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <StatPill label="Hafta İçi" value={minutesToText(totalsByType.hafta_ici)} color={COLORS.blue} />
          <StatPill label="Hafta Sonu" value={minutesToText(totalsByType.hafta_sonu)} color={COLORS.teal} />
          <StatPill label="Resmi Tatil" value={minutesToText(totalsByType.resmi_tatil)} color={COLORS.violet} />
          <StatPill label="Genel Toplam" value={minutesToText(totalsByType.genel)} strong />
        </div>

        <Card style={{ padding: mobile ? 14 : 20 }}>
          <SectionTitle
            title="Kişisel Aylık Dashboard"
            subtitle="İçinde bulunduğunuz ay varsayılan gelir. Kendi mesai durumunuzu grafiklerle takip edebilirsiniz."
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "220px 1fr",
              gap: 12,
              alignItems: "end",
              marginBottom: 14,
            }}
          >
            <Field label="Ay Seçimi">
              <SelectInput
                value={personalStatsMonth}
                onChange={(e) => setPersonalStatsMonth(e.target.value)}
              >
                <option value="">Ay seçin</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {formatMonth(m)}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              <StatPill label="Toplam Kayıt" value={String(personalMonthlyTotals.recordCount)} />
              <StatPill label="Hafta İçi" value={minutesToShortText(personalMonthlyTotals.hafta_ici)} color={COLORS.blue} />
              <StatPill label="Hafta Sonu" value={minutesToShortText(personalMonthlyTotals.hafta_sonu)} color={COLORS.teal} />
              <StatPill
                label="En Yoğun Gün"
                value={personalBestDay ? personalBestDay.date.slice(8, 10) : "-"}
                sub={personalBestDay ? minutesToShortText(personalBestDay.minutes) : ""}
                strong
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobile ? "1fr" : "1.15fr 0.85fr",
              gap: 14,
            }}
          >
            <MonthlyPersonalChart data={personalDailyChartData} mobile={mobile} />
            <TypeBreakdownChart
              haftaIci={personalMonthlyTotals.hafta_ici}
              haftaSonu={personalMonthlyTotals.hafta_sonu}
              resmiTatil={personalMonthlyTotals.resmi_tatil}
              mobile={mobile}
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <MiniSixMonthTrend
              data={personalSixMonthTrend}
              title="Son 6 Ay Trendi"
              subtitle="Kendi mesai geçmişinizin kısa görünümü"
            />
          </div>
        </Card>

        <Card style={{ padding: mobile ? 14 : 18 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: mobile
                ? "1fr"
                : tablet
                ? "1fr 1fr"
                : user.role === "admin"
                ? "1fr 1fr 1fr auto"
                : "1fr 1fr auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <Field label="Rapor Türü">
              <SelectInput value={reportMode} onChange={(e) => setReportMode(e.target.value)}>
                <option value="monthly">Aylık Rapor</option>
                <option value="yearly">Yıllık Rapor</option>
              </SelectInput>
            </Field>

            {user.role === "admin" && (
              <Field label="Rapor Kullanıcısı">
                <SelectInput value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                  <option value="all">Tüm kullanıcılar</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            {reportMode === "monthly" ? (
              <Field label="Ay">
                <SelectInput value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                  <option value="">Ay seçin</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {formatMonth(m)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            ) : (
              <Field label="Yıl">
                <SelectInput value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                  <option value="">Yıl seçin</option>
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            {!mobile && <PrimaryButton onClick={exportPDF}>PDF Al</PrimaryButton>}
          </div>
        </Card>

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {["entry", "report", "records", "security", ...(user.role === "admin" ? ["admin"] : [])].map(
            (tab) => (
              <PrimaryButton
                key={tab}
                active={activeTab === tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab === "entry"
                  ? "Mesai Girişi"
                  : tab === "report"
                  ? "Rapor"
                  : tab === "records"
                  ? "Kayıtlar"
                  : tab === "security"
                  ? "Güvenlik"
                  : "Yönetim Paneli"}
              </PrimaryButton>
            )
          )}
        </div>

        {activeTab === "entry" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle
              title={editingEntryId ? "Mesai Kaydını Düzenle" : "Yeni Mesai Kaydı"}
              subtitle="Telefon, tablet ve masaüstünde hızlı veri girişi için optimize edildi."
            />
            <form onSubmit={submitEntry}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mobile
                    ? "1fr"
                    : tablet
                    ? "1fr 1fr"
                    : user.role === "admin"
                    ? "repeat(5, minmax(0, 1fr))"
                    : "repeat(4, minmax(0, 1fr))",
                  gap: 12,
                  marginBottom: 12,
                }}
              >
                {user.role === "admin" && (
                  <Field label="Kayıt Girilecek Kullanıcı">
                    <SelectInput value={entryUserId} onChange={(e) => setEntryUserId(e.target.value)}>
                      <option value="">Kullanıcı seçin</option>
                      {users
                        .filter((u) => u.role !== "admin")
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                    </SelectInput>
                  </Field>
                )}

                <Field label="Tarih">
                  <TextInput
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        date: e.target.value,
                        work_type: getDefaultWorkTypeByDate(e.target.value),
                      }))
                    }
                  />
                </Field>

                <Field label="Başlangıç Saati">
                  <TextInput
                    type="time"
                    value={form.start}
                    onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))}
                  />
                </Field>

                <Field label="Bitiş Saati">
                  <TextInput
                    type="time"
                    value={form.end}
                    onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))}
                  />
                </Field>

                <Field label="Mesai Türü">
                  <SelectInput
                    value={form.work_type}
                    onChange={(e) => setForm((p) => ({ ...p, work_type: e.target.value }))}
                  >
                    <option value="hafta_ici">Hafta İçi</option>
                    <option value="hafta_sonu">Hafta Sonu</option>
                    <option value="resmi_tatil">Resmi Tatil</option>
                  </SelectInput>
                </Field>
              </div>

              <Field label="Açıklama">
                <TextArea
                  placeholder="Yapılan iş açıklaması"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </Field>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  justifyContent: mobile ? "stretch" : "flex-start",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <PrimaryButton type="submit" full={mobile} success>
                  {editingEntryId ? "Güncellemeyi Kaydet" : "Kaydet"}
                </PrimaryButton>
                {editingEntryId && (
                  <PrimaryButton type="button" onClick={resetEntryForm} full={mobile}>
                    İptal
                  </PrimaryButton>
                )}
              </div>
            </form>
          </Card>
        )}

        {activeTab === "report" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle
              title="Rapor Önizleme"
              subtitle={reportMode === "monthly" ? "Aylık görünüm" : "Yıllık görünüm"}
            />
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 940 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 14,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src="/logo.png" alt="logo" style={{ height: 40 }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>Yalova Ticaret ve Sanayi Odası</div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>
                        FAZLA ÇALIŞMA TAKİP RAPORU
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>
                      {reportMode === "monthly"
                        ? formatMonth(selectedMonth)
                        : `${selectedYear || ""} YILI`}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted }}>
                      Tarih: {formatToday()}
                    </div>
                  </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      {["No", "Tarih", "Başlangıç", "Bitiş", "Süre", "Mesai Türü", "Açıklama", "Kişi"].map(
                        (head) => (
                          <th
                            key={head}
                            style={{
                              border: "1px solid #cbd5e1",
                              padding: 8,
                              textAlign: "left",
                            }}
                          >
                            {head}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleEntries.map((row, index) => (
                      <tr key={row.id} style={{ background: index % 2 === 0 ? "#fff" : "#fafcff" }}>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{index + 1}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.date}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.start}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.end}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.duration}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>
                          {workTypeLabel(row.work_type)}
                        </td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.description}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.user_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {reportMode === "yearly" && (
                  <YearlyTrendChart
                    data={yearlyTrendData}
                    selectedYear={selectedYear}
                    mobile={mobile}
                    currentUserName={
                      user.role === "admin"
                        ? selectedUser === "all"
                          ? "Tüm kullanıcılar"
                          : users.find((u) => u.id === selectedUser)?.name || "Seçili kullanıcı"
                        : user.name
                    }
                  />
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === "records" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle
              title="Kayıtlar"
              subtitle="Mobilde kart görünümü, masaüstünde hızlı tarama."
            />
            <div style={{ display: "grid", gap: 10 }}>
              {visibleEntries.map((item) => (
                <EntryCard
                  key={item.id}
                  item={item}
                  mobile={mobile}
                  canEdit
                  canDelete
                  onEdit={startEditEntry}
                  onDelete={handleDeleteEntry}
                />
              ))}
            </div>
          </Card>
        )}

        {activeTab === "security" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle
              title="Güvenlik"
              subtitle="Şifre değiştirme ve hesap güvenliği."
            />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0, 1fr))",
                gap: 12,
                marginBottom: 12,
              }}
            >
              <Field label="Eski Şifre">
                <TextInput
                  type="password"
                  placeholder="Eski şifre"
                  value={passwordForm.oldPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, oldPassword: e.target.value }))
                  }
                />
              </Field>

              <Field label="Yeni Şifre">
                <TextInput
                  type="password"
                  placeholder="Yeni şifre"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))
                  }
                />
              </Field>

              <Field label="Yeni Şifre Tekrar">
                <TextInput
                  type="password"
                  placeholder="Yeni şifre tekrar"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))
                  }
                />
              </Field>
            </div>
            <PrimaryButton onClick={changePassword} full={mobile}>
              Şifreyi Güncelle
            </PrimaryButton>
          </Card>
        )}

        {user.role === "admin" && activeTab === "admin" && (
          <div style={{ display: "grid", gap: 16 }}>
            <Card style={{ padding: mobile ? 14 : 20 }}>
              <SectionTitle
                title="Yönetim Dashboard"
                subtitle="Kapsamlı yönetim görünümü: KPI, filtreler, trendler ve detay analizleri."
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mobile ? "1fr" : tablet ? "repeat(2, 1fr)" : "repeat(5, minmax(0, 1fr))",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <StatPill
                  label="Toplam Mesai"
                  value={minutesToText(adminKpi.totalMinutes)}
                  strong
                />
                <StatPill
                  label="Aylık Değişim"
                  value={adminKpi.monthChange}
                  color={
                    adminKpi.monthChange.startsWith("+")
                      ? COLORS.emerald
                      : adminKpi.monthChange.startsWith("-")
                      ? COLORS.rose
                      : COLORS.slate
                  }
                  sub={`Önceki dönem: ${minutesToText(previousMonthStatsTotals.totalMinutes)}`}
                />
                <StatPill
                  label="Aktif Kullanıcı"
                  value={String(adminKpi.activeUsers)}
                  color={COLORS.blue}
                />
                <StatPill
                  label="Ort. Kayıt Süresi"
                  value={minutesToShortText(adminKpi.avgRecordMinutes)}
                  color={COLORS.teal}
                />
                <StatPill
                  label="En Yoğun Gün"
                  value={adminKpi.bestDay ? adminKpi.bestDay[0] : "-"}
                  sub={adminKpi.bestDay ? minutesToShortText(adminKpi.bestDay[1]) : ""}
                  color={COLORS.violet}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: mobile ? "1fr" : "repeat(6, minmax(0, 1fr))",
                  gap: 10,
                }}
              >
                <Field label="Yıl">
                  <SelectInput value={adminFilterYear} onChange={(e) => setAdminFilterYear(e.target.value)}>
                    <option value="">Tüm yıllar</option>
                    {years.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Ay">
                  <SelectInput value={adminFilterMonth} onChange={(e) => setAdminFilterMonth(e.target.value)}>
                    <option value="">Tüm aylar</option>
                    {months
                      .filter((m) => !adminFilterYear || m.startsWith(adminFilterYear))
                      .map((m) => (
                        <option key={m} value={m}>
                          {formatMonth(m)}
                        </option>
                      ))}
                  </SelectInput>
                </Field>

                <Field label="Kullanıcı">
                  <SelectInput value={adminFilterUser} onChange={(e) => setAdminFilterUser(e.target.value)}>
                    <option value="all">Tüm kullanıcılar</option>
                    {users
                      .filter((u) => u.role !== "admin")
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </SelectInput>
                </Field>

                <Field label="Birim">
                  <SelectInput
                    value={adminFilterDepartment}
                    onChange={(e) => setAdminFilterDepartment(e.target.value)}
                  >
                    <option value="all">Tüm birimler</option>
                    {departments.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </SelectInput>
                </Field>

                <Field label="Mesai Türü">
                  <SelectInput
                    value={adminFilterWorkType}
                    onChange={(e) => setAdminFilterWorkType(e.target.value)}
                  >
                    <option value="all">Tüm türler</option>
                    <option value="hafta_ici">Hafta İçi</option>
                    <option value="hafta_sonu">Hafta Sonu</option>
                    <option value="resmi_tatil">Resmi Tatil</option>
                  </SelectInput>
                </Field>

                <Field label="Ara">
                  <TextInput
                    placeholder="Kullanıcı / birim"
                    value={adminSearchTerm}
                    onChange={(e) => setAdminSearchTerm(e.target.value)}
                  />
                </Field>
              </div>
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr" : "1.15fr 0.85fr",
                gap: 16,
              }}
            >
              <EnhancedBarChart data={adminChartData} mobile={mobile} />
              <EnhancedDonutChart data={adminPieData} mobile={mobile} />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr" : "1fr 1fr",
                gap: 16,
              }}
            >
              <MiniSixMonthTrend
                data={adminSixMonthTrend}
                title="Son 6 Ay Trend"
                subtitle="Seçili filtrelere göre yakın dönem eğilimi"
              />
              <DepartmentBarChart data={adminDeptData} mobile={mobile} />
            </div>

            <WeekdayHeatmap weekdayData={adminWeekdayHeatmap} />

            <Card style={{ padding: mobile ? 14 : 20 }}>
              <SectionTitle
                title="Kullanıcı İstatistik Tablosu"
                subtitle="Sıralanabilir, aranabilir ve detay açılabilir tablo görünümü."
              />
              <EnhancedStatsTable
                data={adminMonthlyStats}
                mobile={mobile}
                onDrilldown={(u) => setDrilldownUser(u)}
                searchTerm={adminSearchTerm}
              />
            </Card>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: mobile ? "1fr" : tablet ? "1fr" : "1.1fr 0.9fr",
                gap: 16,
              }}
            >
              <Card style={{ padding: mobile ? 14 : 20 }}>
                <SectionTitle
                  title="Kullanıcı Yönetimi"
                  subtitle="Admin, personel ekleyebilir ve şifre güncelleyebilir."
                />

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: mobile ? "1fr" : "repeat(4, minmax(0, 1fr))",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <Field label="Kullanıcı Adı">
                    <TextInput
                      placeholder="Kullanıcı adı"
                      value={newUser.name}
                      onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                    />
                  </Field>

                  <Field label="Şifre">
                    <TextInput
                      placeholder="Şifre"
                      value={newUser.password}
                      onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                    />
                  </Field>

                  <Field label="Birim">
                    <TextInput
                      placeholder="Birim"
                      value={newUser.department}
                      onChange={(e) => setNewUser((p) => ({ ...p, department: e.target.value }))}
                    />
                  </Field>

                  <div style={{ display: "grid", alignItems: "end" }}>
                    <PrimaryButton onClick={addUser}>Kullanıcı Ekle</PrimaryButton>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  {users.map((u) => (
                    <div
                      key={u.id}
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: 18,
                        padding: 14,
                        display: "grid",
                        gap: 12,
                        background: COLORS.white,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          flexDirection: mobile ? "column" : "row",
                          alignItems: mobile ? "stretch" : "flex-start",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            textAlign: "left",
                            display: "grid",
                            justifyItems: "start",
                          }}
                        >
                          <div style={{ fontWeight: 800, width: "100%" }}>{u.name}</div>
                          <div
                            style={{
                              fontSize: 13,
                              color: COLORS.muted,
                              marginTop: 4,
                              width: "100%",
                            }}
                          >
                            {u.department} · {u.role}
                          </div>
                        </div>

                        {u.role !== "admin" ? (
                          <PrimaryButton danger onClick={() => deleteUser(u.id, u.name)} full={mobile}>
                            Sil
                          </PrimaryButton>
                        ) : null}
                      </div>

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: mobile ? "1fr" : "1fr auto",
                          gap: 10,
                          alignItems: "end",
                        }}
                      >
                        <Field label={`${u.name} için yeni şifre`}>
                          <TextInput
                            type="password"
                            placeholder="En az 6 karakter"
                            value={adminPasswordMap[u.id] || ""}
                            onChange={(e) =>
                              setAdminPasswordMap((prev) => ({
                                ...prev,
                                [u.id]: e.target.value,
                              }))
                            }
                          />
                        </Field>

                        <PrimaryButton onClick={() => adminUpdateUserPassword(u)} full={mobile}>
                          Şifre Güncelle
                        </PrimaryButton>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div style={{ display: "grid", gap: 16 }}>
                <Card style={{ padding: mobile ? 14 : 20 }}>
                  <SectionTitle
                    title="İmzacı Ayarları"
                    subtitle="PDF raporlarında kullanılır."
                  />
                  <div style={{ display: "grid", gap: 10 }}>
                    <Field label="Genel Sekreter">
                      <TextInput
                        placeholder="Genel Sekreter"
                        value={settings.signature2_name || ""}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            signature2_name: e.target.value,
                          }))
                        }
                      />
                    </Field>

                    <Field label="Yönetim Kurulu Başkanı">
                      <TextInput
                        placeholder="Yönetim Kurulu Başkanı"
                        value={settings.signature3_name || ""}
                        onChange={(e) =>
                          setSettings((p) => ({
                            ...p,
                            signature3_name: e.target.value,
                          }))
                        }
                      />
                    </Field>

                    <PrimaryButton onClick={saveSettings} full={mobile}>
                      Kaydet
                    </PrimaryButton>
                  </div>
                </Card>

                <Card style={{ padding: mobile ? 14 : 20 }}>
                  <SectionTitle
                    title="İşlem Logları"
                    subtitle="En güncel işlemler üstte görünür."
                  />
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      maxHeight: mobile ? undefined : 420,
                      overflow: "auto",
                    }}
                  >
                    {logs.map((l) => (
                      <div
                        key={l.id}
                        style={{ borderBottom: `1px solid ${COLORS.border}`, paddingBottom: 8 }}
                      >
                        <div style={{ fontSize: 13 }}>{l.message}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}
      </div>

      {drilldownUser ? (
        <UserDrilldownPanel
          user={drilldownUser}
          entries={entries}
          allMonths={months}
          mobile={mobile}
          onClose={() => setDrilldownUser(null)}
        />
      ) : null}

      {mobile && user && (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 12,
            zIndex: 40,
          }}
        >
          <Card
            style={{
              padding: 10,
              borderRadius: 20,
              boxShadow: "0 14px 34px rgba(15,23,42,0.18)",
            }}
          >
            <PrimaryButton full active onClick={exportPDF}>
              PDF Al
            </PrimaryButton>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
