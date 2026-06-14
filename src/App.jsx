import { useState, useEffect, useRef } from "react";

// ==================== DATA ====================
const INITIAL_CUSTOMERS = [
  { id: 1, name: "田中様", address: "1丁目3番地", status: "成約", carrier: "au", note: "家族4人、来月検討", date: "2026-06-10", visited: true },
  { id: 2, name: "佐藤様", address: "2丁目1番地", status: "再訪予定", carrier: "SoftBank", note: "旦那さんと相談中", date: "2026-06-12", visited: true },
  { id: 3, name: "鈴木様", address: "3丁目7番地", status: "不在", carrier: "不明", note: "", date: "2026-06-13", visited: true },
];

const TALK_SCRIPTS = [
  {
    category: "初回アプローチ",
    scripts: [
      { title: "自己紹介", text: "こんにちは！NTTドコモの販売代理店の〇〇と申します。本日はお得なキャンペーンのご案内でお伺いしました。少しだけお時間いただけますか？" },
      { title: "興味引き", text: "今お使いのスマホ料金、実は毎月〇〇〇〇円以上節約できる可能性があります。他社からドコモへのお乗り換えで、端末も無料でご案内できることがございます。" },
    ]
  },
  {
    category: "断り返し",
    scripts: [
      { title: "「今のキャリアで満足」", text: "そうですよね！ただ、今より料金が下がって端末も新しくなるとしたら、いかがでしょうか？比較するだけでしたら5分もかかりません。今の料金プランをちょっと見せていただけますか？" },
      { title: "「忙しい」", text: "お時間いただきありがとうございます！ご説明は5分以内に終わります。あとで詳しい資料だけ置かせていただくのはいかがでしょうか？" },
      { title: "「考えておく」", text: "ありがとうございます。実はこのキャンペーン、〇月〇日までの限定なんです。せっかくですので、今日だけで決めていただかなくてもいいので、まずお見積りだけいかがでしょうか？" },
      { title: "「ドコモは高い」", text: "以前はそうでしたが、今は格安SIMと同等の料金プランも揃っています。データ無制限で月々〇〇〇〇円からご案内できます！今のご請求書と比べてみませんか？" },
    ]
  },
  {
    category: "クロージング",
    scripts: [
      { title: "背中を押す", text: "手続き自体は30分ほどで完了します。今日ご契約いただければ、〇〇のキャッシュバックもご案内できます。ご一緒に進めましょう！" },
      { title: "家族プラン提案", text: "ご家族みなさんでドコモにまとめていただくと、家族割でさらに月々〇〇〇〇円お得になります。ご家族は今何台お使いですか？" },
    ]
  }
];

const CARRIER_COLORS = {
  "au":         { bg: "#fef3c7", text: "#b45309",  dot: "#f59e0b" },
  "SoftBank":   { bg: "#fce7f3", text: "#be185d",  dot: "#ec4899" },
  "UQmobile":   { bg: "#d1fae5", text: "#065f46",  dot: "#10b981" },
  "Y!mobile":   { bg: "#ffe4e6", text: "#be123c",  dot: "#f43f5e" },
  "楽天Mobile": { bg: "#fee2e2", text: "#991b1b",  dot: "#ef4444" },
  "その他":     { bg: "#f3f4f6", text: "#374151",  dot: "#6b7280" },
  "不明":       { bg: "#f8fafc", text: "#94a3b8",  dot: "#cbd5e1" },
};

const STATUS_COLORS = {
  "成約": { bg: "#dcfce7", text: "#16a34a", dot: "#22c55e" },
  "再訪予定": { bg: "#fef9c3", text: "#b45309", dot: "#f59e0b" },
  "不在": { bg: "#f3f4f6", text: "#6b7280", dot: "#9ca3af" },
  "興味なし": { bg: "#fee2e2", text: "#dc2626", dot: "#ef4444" },
  "検討中": { bg: "#eff6ff", text: "#1d4ed8", dot: "#3b82f6" },
};

const CARRIER_OPTIONS = ["au", "SoftBank", "UQmobile", "Y!mobile", "楽天Mobile", "その他"];

// ==================== AI CHAT ====================
async function callClaude(messages, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "エラーが発生しました。";
}

// ==================== COMPONENTS ====================

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["不在"];
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

// ==================== TABS ====================

// 1. Dashboard
function Dashboard({ customers }) {
  const total = customers.length;
  const contracts = customers.filter(c => c.status === "成약").length + customers.filter(c => c.status === "成約").length;
  const revisit = customers.filter(c => c.status === "再訪予定").length;
  const rate = total > 0 ? Math.round((contracts / total) * 100) : 0;

  const carrierCount = {};
  customers.forEach(c => { if (c.carrier && c.carrier !== "不明") carrierCount[c.carrier] = (carrierCount[c.carrier] || 0) + 1; });
  const topCarriers = Object.entries(carrierCount).sort((a, b) => b[1] - a[1]);

  const today = new Date().toISOString().split("T")[0];
  const todayVisits = customers.filter(c => c.date === today).length;
  const todayContracts = customers.filter(c => c.date === today && c.status === "成約").length;

  return (
    <div style={{ padding: "0 4px" }}>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>今日の営業サマリー</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "総訪問数", value: total, sub: `本日 ${todayVisits}件`, color: "#3b82f6" },
          { label: "成約数", value: contracts, sub: `本日 ${todayContracts}件`, color: "#22c55e" },
          { label: "成約率", value: `${rate}%`, sub: "目標 30%", color: rate >= 30 ? "#22c55e" : "#f59e0b" },
          { label: "再訪予定", value: revisit, sub: "フォローアップ", color: "#f59e0b" },
        ].map(item => (
          <div key={item.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* 成約率バー */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>成約率メーター</div>
        <div style={{ background: "#f1f5f9", borderRadius: 99, height: 12, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(rate, 100)}%`, background: rate >= 30 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#f59e0b,#d97706)", height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          <span>0%</span><span style={{ color: "#3b82f6", fontWeight: 700 }}>目標30%</span><span>100%</span>
        </div>
      </div>

      {/* キャリア分布 */}
      {topCarriers.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 10 }}>訪問先キャリア分布</div>
          {topCarriers.map(([carrier, count]) => {
            const cc = CARRIER_COLORS[carrier] || CARRIER_COLORS["その他"];
            return (
              <div key={carrier} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: cc.dot, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: cc.text }}>{carrier}</span>
                  </div>
                  <span style={{ color: "#64748b" }}>{count}件</span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 99, height: 7 }}>
                  <div style={{ width: `${(count / total) * 100}%`, background: cc.dot, height: "100%", borderRadius: 99, transition: "width 0.6s ease" }} />
                </div>
              </div>
            );
       function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS["不在"];
  return (
    <span style={{ background: c.bg, color: c.text, padding: "2px 10px", borderRadius: 99, fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.dot, display: "inline-block" }} />
      {status}
    </span>
  );
}

function Dashboard({ customers }) {
  const total = customers.length;
  const contracts = customers.filter(c => c.status === "成約").length;
  const revisit = customers.filter(c => c.status === "再訪予定").length;
  const rate = total > 0 ? Math.round((contracts / total) * 100) : 0;
  const carrierCount = {};
  customers.forEach(c => { if (c.carrier && c.carrier !== "不明") carrierCount[c.carrier] = (carrierCount[c.carrier] || 0) + 1; });
  const topCarriers = Object.entries(carrierCount).sort((a, b) => b[1] - a[1]);
  const today = new Date().toISOString().split("T")[0];
  const todayVisits = customers.filter(c => c.date === today).length;
  const todayContracts = customers.filter(c => c.date === today && c.status === "成約").length;

  return (
    <div style={{ padding: "0 4px" }}>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 16px" }}>今日の営業サマリー</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "総訪問数", value: total, sub: `本日 ${todayVisits}件`, color: "#3b82f6" },
          { label: "成約数", value: contracts, sub: `本日 ${todayContracts}件`, color: "#22c55e" },
          { label: "成約率", value: `${rate}%`, sub: "目標 30%", color: rate >= 30 ? "#22c55e" : "#f59e0b" },
          { label: "再訪予定", value: revisit, sub: "フォローアップ", color: "#f59e0b" },
        ].map(item => (
          <div key={item.label} style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: item.color, lineHeight: 1 }}>{item.value}</div>
            <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 4 }}>{item.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 8 }}>成約率メーター</div>
        <div style={{ background: "#f1f5f9", borderRadius: 99, height: 12, overflow: "hidden" }}>
          <div style={{ width: `${Math.min(rate, 100)}%`, background: rate >= 30 ? "linear-gradient(90deg,#22c55e,#16a34a)" : "linear-gradient(90deg,#f59e0b,#d97706)", height: "100%", borderRadius: 99 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
          <span>0%</span><span style={{ color: "#3b82f6", fontWeight: 700 }}>目標30%</span><span>100%</span>
        </div>
      </div>
      {topCarriers.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 10 }}>訪問先キャリア分布</div>
          {topCarriers.map(([carrier, count]) => {
            const cc = CARRIER_COLORS[carrier] || CARRIER_COLORS["その他"];
            return (
              <div key={carrier} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, marginBottom: 3 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: cc.dot, display: "inline-block", flexShrink: 0 }} />
                    <span style={{ fontWeight: 600, color: cc.text }}>{carrier}</span>
                  </div>
                  <span style={{ color: "#64748b" }}>{count}件</span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 99, height: 7 }}>
                  <div style={{ width: `${(count / total) * 100}%`, background: cc.dot, height: "100%", borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Customers({ customers, setCustomers }) {
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", status: "不在", carrier: "不明", note: "" });
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoStatus, setGeoStatus] = useState("");
  const [pendingLatLng, setPendingLatLng] = useState(null);
  const geoTimerRef = useRef(null);

  const openAdd = () => { setForm({ name: "", address: "", status: "不在", carrier: "不明", note: "" }); setSelected(null); setPendingLatLng(null); setGeoStatus(""); setShowForm(true); };
  const openEdit = (c) => { setForm({ name: c.name, address: c.address, status: c.status, carrier: c.carrier, note: c.note }); setSelected(c); setPendingLatLng(c.lat && c.lng ? { lat: c.lat, lng: c.lng } : null); setGeoStatus(c.lat ? "ok" : ""); setShowForm(true); };

  const geocode = async (address) => {
    if (!address || address.length < 5) { setGeoStatus(""); setPendingLatLng(null); return; }
    setGeoStatus("loading");
    try {
      const q = encodeURIComponent(address + " 日本");
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`, { headers: { "Accept-Language": "ja" } });
      const data = await res.json();
      if (data[0]) { setPendingLatLng({ lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) }); setGeoStatus("ok"); }
      else { setPendingLatLng(null); setGeoStatus("fail"); }
    } catch { setPendingLatLng(null); setGeoStatus("fail"); }
  };

  const handleAddressChange = (val) => {
    setForm(p => ({ ...p, address: val }));
    setGeoStatus(""); setPendingLatLng(null);
    clearTimeout(geoTimerRef.current);
    geoTimerRef.current = setTimeout(() => geocode(val), 900);
  };

  const save = async () => {
    const today = new Date().toISOString().split("T")[0];
    setGeoLoading(true);
    const latlng = pendingLatLng || {};
    if (selected) { setCustomers(prev => prev.map(c => c.id === selected.id ? { ...c, ...form, ...latlng } : c)); }
    else { setCustomers(prev => [...prev, { id: Date.now(), ...form, ...latlng, date: today, visited: true }]); }
    setGeoLoading(false); setShowForm(false);
  };

  const remove = (id) => setCustomers(prev => prev.filter(c => c.id !== id));

  if (showForm) return (
    <div style={{ padding: "0 4px" }}>
      <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", color: "#6366f1", fontWeight: 700, fontSize: 14, marginBottom: 12, cursor: "pointer", padding: 0 }}>← 戻る</button>
      <div style={{ background: "#fff", borderRadius: 16, padding: 18, boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16 }}>{selected ? "顧客を編集" : "新規顧客を追加"}</h3>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>お名前</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="例: 田中様" style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>住所</label>
          <div style={{ position: "relative" }}>
            <input value={form.address} onChange={e => handleAddressChange(e.target.value)} placeholder="例: 東京都渋谷区〇〇1丁目5番地" style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 40px 10px 12px", borderRadius: 10, border: `1.5px solid ${geoStatus === "ok" ? "#22c55e" : geoStatus === "fail" ? "#ef4444" : "#e2e8f0"}`, fontSize: 14, boxSizing: "border-box", outline: "none" }} />
            <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 16 }}>{geoStatus === "loading" ? "⏳" : geoStatus === "ok" ? "✅" : geoStatus === "fail" ? "❌" : ""}</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 3, color: geoStatus === "ok" ? "#22c55e" : geoStatus === "fail" ? "#ef4444" : "#94a3b8" }}>
            {geoStatus === "loading" ? "📍 住所を検索中..." : geoStatus === "ok" ? "📍 マップにピンが立ちます！" : geoStatus === "fail" ? "住所が見つかりませんでした" : "📍 住所を入力するとマップに自動表示されます"}
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>メモ</label>
          <input value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))} placeholder="例: 来月再訪、家族3人" style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>ステータス</label>
          <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#fff" }}>
            {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>現在のキャリア</label>
          <select value={form.carrier} onChange={e => setForm(p => ({ ...p, carrier: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, background: "#fff" }}>
            <option>不明</option>
            {CARRIER_OPTIONS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={save} disabled={geoLoading || geoStatus === "loading"} style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: geoStatus === "loading" ? 0.6 : 1 }}>
          {geoLoading ? "保存中..." : selected ? "保存する" : "追加する"}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>訪問履歴 {customers.length}件</p>
        <button onClick={openAdd} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 99, padding: "7px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ 追加</button>
      </div>
      {customers.length === 0 && <div style={{ textAlign: "center", color: "#94a3b8", padding: 40 }}>まだ顧客が登録されていません</div>}
      {customers.map(c => (
        <div key={c.id} onClick={() => openEdit(c)} style={{ background: "#fff", borderRadius: 14, padding: "13px 15px", marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", cursor: "pointer" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{c.address} · <span style={{ background: (CARRIER_COLORS[c.carrier]||CARRIER_COLORS["不明"]).bg, color: (CARRIER_COLORS[c.carrier]||CARRIER_COLORS["不明"]).text, padding: "1px 7px", borderRadius: 99, fontWeight: 600 }}>{c.carrier}</span></div>
              {c.note && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>📝 {c.note}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <StatusBadge status={c.status} />
              <button onClick={e => { e.stopPropagation(); remove(c.id); }} style={{ background: "#fee2e2", color: "#ef4444", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 11, cursor: "pointer" }}>削除</button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 6 }}>訪問日: {c.date}</div>
        </div>
      ))}
    </div>
  );
}
function AreaMap({ customers, setCustomers }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const tempMarkerRef = useRef(null);
  const customersRef = useRef(customers);
  const [leafletReady, setLeafletReady] = useState(false);
  const [mapMode, setMapMode] = useState("street");
  const tileLayerRef = useRef(null);
  const [pinForm, setPinForm] = useState(null);
  const [form, setForm] = useState({ name: "", status: "不在", carrier: "不明", note: "" });
  const [reverseLoading, setReverseLoading] = useState(false);

  useEffect(() => { customersRef.current = customers; }, [customers]);

  useEffect(() => {
    if (window.L) { setLeafletReady(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  const makeIcon = (color) => {
    const L = window.L;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.333 14 22 14 22S28 23.333 28 14C28 6.268 21.732 0 14 0z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="14" cy="14" r="5" fill="white"/></svg>`;
    return L.divIcon({ html: svg, iconSize: [28,36], iconAnchor: [14,36], popupAnchor: [0,-36], className: "" });
  };

  const plotMarkers = (map) => {
    const L = window.L;
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    customersRef.current.forEach(c => {
      if (!c.lat || !c.lng) return;
      const color = STATUS_COLORS[c.status]?.dot || "#9ca3af";
      const marker = L.marker([c.lat, c.lng], { icon: makeIcon(color) }).addTo(map)
        .bindPopup(`<div style="font-family:-apple-system,sans-serif;min-width:150px"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${c.name||"名前未設定"}</div><div style="font-size:11px;color:#64748b;margin-bottom:6px">${c.address||""}</div><div style="font-size:11px;background:${STATUS_COLORS[c.status]?.bg||"#f3f4f6"};color:${STATUS_COLORS[c.status]?.text||"#374151"};padding:2px 8px;border-radius:99px;display:inline-block;font-weight:600">${c.status}</div>${c.carrier&&c.carrier!=="不明"?`<div style="font-size:11px;color:#6366f1;font-weight:600;margin-top:4px">${c.carrier}</div>`:""}</div>`);
      markersRef.current.push(marker);
    });
  };

  useEffect(() => {
    if (!leafletReady || !mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true }).setView([35.6812, 139.7671], 15);
    const tile = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
    tileLayerRef.current = tile;
    mapInstanceRef.current = map;

    const handlePin = async (latlng) => {
      const { lat, lng } = latlng;
      if (tempMarkerRef.current) map.removeLayer(tempMarkerRef.current);
      const tempIcon = L.divIcon({ html: `<div style="width:24px;height:24px;background:#6366f1;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(99,102,241,0.6)"></div>`, iconSize: [24,24], iconAnchor: [12,12], className: "" });
      tempMarkerRef.current = L.marker([lat, lng], { icon: tempIcon }).addTo(map);
      setReverseLoading(true);
      setPinForm({ lat, lng, address: "住所を取得中..." });
      setForm({ name: "", status: "不在", carrier: "不明", note: "" });
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=ja`);
        const data = await res.json();
        setPinForm({ lat, lng, address: data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      } catch { setPinForm({ lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }); }
      setReverseLoading(false);
    };

    map.on("contextmenu", (e) => { e.originalEvent.preventDefault(); handlePin(e.latlng); });

    let touchTimer = null, touchMoved = false;
    const mapDiv = mapRef.current;
    const onTouchStart = (e) => {
      touchMoved = false;
      const touch = e.touches[0];
      touchTimer = setTimeout(() => {
        if (!touchMoved) {
          const latlng = map.containerPointToLatLng(L.point(touch.clientX - mapDiv.getBoundingClientRect().left, touch.clientY - mapDiv.getBoundingClientRect().top));
          handlePin(latlng);
        }
      }, 600);
    };
    const onTouchMove = () => { touchMoved = true; clearTimeout(touchTimer); };
    const onTouchEnd = () => clearTimeout(touchTimer);
    mapDiv.addEventListener("touchstart", onTouchStart, { passive: true });
    mapDiv.addEventListener("touchmove", onTouchMove, { passive: true });
    mapDiv.addEventListener("touchend", onTouchEnd);
    plotMarkers(map);
  }, [leafletReady]);

  useEffect(() => {
    customersRef.current = customers;
    if (mapInstanceRef.current && window.L) plotMarkers(mapInstanceRef.current);
  }, [customers]);

  const switchMapMode = (mode) => {
    if (!mapInstanceRef.current || !window.L) return;
    const L = window.L;
    const map = mapInstanceRef.current;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    if (mode === "satellite") {
      tileLayerRef.current = L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", { attribution: "© Google", maxZoom: 21 }).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
    }
    setMapMode(mode);
  };

  const savePin = () => {
    if (!pinForm) return;
    const today = new Date().toISOString().split("T")[0];
    setCustomers(prev => [...prev, { id: Date.now(), name: form.name||"名前未設定", address: pinForm.address, status: form.status, carrier: form.carrier, note: form.note, date: today, visited: true, lat: pinForm.lat, lng: pinForm.lng }]);
    if (tempMarkerRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(tempMarkerRef.current); tempMarkerRef.current = null; }
    setPinForm(null);
  };

  const cancelPin = () => {
    if (tempMarkerRef.current && mapInstanceRef.current) { mapInstanceRef.current.removeLayer(tempMarkerRef.current); tempMarkerRef.current = null; }
    setPinForm(null);
  };

  return (
    <div style={{ padding: "0 4px" }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[{ id: "street", label: "🗺️ 通常" }, { id: "satellite", label: "🛰️ 航空写真" }].map(m => (
          <button key={m.id} onClick={() => switchMapMode(m.id)} style={{ flex: 1, padding: "8px", borderRadius: 10, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", background: mapMode === m.id ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#fff", color: mapMode === m.id ? "#fff" : "#64748b", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>{m.label}</button>
        ))}
      </div>
      <div style={{ borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.12)", marginBottom: 12, position: "relative" }}>
        <div ref={mapRef} style={{ height: 340, width: "100%" }} />
        {!pinForm && <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11, padding: "5px 12px", borderRadius: 99, zIndex: 1000, pointerEvents: "none", whiteSpace: "nowrap" }}>📍 長押し(0.6秒)でピンを立てる</div>}
      </div>
      {pinForm && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.12)", marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>📍 新規ピン</div>
            <button onClick={cancelPin} style={{ background: "#f1f5f9", border: "none", borderRadius: 99, width: 26, height: 26, fontSize: 13, cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 12, background: "#f8fafc", borderRadius: 8, padding: "6px 10px" }}>{reverseLoading ? "📍 住所を取得中..." : pinForm.address}</div>
          {[{ label: "お名前", key: "name", placeholder: "例: 田中様" }, { label: "メモ", key: "note", placeholder: "例: 来月再訪" }].map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{f.label}</label>
              <input value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder} style={{ display: "block", width: "100%", marginTop: 3, padding: "9px 11px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 13, boxSizing: "border-box", outline: "none" }} />
            </div>
          ))}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>ステータス</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 3, padding: "9px 8px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 12, background: "#fff" }}>
                {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>キャリア</label>
              <select value={form.carrier} onChange={e => setForm(p => ({ ...p, carrier: e.target.value }))} style={{ display: "block", width: "100%", marginTop: 3, padding: "9px 8px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 12, background: "#fff" }}>
                <option>不明</option>
                {CARRIER_OPTIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <button onClick={savePin} style={{ width: "100%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✅ ピンを保存する</button>
        </div>
      )}
      <div style={{ background: "#fff", borderRadius: 14, padding: "12px 15px", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>ピンの色（ステータス）</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
          {Object.entries(STATUS_COLORS).map(([s, c]) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: "#64748b" }}>{s}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function TalkScripts() {
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(null);
  const TALK_SCRIPTS = [
    { category: "初回アプローチ", scripts: [
      { title: "自己紹介", text: "こんにちは！NTTドコモの販売代理店の〇〇と申します。本日はお得なキャンペーンのご案内でお伺いしました。少しだけお時間いただけますか？" },
      { title: "興味引き", text: "今お使いのスマホ料金、実は毎月〇〇〇〇円以上節約できる可能性があります。他社からドコモへのお乗り換えで、端末も無料でご案内できることがございます。" },
    ]},
    { category: "断り返し", scripts: [
      { title: "「今のキャリアで満足」", text: "そうですよね！ただ、今より料金が下がって端末も新しくなるとしたら、いかがでしょうか？比較するだけでしたら5分もかかりません。今の料金プランをちょっと見せていただけますか？" },
      { title: "「忙しい」", text: "お時間いただきありがとうございます！ご説明は5分以内に終わります。あとで詳しい資料だけ置かせていただくのはいかがでしょうか？" },
      { title: "「考えておく」", text: "ありがとうございます。実はこのキャンペーン、〇月〇日までの限定なんです。せっかくですので、今日だけで決めていただかなくてもいいので、まずお見積りだけいかがでしょうか？" },
      { title: "「ドコモは高い」", text: "以前はそうでしたが、今は格安SIMと同等の料金プランも揃っています。データ無制限で月々〇〇〇〇円からご案内できます！今のご請求書と比べてみませんか？" },
    ]},
    { category: "クロージング", scripts: [
      { title: "背中を押す", text: "手続き自体は30分ほどで完了します。今日ご契約いただければ、〇〇のキャッシュバックもご案内できます。ご一緒に進めましょう！" },
      { title: "家族プラン提案", text: "ご家族みなさんでドコモにまとめていただくと、家族割でさらに月々〇〇〇〇円お得になります。ご家族は今何台お使いですか？" },
    ]},
  ];
  const copy = (text, id) => { navigator.clipboard?.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };
  return (
    <div style={{ padding: "0 4px" }}>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>シーン別トークスクリプト</p>
      {TALK_SCRIPTS.map((cat, ci) => (
        <div key={ci} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 8, padding: "4px 0", borderBottom: "2px solid #ede9fe" }}>{cat.category}</div>
          {cat.scripts.map((s, si) => {
            const id = `${ci}-${si}`;
            return (
              <div key={si} style={{ background: "#fff", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <button onClick={() => setOpen(open === id ? null : id)} style={{ width: "100%", background: "none", border: "none", padding: "12px 15px", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</span>
                  <span style={{ color: "#6366f1", fontSize: 16 }}>{open === id ? "▲" : "▼"}</span>
                </button>
                {open === id && (
                  <div style={{ padding: "0 15px 14px" }}>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: "0 0 10px", background: "#f8f7ff", borderRadius: 10, padding: "10px 12px" }}>{s.text}</p>
                    <button onClick={() => copy(s.text, id)} style={{ background: copied === id ? "#dcfce7" : "#ede9fe", color: copied === id ? "#16a34a" : "#6366f1", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {copied === id ? "✓ コピー済み" : "📋 コピー"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
function TalkScripts() {
  const [open, setOpen] = useState(null);
  const [copied, setCopied] = useState(null);
  const TALK_SCRIPTS = [
    { category: "初回アプローチ", scripts: [
      { title: "自己紹介", text: "こんにちは！NTTドコモの販売代理店の〇〇と申します。本日はお得なキャンペーンのご案内でお伺いしました。少しだけお時間いただけますか？" },
      { title: "興味引き", text: "今お使いのスマホ料金、実は毎月〇〇〇〇円以上節約できる可能性があります。他社からドコモへのお乗り換えで、端末も無料でご案内できることがございます。" },
    ]},
    { category: "断り返し", scripts: [
      { title: "「今のキャリアで満足」", text: "そうですよね！ただ、今より料金が下がって端末も新しくなるとしたら、いかがでしょうか？比較するだけでしたら5分もかかりません。今の料金プランをちょっと見せていただけますか？" },
      { title: "「忙しい」", text: "お時間いただきありがとうございます！ご説明は5分以内に終わります。あとで詳しい資料だけ置かせていただくのはいかがでしょうか？" },
      { title: "「考えておく」", text: "ありがとうございます。実はこのキャンペーン、〇月〇日までの限定なんです。せっかくですので、今日だけで決めていただかなくてもいいので、まずお見積りだけいかがでしょうか？" },
      { title: "「ドコモは高い」", text: "以前はそうでしたが、今は格安SIMと同等の料金プランも揃っています。データ無制限で月々〇〇〇〇円からご案内できます！今のご請求書と比べてみませんか？" },
    ]},
    { category: "クロージング", scripts: [
      { title: "背中を押す", text: "手続き自体は30分ほどで完了します。今日ご契約いただければ、〇〇のキャッシュバックもご案内できます。ご一緒に進めましょう！" },
      { title: "家族プラン提案", text: "ご家族みなさんでドコモにまとめていただくと、家族割でさらに月々〇〇〇〇円お得になります。ご家族は今何台お使いですか？" },
    ]},
  ];
  const copy = (text, id) => { navigator.clipboard?.writeText(text); setCopied(id); setTimeout(() => setCopied(null), 1500); };
  return (
    <div style={{ padding: "0 4px" }}>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 14px" }}>シーン別トークスクリプト</p>
      {TALK_SCRIPTS.map((cat, ci) => (
        <div key={ci} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6366f1", marginBottom: 8, padding: "4px 0", borderBottom: "2px solid #ede9fe" }}>{cat.category}</div>
          {cat.scripts.map((s, si) => {
            const id = `${ci}-${si}`;
            return (
              <div key={si} style={{ background: "#fff", borderRadius: 12, marginBottom: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
                <button onClick={() => setOpen(open === id ? null : id)} style={{ width: "100%", background: "none", border: "none", padding: "12px 15px", textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{s.title}</span>
                  <span style={{ color: "#6366f1", fontSize: 16 }}>{open === id ? "▲" : "▼"}</span>
                </button>
                {open === id && (
                  <div style={{ padding: "0 15px 14px" }}>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, margin: "0 0 10px", background: "#f8f7ff", borderRadius: 10, padding: "10px 12px" }}>{s.text}</p>
                    <button onClick={() => copy(s.text, id)} style={{ background: copied === id ? "#dcfce7" : "#ede9fe", color: copied === id ? "#16a34a" : "#6366f1", border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      {copied === id ? "✓ コピー済み" : "📋 コピー"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
async function callClaude(messages, systemPrompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, system: systemPrompt, messages }),
  });
  const data = await res.json();
  return data.content?.map(b => b.text || "").join("") || "エラーが発生しました。";
}

function AIRoleplay() {
  const [messages, setMessages] = useState([{ role: "assistant", text: "こんにちは！MNP乗り換えの練習を始めましょう。私はお客さん役をします。ドアベルを押してください👇" }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const bottomRef = useRef(null);
  const SYSTEM = `あなたはNTTドコモへのMNP乗り換え営業の練習相手（お客様役）です。現在SoftBankを使用している30代主婦です。最初は少し迷惑そうにしているが、丁寧に対応すれば話を聞いてくれる。「今のままで満足」「忙しい」などの断り文句を自然に使う。家族3人でスマホを使っている。短めのセリフで自然な会話をする。会話の最後に【評価】として一言フィードバックをする。`;
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  const start = async () => {
    setStarted(true); setLoading(true);
    const reply = await callClaude([{ role: "user", content: "（ドアベルが鳴る）" }], SYSTEM);
    setMessages([{ role: "assistant", text: reply }]); setLoading(false);
  };
  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", text: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setLoading(true);
    const apiMsgs = newMsgs.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.text }));
    const reply = await callClaude(apiMsgs, SYSTEM);
    setMessages([...newMsgs, { role: "assistant", text: reply }]); setLoading(false);
  };
  return (
    <div style={{ padding: "0 4px", display: "flex", flexDirection: "column", height: "100%" }}>
      <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 10px" }}>AIお客様相手にセールストークを練習</p>
      {!started ? (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🏠</div>
          <p style={{ color: "#374151", fontSize: 14, lineHeight: 1.7, margin: "0 0 16px" }}>AIがお客様役を担当します。<br/>実際の訪問販売を想定してトーク練習ができます。</p>
          <button onClick={start} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>🔔 ドアベルを押す</button>
        </div>
      ) : (
        <>
          <div style={{ flex: 1, overflowY: "auto", marginBottom: 10, maxHeight: 380 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
                {m.role === "assistant" && <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>👩</div>}
                <div style={{ maxWidth: "78%", background: m.role === "user" ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "#fff", color: m.role === "user" ? "#fff" : "#374151", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px", fontSize: 13, lineHeight: 1.6, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ede9fe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, marginRight: 8, flexShrink: 0 }}>👩</div>
                <div style={{ background: "#fff", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
                  <span style={{ display: "inline-flex", gap: 4 }}>{[0,1,2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#c4b5fd" }} />)}</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="セールストークを入力..." style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none" }} />
            <button onClick={send} disabled={loading} style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff", border: "none", borderRadius: 12, padding: "0 16px", fontSize: 18, cursor: "pointer", opacity: loading ? 0.6 : 1 }}>→</button>
          </div>
          <button onClick={() => { setStarted(false); setMessages([]); }} style={{ marginTop: 8, background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>練習をリセット</button>
        </>
      )}
    </div>
  );
}
function ProspectReminder({ customers, onClose }) {
  const prospects = customers.filter(c => c.status === "再訪予定" || c.status === "検討中");
  if (prospects.length === 0) return null;
  return (
    <div style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)", margin: "0 0 12px", borderRadius: 14, padding: "12px 15px", boxShadow: "0 2px 8px rgba(245,158,11,0.3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>🔔</span>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>今日フォローしたい見込み客</span>
        </div>
        <button onClick={onClose} style={{ background: "rgba(255,255,255,0.25)", border: "none", borderRadius: 99, width: 22, height: 22, color: "#fff", fontSize: 12, cursor: "pointer" }}>✕</button>
      </div>
      {prospects.map(c => (
        <div key={c.id} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 12px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{c.name}</div>
            <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 2 }}>{c.address} · {c.carrier}</div>
            {c.note && <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, marginTop: 2 }}>📝 {c.note}</div>}
          </div>
          <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, padding: "3px 8px" }}>
            <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>{c.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

const TABS = [
  { id: "dashboard", label: "成績", icon: "📊" },
  { id: "customers", label: "顧客", icon: "👥" },
  { id: "map", label: "エリア", icon: "🗺️" },
  { id: "scripts", label: "トーク", icon: "💬" },
  { id: "ai", label: "AI練習", icon: "🤖" },
];

export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [customers, setCustomers] = useState(INITIAL_CUSTOMERS);
  const [showReminder, setShowReminder] = useState(true);
  const prospectCount = customers.filter(c => c.status === "再訪予定" || c.status === "検討中").length;
  useEffect(() => { setShowReminder(true); }, [tab]);

  const renderTab = () => {
    switch (tab) {
      case "dashboard": return <Dashboard customers={customers} />;
      case "customers": return <Customers customers={customers} setCustomers={setCustomers} />;
      case "map": return <AreaMap customers={customers} setCustomers={setCustomers} />;
      case "scripts": return <TalkScripts />;
      case "ai": return <AIRoleplay />;
    }
  };

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: "#f1f5f9", fontFamily: "-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`* { box-sizing: border-box; } body { margin: 0; background: #f1f5f9; } @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} } @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }`}</style>
      <div style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)", padding: "16px 20px 14px", color: "#fff" }}>
        <div style={{ fontSize: 11, color: "#93c5fd", fontWeight: 600, letterSpacing: 1 }}>NTT DOCOMO MNP</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>営業サポートアプリ</div>
          {prospectCount > 0 && (
            <button onClick={() => { setTab("dashboard"); setShowReminder(true); }} style={{ background: "#f59e0b", border: "none", borderRadius: 99, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
              <span style={{ fontSize: 13 }}>🔔</span>
              <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{prospectCount}</span>
            </button>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#bfdbfe", marginTop: 2 }}>{new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" })}</div>
      </div>
      <div style={{ flex: 1, padding: "16px 16px 80px", overflowY: "auto" }}>
        {tab === "dashboard" && showReminder && prospectCount > 0 && (
          <div style={{ animation: "slideDown 0.3s ease" }}>
            <ProspectReminder customers={customers} onClose={() => setShowReminder(false)} />
          </div>
        )}
        {renderTab()}
      </div>
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", boxShadow: "0 -2px 12px rgba(0,0,0,0.08)" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, background: "none", border: "none", padding: "10px 0 12px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: tab === t.id ? "#6366f1" : "#94a3b8" }}>{t.label}</span>
            {tab === t.id && <div style={{ width: 20, height: 3, background: "#6366f1", borderRadius: 99, marginTop: 1 }} />}
          </button>
        ))}
      </div>
    </div>
  );
}
   
