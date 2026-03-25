import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import bcrypt from "bcryptjs";

const OFFLINE_QUEUE_KEY = "ytso_offline_entry_queue_v3";

function formatMonth(monthKey) {
  if (!monthKey) return "";
  const [year, month] = monthKey.split("-").map(Number);
  const monthName = new Intl.DateTimeFormat("tr-TR", { month: "long" }).format(new Date(year, month - 1, 1));
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
  const remainder = diff % 60;
  if (remainder > 0 && remainder < 30) diff += 30 - remainder;
  else if (remainder > 30) diff += 60 - remainder;
  return `${Math.floor(diff / 60)}:${String(diff % 60).padStart(2, "0")}`;
}

function parseDurationToMinutes(duration) {
  if (!duration) return 0;
  const [h, m] = duration.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function minutesToText(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} saat ${String(m).padStart(2, "0")} dakika`;
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

function AppShell({ children, mobile }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%)",
        padding: mobile ? 12 : 24,
        paddingBottom: mobile ? 96 : 24,
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto" }}>{children}</div>
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.95)",
        border: "1px solid #e2e8f0",
        borderRadius: 24,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>{title}</div>
      {subtitle ? <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{subtitle}</div> : null}
    </div>
  );
}

function StatPill({ label, value, strong }) {
  return (
    <div
      style={{
        borderRadius: 16,
        padding: "10px 14px",
        background: strong ? "#eff6ff" : "#f8fafc",
        border: strong ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
      }}
    >
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: strong ? 18 : 16, fontWeight: strong ? 800 : 700, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function PrimaryButton({ children, onClick, type = "button", full, active, danger, ghost }) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        minHeight: 46,
        padding: "12px 16px",
        borderRadius: 14,
        border: danger ? "1px solid #fecaca" : active ? "1px solid #2563eb" : ghost ? "1px solid transparent" : "1px solid #cbd5e1",
        background: danger ? "#fef2f2" : active ? "#2563eb" : ghost ? "transparent" : "#fff",
        color: danger ? "#b91c1c" : active ? "#fff" : "#0f172a",
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
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#0f172a",
        WebkitTextFillColor: "#0f172a",
        fontSize: 14,
        boxSizing: "border-box",
        color: "#0f172a",
        WebkitTextFillColor: "#0f172a",
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
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#0f172a",
        WebkitTextFillColor: "#0f172a",
        fontSize: 14,
        boxSizing: "border-box",
        resize: "vertical",
        color: "#0f172a",
        WebkitTextFillColor: "#0f172a",
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
        border: "1px solid #cbd5e1",
        background: "#fff",
        color: "#0f172a",
        WebkitTextFillColor: "#0f172a",
        fontSize: 14,
        boxSizing: "border-box",
        color: "#0f172a",
        WebkitTextFillColor: "#0f172a",
        ...props.style,
      }}
    />
  );
}

function EntryCard({ item, mobile }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        padding: mobile ? 12 : 14,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 800 }}>{item.date}</div>
        <div style={{ color: "#2563eb", fontWeight: 700 }}>{item.duration}</div>
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: "#475569" }}>{item.start} - {item.end}</div>
      <div style={{ marginTop: 6, fontSize: 13 }}>
        <span style={{ fontWeight: 700 }}>{workTypeLabel(item.work_type)}</span>
        {" · "}
        {item.user_name}
      </div>
      <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.45 }}>{item.description}</div>
    </div>
  );
}

export default function App() {
  const [users, setUsers] = useState([]);
  const [user, setUser] = useState(null);
  const [entries, setEntries] = useState([]);
  const [logs, setLogs] = useState([]);
  const [settings, setSettings] = useState({
    signature2_name: "Genel Sekreter",
    signature3_name: "Yönetim Kurulu Başkanı",
  });
  const [activeTab, setActiveTab] = useState("entry");
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [syncing, setSyncing] = useState(false);
  const [viewportWidth, setViewportWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1280);

  const [login, setLogin] = useState({ name: "", password: "" });
  const [newUser, setNewUser] = useState({ name: "", password: "", department: "" });
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirmPassword: "" });
  const [form, setForm] = useState({ date: "", start: "", end: "", description: "", work_type: "hafta_ici" });
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [reportMode, setReportMode] = useState("monthly");

  const mobile = viewportWidth < 768;
  const tablet = viewportWidth >= 768 && viewportWidth < 1180;

  const loadAll = async () => {
    const [{ data: usersData }, { data: entriesData }, { data: logsData }, { data: settingsData }] = await Promise.all([
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
    const onResize = () => setViewportWidth(window.innerWidth);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("resize", onResize);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const addLog = async (message) => {
    if (!online) return;
    await supabase.from("logs").insert({ message });
    const { data } = await supabase.from("logs").select("*").order("created_at", { ascending: false });
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
    if (queue.length !== remaining.length) await addLog(`Çevrimdışı kayıtlar senkronize edildi: ${queue.length - remaining.length}`);
    setSyncing(false);
  };

  useEffect(() => {
    if (online) syncOfflineQueue();
  }, [online]);

  const loginUser = async () => {
    const { data, error } = await supabase.from("users").select("*").eq("name", login.name).maybeSingle();
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
  };

  const logout = () => {
    setUser(null);
    setSelectedUser("all");
    setSelectedMonth("");
    setSelectedYear("");
    setReportMode("monthly");
    setActiveTab("entry");
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
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
    loadAll();
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

    const { data, error } = await supabase.from("users").select("*").eq("id", user.id).maybeSingle();
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
    const { error: updateError } = await supabase.from("users").update({ password_hash, password: null }).eq("id", user.id);
    if (updateError) {
      alert("Şifre güncellenemedi: " + updateError.message);
      return;
    }

    await addLog(`${user.name} şifresini değiştirdi`);
    setPasswordForm({ oldPassword: "", newPassword: "", confirmPassword: "" });
    alert("Şifre başarıyla güncellendi.");
    loadAll();
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`${name} kullanıcısını silmek istiyor musunuz?`)) return;
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
      alert("Kullanıcı silinemedi: " + error.message);
      return;
    }
    await addLog(`Kullanıcı silindi: ${name}`);
    loadAll();
  };

  const saveSettings = async () => {
    const { data: current } = await supabase.from("settings").select("*").limit(1).maybeSingle();
    if (current?.id) {
      await supabase.from("settings").update({
        signature2_name: settings.signature2_name,
        signature3_name: settings.signature3_name,
      }).eq("id", current.id);
    } else {
      await supabase.from("settings").insert({
        signature2_name: settings.signature2_name,
        signature3_name: settings.signature3_name,
      });
    }
    await addLog("İmzacı bilgileri güncellendi");
    loadAll();
    alert("İmzacı bilgileri kaydedildi.");
  };

  const submitEntry = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!form.date || !form.start || !form.end || !form.description || !form.work_type) {
      alert("Tüm alanları doldurun.");
      return;
    }
    const payload = {
      user_id: user.id,
      user_name: user.name,
      date: form.date,
      start: form.start,
      end: form.end,
      description: form.description,
      work_type: form.work_type,
      duration: calcDuration(form.start, form.end),
    };
    if (!online) {
      const queue = getQueue();
      queue.push({ ...payload, _queuedAt: new Date().toISOString() });
      setQueue(queue);
      setEntries((prev) => [{ id: `offline-${Date.now()}`, ...payload }, ...prev]);
      setForm({ date: "", start: "", end: "", description: "", work_type: "hafta_ici" });
      alert("İnternet yok. Kayıt cihazda tutuldu; bağlantı gelince gönderilecek.");
      return;
    }
    const { error } = await supabase.from("entries").insert(payload);
    if (error) {
      alert("Mesai kaydı eklenemedi: " + error.message);
      return;
    }
    await addLog(`${user.name} mesai kaydı ekledi`);
    setForm({ date: "", start: "", end: "", description: "", work_type: "hafta_ici" });
    loadAll();
  };

  const months = [...new Set(entries.map((x) => x.date?.slice(0, 7)).filter(Boolean))].sort().reverse();
  const years = [...new Set(entries.map((x) => x.date?.slice(0, 4)).filter(Boolean))].sort().reverse();

  const visibleEntries = useMemo(() => {
    let data = user?.role === "admin" ? entries : entries.filter((x) => x.user_id === user?.id);
    if (user?.role === "admin" && selectedUser !== "all") data = data.filter((x) => x.user_id === selectedUser);
    if (reportMode === "monthly" && selectedMonth) data = data.filter((x) => x.date?.startsWith(selectedMonth));
    if (reportMode === "yearly" && selectedYear) data = data.filter((x) => x.date?.startsWith(selectedYear));
    return data;
  }, [entries, user, selectedUser, selectedMonth, selectedYear, reportMode]);

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
      if (typeof pdfMake.addVirtualFileSystem === "function") pdfMake.addVirtualFileSystem(fontContainer);
      else if (fontContainer?.pdfMake?.vfs) pdfMake.vfs = fontContainer.pdfMake.vfs;
      else if (fontContainer?.vfs) pdfMake.vfs = fontContainer.vfs;
      else if (fontContainer && typeof fontContainer === "object") pdfMake.vfs = fontContainer;

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

      const filteredUserName = user?.role === "admin"
        ? (selectedUser === "all" ? "Tüm kullanıcılar" : (users.find((u) => u.id === selectedUser)?.name || "Seçili kullanıcı"))
        : user?.name;
      const periodLabel = reportMode === "monthly" ? formatMonth(selectedMonth) : `${selectedYear} YILI`;

      const body = [
        ["No", "Tarih", "Başl.", "Bitiş", "Süre", "Mesai Türü", "Açıklama", "Kişi"].map((x) => ({ text: x, style: "tableHeader" })),
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
                ...(logoDataUrl ? [{ width: 42, image: "logo", fit: [32, 32], margin: [0, 0, 8, 0] }] : []),
                {
                  width: "*",
                  stack: [
                    { text: "Yalova Ticaret ve Sanayi Odası", style: "orgTitle" },
                    { text: filteredUserName ? `Personel: ${filteredUserName}` : "", style: "subInfo" },
                  ],
                },
              ],
            },
            {
              width: 240,
              stack: [
                { text: "FAZLA ÇALIŞMA TAKİP RAPORU", style: "reportTitle", alignment: "right" },
                { text: periodLabel, style: "subTitle", alignment: "right" },
                { text: `Tarih: ${formatToday()}`, style: "subInfo", alignment: "right" },
              ],
            },
          ],
        }),
        footer: (currentPage, pageCount) => ({
          margin: [24, 6, 24, 12],
          stack: [
            { canvas: [{ type: "line", x1: 0, y1: 0, x2: 760, y2: 0, lineWidth: 0.6, lineColor: "#cbd5e1" }], margin: [0, 0, 0, 6] },
            {
              columns: [
                {
                  width: "*",
                  columns: [
                    { width: "33%", stack: [{ text: "________________________", alignment: "center" }, { text: filteredUserName || "", style: "signName", alignment: "center" }, { text: "Mesaiyi Yapan", style: "signRole", alignment: "center" }] },
                    { width: "33%", stack: [{ text: "________________________", alignment: "center" }, { text: settings.signature2_name || "", style: "signName", alignment: "center" }, { text: "Genel Sekreter", style: "signRole", alignment: "center" }] },
                    { width: "34%", stack: [{ text: "________________________", alignment: "center" }, { text: settings.signature3_name || "", style: "signName", alignment: "center" }, { text: "Yönetim Kurulu Başkanı", style: "signRole", alignment: "center" }] },
                  ],
                },
                {
                  width: 210,
                  stack: [
                    { text: `Hafta İçi Toplamı: ${minutesToText(totalsByType.hafta_ici)}`, style: "totalLite", alignment: "right" },
                    { text: `Hafta Sonu Toplamı: ${minutesToText(totalsByType.hafta_sonu)}`, style: "totalLite", alignment: "right" },
                    { text: `Resmi Tatil Toplamı: ${minutesToText(totalsByType.resmi_tatil)}`, style: "totalLite", alignment: "right" },
                    { text: `Genel Toplam: ${minutesToText(totalsByType.genel)}`, style: "totalBold", alignment: "right", margin: [0, 2, 0, 0] },
                    { text: `Sayfa ${currentPage} / ${pageCount}`, style: "pageNo", alignment: "right", margin: [0, 6, 0, 0] },
                  ],
                },
              ],
            },
          ],
        }),
        background: () => ({ text: "YTSO", color: "#94a3b8", opacity: 0.08, bold: true, fontSize: 72, angle: -30, absolutePosition: { x: 315, y: 180 } }),
        content: [{
          table: { headerRows: 1, widths: [20, 52, 38, 38, 38, 62, "*", 62], body },
          layout: {
            fillColor: (rowIndex) => (rowIndex === 0 ? "#f1f5f9" : rowIndex % 2 === 0 ? "#fafcff" : null),
            hLineColor: () => "#cbd5e1",
            vLineColor: () => "#cbd5e1",
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            paddingLeft: () => 4,
            paddingRight: () => 4,
            paddingTop: () => 3,
            paddingBottom: () => 3,
          },
        }],
        styles: {
          orgTitle: { fontSize: 11, bold: true, color: "#0f172a" },
          reportTitle: { fontSize: 14, bold: true, color: "#0f172a" },
          subTitle: { fontSize: 10, color: "#334155" },
          subInfo: { fontSize: 9, color: "#64748b" },
          tableHeader: { bold: true, fontSize: 8.5, color: "#0f172a", alignment: "center" },
          signName: { fontSize: 8.5, bold: true, color: "#0f172a", margin: [0, 4, 0, 0] },
          signRole: { fontSize: 8, color: "#64748b", margin: [0, 2, 0, 0] },
          totalLite: { fontSize: 8, color: "#475569" },
          totalBold: { fontSize: 9, bold: true, color: "#0f172a" },
          pageNo: { fontSize: 8, color: "#64748b" },
        },
        defaultStyle: { font: "Roboto", fontSize: 8, color: "#0f172a" },
        images: logoDataUrl ? { logo: logoDataUrl } : {},
      };
      pdfMake.createPdf(docDefinition).download(`rapor-${reportMode === "monthly" ? selectedMonth : selectedYear}.pdf`);
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
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <img src="/logo.png" alt="YTSO Logo" style={{ height: mobile ? 56 : 72, objectFit: "contain" }} />
              <div style={{ fontSize: mobile ? 24 : 28, fontWeight: 900, textAlign: "center", lineHeight: 1.15, letterSpacing: "-0.03em" }}>YTSO MESAİ GİRİŞ SİSTEMİ</div>
              <div style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>Mobil ve masaüstü uyumlu kurumsal mesai yönetimi</div>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <TextInput placeholder="Kullanıcı adı" value={login.name} onChange={(e) => setLogin((p) => ({ ...p, name: e.target.value }))} />
              <TextInput type="password" placeholder="Şifre" value={login.password} onChange={(e) => setLogin((p) => ({ ...p, password: e.target.value }))} />
              <PrimaryButton full active onClick={loginUser}>Giriş Yap</PrimaryButton>
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
          <div style={{ display: "flex", flexDirection: mobile ? "column" : "row", alignItems: mobile ? "stretch" : "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: mobile ? 24 : 28, fontWeight: 900, letterSpacing: "-0.03em" }}>{user.name}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{user.department || "-"} · {user.role}</div>
              {!online && <div style={{ marginTop: 8, fontSize: 12, color: "#b45309", fontWeight: 800 }}>Çevrimdışı mod aktif</div>}
              {syncing && <div style={{ marginTop: 8, fontSize: 12, color: "#2563eb", fontWeight: 800 }}>Senkronizasyon yapılıyor…</div>}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {!mobile && <PrimaryButton onClick={exportPDF}>PDF Al</PrimaryButton>}
              <PrimaryButton onClick={logout}>Çıkış</PrimaryButton>
            </div>
          </div>
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : tablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
          <StatPill label="Hafta İçi" value={minutesToText(totalsByType.hafta_ici)} />
          <StatPill label="Hafta Sonu" value={minutesToText(totalsByType.hafta_sonu)} />
          <StatPill label="Resmi Tatil" value={minutesToText(totalsByType.resmi_tatil)} />
          <StatPill label="Genel Toplam" value={minutesToText(totalsByType.genel)} strong />
        </div>

        <Card style={{ padding: mobile ? 14 : 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : tablet ? "1fr 1fr" : user.role === "admin" ? "1fr 1fr 1fr auto" : "1fr 1fr auto", gap: 12, alignItems: "center" }}>
            <SelectInput value={reportMode} onChange={(e) => setReportMode(e.target.value)}>
              <option value="monthly">Aylık Rapor</option>
              <option value="yearly">Yıllık Rapor</option>
            </SelectInput>
            {user.role === "admin" && (
              <SelectInput value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)}>
                <option value="all">Tüm kullanıcılar</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </SelectInput>
            )}
            {reportMode === "monthly" ? (
              <SelectInput value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
                <option value="">Ay seçin</option>
                {months.map((m) => <option key={m} value={m}>{formatMonth(m)}</option>)}
              </SelectInput>
            ) : (
              <SelectInput value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}>
                <option value="">Yıl seçin</option>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </SelectInput>
            )}
            {!mobile && <PrimaryButton onClick={exportPDF}>PDF Al</PrimaryButton>}
          </div>
        </Card>

        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
          {["entry", "report", "records", "security", ...(user.role === "admin" ? ["admin"] : [])].map((tab) => (
            <PrimaryButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
              {tab === "entry" ? "Mesai Girişi" : tab === "report" ? "Rapor" : tab === "records" ? "Kayıtlar" : tab === "security" ? "Güvenlik" : "Yönetim Paneli"}
            </PrimaryButton>
          ))}
        </div>

        {activeTab === "entry" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle title="Yeni Mesai Kaydı" subtitle="Telefon, tablet ve masaüstünde hızlı veri girişi için optimize edildi." />
            <form onSubmit={submitEntry}>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : tablet ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
                <TextInput type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value, work_type: getDefaultWorkTypeByDate(e.target.value) }))} />
                <TextInput type="time" value={form.start} onChange={(e) => setForm((p) => ({ ...p, start: e.target.value }))} />
                <TextInput type="time" value={form.end} onChange={(e) => setForm((p) => ({ ...p, end: e.target.value }))} />
                <SelectInput value={form.work_type} onChange={(e) => setForm((p) => ({ ...p, work_type: e.target.value }))}>
                  <option value="hafta_ici">Hafta İçi</option>
                  <option value="hafta_sonu">Hafta Sonu</option>
                  <option value="resmi_tatil">Resmi Tatil</option>
                </SelectInput>
              </div>
              <TextArea placeholder="Açıklama" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              <div style={{ marginTop: 14, display: "flex", justifyContent: mobile ? "stretch" : "flex-start" }}>
                <PrimaryButton type="submit" full={mobile}>Kaydet</PrimaryButton>
              </div>
            </form>
          </Card>
        )}

        {activeTab === "report" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle title="Rapor Önizleme" subtitle={reportMode === "monthly" ? "Aylık görünüm" : "Yıllık görünüm"} />
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: 940 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <img src="/logo.png" alt="logo" style={{ height: 40 }} />
                    <div>
                      <div style={{ fontWeight: 800 }}>Yalova Ticaret ve Sanayi Odası</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>FAZLA ÇALIŞMA TAKİP RAPORU</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800 }}>{reportMode === "monthly" ? formatMonth(selectedMonth) : `${selectedYear || ""} YILI`}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>Tarih: {formatToday()}</div>
                  </div>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#f1f5f9" }}>
                      {["No", "Tarih", "Başlangıç", "Bitiş", "Süre", "Mesai Türü", "Açıklama", "Kişi"].map((head) => (
                        <th key={head} style={{ border: "1px solid #cbd5e1", padding: 8, textAlign: "left" }}>{head}</th>
                      ))}
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
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{workTypeLabel(row.work_type)}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.description}</td>
                        <td style={{ border: "1px solid #e2e8f0", padding: 8 }}>{row.user_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}

        {activeTab === "records" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle title="Kayıtlar" subtitle="Mobilde kart görünümü, masaüstünde hızlı tarama." />
            <div style={{ display: "grid", gap: 10 }}>
              {visibleEntries.map((item) => <EntryCard key={item.id} item={item} mobile={mobile} />)}
            </div>
          </Card>
        )}

        {activeTab === "security" && (
          <Card style={{ padding: mobile ? 14 : 20 }}>
            <SectionTitle title="Güvenlik" subtitle="Şifre değiştirme ve hesap güvenliği." />
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 12 }}>
              <TextInput type="password" placeholder="Eski şifre" value={passwordForm.oldPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, oldPassword: e.target.value }))} />
              <TextInput type="password" placeholder="Yeni şifre" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))} />
              <TextInput type="password" placeholder="Yeni şifre tekrar" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))} />
            </div>
            <PrimaryButton onClick={changePassword} full={mobile}>Şifreyi Güncelle</PrimaryButton>
          </Card>
        )}

        {user.role === "admin" && activeTab === "admin" && (
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : tablet ? "1fr" : "1.05fr 0.95fr", gap: 16 }}>
            <Card style={{ padding: mobile ? 14 : 20 }}>
              <SectionTitle title="Kullanıcı Yönetimi" subtitle="Mobilde tek kolon, masaüstünde daha geniş düzen." />
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 14 }}>
                <TextInput placeholder="Kullanıcı adı" value={newUser.name} onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))} />
                <TextInput placeholder="Şifre" value={newUser.password} onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))} />
                <TextInput placeholder="Birim" value={newUser.department} onChange={(e) => setNewUser((p) => ({ ...p, department: e.target.value }))} />
                <PrimaryButton onClick={addUser}>Kullanıcı Ekle</PrimaryButton>
              </div>
              <div style={{ display: "grid", gap: 10 }}>
                {users.map((u) => (
                  <div key={u.id} style={{ border: "1px solid #e2e8f0", borderRadius: 16, padding: 12, display: "flex", flexDirection: mobile ? "column" : "row", alignItems: mobile ? "stretch" : "center", justifyContent: "space-between", gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 800 }}>{u.name}</div>
                      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>{u.department} · {u.role}</div>
                    </div>
                    {u.role !== "admin" ? <PrimaryButton danger onClick={() => deleteUser(u.id, u.name)} full={mobile}>Sil</PrimaryButton> : null}
                  </div>
                ))}
              </div>
            </Card>

            <div style={{ display: "grid", gap: 16 }}>
              <Card style={{ padding: mobile ? 14 : 20 }}>
                <SectionTitle title="İmzacı Ayarları" subtitle="PDF raporlarında kullanılır." />
                <div style={{ display: "grid", gap: 10 }}>
                  <TextInput placeholder="Genel Sekreter" value={settings.signature2_name || ""} onChange={(e) => setSettings((p) => ({ ...p, signature2_name: e.target.value }))} />
                  <TextInput placeholder="Yönetim Kurulu Başkanı" value={settings.signature3_name || ""} onChange={(e) => setSettings((p) => ({ ...p, signature3_name: e.target.value }))} />
                  <PrimaryButton onClick={saveSettings} full={mobile}>Kaydet</PrimaryButton>
                </div>
              </Card>

              <Card style={{ padding: mobile ? 14 : 20 }}>
                <SectionTitle title="İşlem Logları" subtitle="En güncel işlemler üstte görünür." />
                <div style={{ display: "grid", gap: 8, maxHeight: mobile ? undefined : 420, overflow: "auto" }}>
                  {logs.map((l) => (
                    <div key={l.id} style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 8 }}>
                      <div style={{ fontSize: 13 }}>{l.message}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>

      {mobile && user && (
        <div style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 40 }}>
          <Card style={{ padding: 10, borderRadius: 20, boxShadow: "0 14px 34px rgba(15,23,42,0.18)" }}>
            <PrimaryButton full active onClick={exportPDF}>PDF Al</PrimaryButton>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
mobil input fix
