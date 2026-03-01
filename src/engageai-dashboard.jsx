import { useState } from "react";

const T = {
  bg:          "#f7f6f3",
  card:        "#ffffff",
  border:      "#e9e6e0",
  borderLight: "#f0ede8",
  text:        "#1c1917",
  sub:         "#78746e",
  faint:       "#b5b0a8",
  xfaint:      "#d4d0ca",
  sidebar:     "#ffffff",
  tag: {
    replied:   { bg: "#f0f7ee", text: "#4a7c59", border: "#cfe5c9" },
    flagged:   { bg: "#fdf6ec", text: "#92600a", border: "#f0ddb8" },
    hidden:    { bg: "#fdf0f0", text: "#8c3a3a", border: "#f0cece" },
    instagram: { bg: "#fdf0f8", text: "#8c3a6e", border: "#f0cee5" },
    threads:   { bg: "#f0f0fd", text: "#3a3a8c", border: "#ceceee" },
    x:         { bg: "#f2f2f2", text: "#555",    border: "#ddd"    },
  },
};

const COMMENTS = [
  { id: 1, platform: "instagram", user: "sarah_wellness",  comment: "This is exactly what I needed to hear today! How do I get started with your programme?",  post: "Morning routine reel",     time: "2m ago",  status: "replied", reply: "Hey Sarah! So glad it resonated 🙌 Sent you a DM with everything you need to get started." },
  { id: 2, platform: "threads",   user: "markbuilds",      comment: "Great insight. Been following for months and the content keeps getting better.",             post: "AI tools thread",         time: "14m ago", status: "replied", reply: "Really appreciate that Mark — means a lot when you've been here from early on 🙏" },
  { id: 3, platform: "instagram", user: "techfounder_uk",  comment: "What's the ROI like on your sprint programme? Worth the investment for a solo founder?",     post: "Client results post",     time: "28m ago", status: "flagged", reply: "The sprint is built specifically for founders at your stage. Want me to send you the breakdown?" },
  { id: 4, platform: "x",         user: "designdave99",    comment: "Been using AI tools for 6 months and nowhere near your level. What am I missing?",           post: "Vibe coding tweet",       time: "41m ago", status: "flagged", reply: "Honestly it's not the tools — it's the workflow around them. DM me and let's figure out the gap." },
  { id: 5, platform: "threads",   user: "coach_layla",     comment: "Saved this post. Sharing with my whole community 🔥",                                         post: "Promptpreneur framework", time: "55m ago", status: "replied", reply: "Thank you Layla! Would love to connect with your community 🙌" },
  { id: 6, platform: "instagram", user: "spambot_xyz",     comment: "Check out my page for free followers!! follow4follow!!!",                                      post: "Morning routine reel",    time: "1h ago",  status: "hidden",  reply: "" },
  { id: 7, platform: "instagram", user: "nina_creates",    comment: "The way you explain complex topics simply is a real skill. Keep going!",                      post: "AI tools breakdown",      time: "1h ago",  status: "replied", reply: "That genuinely makes my day Nina — that's exactly what I aim for 💙" },
];

const P_LABEL = { instagram: "Instagram", threads: "Threads", x: "X" };

const NAV_ITEMS = [
  { id: "Overview", icon: "○" },
  { id: "Feed",     icon: "≡" },
  { id: "Flagged",  icon: "◇", alert: true },
  { id: "Voice",    icon: "◈" },
];

/* ── Atoms ── */
function Tag({ type, children }) {
  const s = T.tag[type] || { bg: "#f2f2f2", text: "#555", border: "#ddd" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 9px", borderRadius: 100,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      fontSize: 11, fontWeight: 500, letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>{children}</span>
  );
}

function Btn({ children, onClick, variant = "primary", size = "md" }) {
  const styles = {
    primary:   { bg: T.text,        color: "#fff",  border: T.text   },
    secondary: { bg: "#fff",        color: T.text,  border: T.border },
    ghost:     { bg: "transparent", color: T.sub,   border: T.border },
  };
  const sizes  = { sm: { padding: "5px 14px", fontSize: 11 }, md: { padding: "8px 18px", fontSize: 12 } };
  const s = styles[variant]; const z = sizes[size];
  return (
    <button onClick={onClick} style={{
      ...z, background: s.bg, color: s.color,
      border: `1px solid ${s.border}`, borderRadius: 6,
      fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
      letterSpacing: "0.02em", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function Card({ children, style, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && onClick ? "#fdfcfa" : T.card,
        border: `1px solid ${T.border}`, borderRadius: 10,
        padding: "20px 22px", cursor: onClick ? "pointer" : "default",
        transition: "background 0.15s", ...style,
      }}
    >{children}</div>
  );
}

function MiniLabel({ children, style }) {
  return (
    <span style={{
      fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
      color: T.faint, fontWeight: 500, ...style,
    }}>{children}</span>
  );
}

function Divider({ style }) {
  return <div style={{ borderBottom: `1px solid ${T.borderLight}`, ...style }} />;
}

/* ── Overview ── */
function Overview({ setView }) {
  const replied = COMMENTS.filter(c => c.status === "replied").length;
  const flagged  = COMMENTS.filter(c => c.status === "flagged").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {[
          { label: "Total today",     val: COMMENTS.length, tag: null },
          { label: "Auto-handled",    val: replied,         tag: "replied" },
          { label: "Needs attention", val: flagged,         tag: "flagged" },
        ].map(({ label, val, tag }) => (
          <Card key={label}>
            <MiniLabel>{label}</MiniLabel>
            <div style={{ margin: "10px 0", fontSize: 36, fontWeight: 300, letterSpacing: "-0.03em", color: T.text, fontFamily: "'Playfair Display', serif", lineHeight: 1 }}>{val}</div>
            {tag && <Tag type={tag}>{tag === "replied" ? "Auto-replied" : "Flagged"}</Tag>}
          </Card>
        ))}
      </div>

      {/* Platform breakdown */}
      <Card>
        <MiniLabel>Platform breakdown</MiniLabel>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {[
            { p: "instagram", total: 28, auto: 24 },
            { p: "threads",   total: 14, auto: 11 },
            { p: "x",         total: 5,  auto: 0  },
          ].map(({ p, total, auto }) => (
            <div key={p}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <Tag type={p}>{P_LABEL[p]}</Tag>
                <span style={{ fontSize: 12, color: T.faint }}>{auto} / {total} replied</span>
              </div>
              <div style={{ height: 3, background: T.borderLight, borderRadius: 3 }}>
                <div style={{ height: "100%", width: `${(auto / total) * 100}%`, background: T.text, borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Flagged nudge */}
      {flagged > 0 && (
        <Card onClick={() => setView("Flagged")} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <Tag type="flagged">Action needed</Tag>
            <div>
              <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{flagged} comments waiting for your reply</div>
              <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>Pricing questions · founder enquiries</div>
            </div>
          </div>
          <Btn variant="secondary" size="sm">Review →</Btn>
        </Card>
      )}

      {/* Recent activity */}
      <Card>
        <MiniLabel>Recent activity</MiniLabel>
        <div style={{ marginTop: 16 }}>
          {COMMENTS.slice(0, 4).map((c, i) => (
            <div key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "14px 0", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 5, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, color: T.text, fontWeight: 500 }}>@{c.user}</span>
                    <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: T.sub, lineHeight: 1.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.comment}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <Tag type={c.status}>{c.status}</Tag>
                  <span style={{ fontSize: 11, color: T.faint }}>{c.time}</span>
                </div>
              </div>
              {i < 3 && <Divider />}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Btn variant="ghost" size="sm" onClick={() => setView("Feed")}>View full feed →</Btn>
        </div>
      </Card>
    </div>
  );
}

/* ── Feed ── */
function Feed() {
  const [filter, setFilter] = useState("all");
  const list = filter === "all" ? COMMENTS : COMMENTS.filter(c => c.status === filter);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", "replied", "flagged", "hidden"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "6px 14px", borderRadius: 100,
            border: `1px solid ${filter === f ? T.text : T.border}`,
            background: filter === f ? T.text : T.card,
            color: filter === f ? "#fff" : T.sub,
            fontSize: 12, fontWeight: 500, cursor: "pointer",
            fontFamily: "inherit", textTransform: "capitalize", letterSpacing: "0.02em",
          }}>
            {f === "all" ? `All · ${COMMENTS.length}` : f}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {list.map(c => (
          <Card key={c.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>@{c.user}</span>
                <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                <span style={{ fontSize: 11, color: T.xfaint }}>on "{c.post}"</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <Tag type={c.status}>{c.status}</Tag>
                <span style={{ fontSize: 11, color: T.faint }}>{c.time}</span>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: T.text, lineHeight: 1.65 }}>{c.comment}</p>
            {c.reply && (
              <div style={{ marginTop: 14, padding: "12px 14px", background: T.bg, borderRadius: 7, borderLeft: `2px solid ${T.xfaint}` }}>
                <MiniLabel>EngageAI reply</MiniLabel>
                <p style={{ margin: "6px 0 0", fontSize: 13, color: T.sub, lineHeight: 1.65 }}>{c.reply}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ── Flagged ── */
function Flagged() {
  const [items, setItems] = useState(
    COMMENTS.filter(c => c.status === "flagged").map(c => ({ ...c, draft: c.reply }))
  );
  const [done, setDone] = useState([]);

  const approve    = id => { setDone(p => [...p, items.find(c => c.id === id)]); setItems(p => p.filter(c => c.id !== id)); };
  const dismiss    = id => setItems(p => p.filter(c => c.id !== id));
  const updateDraft = (id, val) => setItems(p => p.map(c => c.id === id ? { ...c, draft: val } : c));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {items.length === 0 && done.length === 0 && (
        <Card style={{ textAlign: "center", padding: "60px 24px" }}>
          <div style={{ fontSize: 13, color: T.faint }}>All caught up — nothing to action.</div>
        </Card>
      )}

      {items.map(c => (
        <Card key={c.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>@{c.user}</span>
              <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
              <Tag type="flagged">Flagged</Tag>
            </div>
            <span style={{ fontSize: 11, color: T.faint }}>{c.time}</span>
          </div>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: T.text, lineHeight: 1.65 }}>{c.comment}</p>
          <div style={{ marginBottom: 16 }}>
            <MiniLabel>Draft reply</MiniLabel>
            <textarea
              value={c.draft}
              onChange={e => updateDraft(c.id, e.target.value)}
              rows={3}
              style={{
                marginTop: 8, width: "100%", background: T.bg,
                border: `1px solid ${T.border}`, borderRadius: 7,
                padding: "11px 14px", color: T.text, fontSize: 13,
                lineHeight: 1.65, resize: "vertical", fontFamily: "inherit",
                outline: "none", boxSizing: "border-box",
              }}
              onFocus={e => e.target.style.borderColor = T.text}
              onBlur={e => e.target.style.borderColor = T.border}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={() => approve(c.id)}>Send reply</Btn>
            <Btn variant="secondary" onClick={() => dismiss(c.id)}>Dismiss</Btn>
          </div>
        </Card>
      ))}

      {done.length > 0 && (
        <Card>
          <MiniLabel>Sent this session</MiniLabel>
          <div style={{ marginTop: 16 }}>
            {done.map((c, i) => (
              <div key={c.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: T.sub }}>@{c.user}</span>
                    <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                  </div>
                  <Tag type="replied">Sent</Tag>
                </div>
                {i < done.length - 1 && <Divider />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Voice ── */
function Voice() {
  const [v, setV] = useState({
    tone:      "Warm and direct. Encouraging without being over the top. No corporate speak — sound like a person, not a brand.",
    phrases:   "🙌 🔥 💙 — use naturally. 'Means a lot', 'genuinely', 'let's figure it out'.",
    avoid:     "'Great question!' / 'Absolutely!' / 'Of course!' — too salesy. No hollow affirmations.",
    signoff:   "Use first names. Keep it short. Don't wrap up too neatly.",
    threshold: "simple",
  });
  const [saved, setSaved] = useState(false);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useState(null);

  const update = (k, val) => setV(p => ({ ...p, [k]: val }));
  const save   = () => { setSaved(true); setTimeout(() => setSaved(false), 2200); };

  const handleFiles = (incoming) => {
    const allowed = [...incoming].filter(f =>
      f.type === "application/pdf" ||
      f.type === "text/plain" ||
      f.name.endsWith(".txt") ||
      f.name.endsWith(".pdf")
    );
    setFiles(p => [...p, ...allowed.map(f => ({ name: f.name, size: f.size, type: f.name.endsWith(".pdf") ? "pdf" : "txt", id: Math.random() }))]);
  };

  const removeFile = id => setFiles(p => p.filter(f => f.id !== id));

  const fmt = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes/1024).toFixed(1)} KB` : `${(bytes/1048576).toFixed(1)} MB`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <Card>
        <MiniLabel>Brand voice settings</MiniLabel>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 22 }}>
          {[
            { key: "tone",    label: "Tone",              hint: "How should replies sound?" },
            { key: "phrases", label: "Signature phrases", hint: "Things that feel like you" },
            { key: "avoid",   label: "Avoid",             hint: "What sounds off-brand" },
            { key: "signoff", label: "Sign-off style",    hint: "How you end a reply" },
          ].map(({ key, label, hint }, i, arr) => (
            <div key={key}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{label}</span>
                <span style={{ fontSize: 11, color: T.faint }}>{hint}</span>
              </div>
              <textarea
                value={v[key]}
                onChange={e => update(key, e.target.value)}
                rows={2}
                style={{
                  width: "100%", background: T.bg, border: `1px solid ${T.border}`,
                  borderRadius: 7, padding: "11px 14px", color: T.text,
                  fontSize: 13, lineHeight: 1.65, resize: "vertical",
                  fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                }}
                onFocus={e => e.target.style.borderColor = T.text}
                onBlur={e => e.target.style.borderColor = T.border}
              />
              {i < arr.length - 1 && <Divider style={{ marginTop: 22 }} />}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <MiniLabel>Auto-reply threshold</MiniLabel>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { val: "simple", label: "Simple only",   desc: "Compliments, thanks, reactions" },
            { val: "most",   label: "Most comments", desc: "Everything except pricing & service Qs" },
            { val: "all",    label: "All comments",  desc: "Handle everything, flag nothing" },
          ].map(({ val, label, desc }) => (
            <div
              key={val} onClick={() => update("threshold", val)}
              style={{
                display: "flex", gap: 14, cursor: "pointer", alignItems: "flex-start",
                padding: "12px 14px", borderRadius: 7, border: `1px solid`,
                borderColor: v.threshold === val ? T.text : T.border,
                background: v.threshold === val ? T.bg : "transparent",
                transition: "all 0.12s",
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: "50%", marginTop: 1, flexShrink: 0,
                border: `1.5px solid ${v.threshold === val ? T.text : T.border}`,
                background: v.threshold === val ? T.text : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {v.threshold === val && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
              </div>
              <div>
                <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 12, color: T.faint, marginTop: 2 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* File upload */}
      <Card>
        <MiniLabel>Train from documents</MiniLabel>
        <p style={{ fontSize: 12, color: T.faint, marginTop: 6, marginBottom: 16, lineHeight: 1.6 }}>
          Upload past content, brand guides, or example replies. EngageAI will use these to refine your voice.
        </p>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => document.getElementById("voice-file-input").click()}
          style={{
            border: `1.5px dashed ${dragging ? T.text : T.border}`,
            borderRadius: 8, padding: "28px 20px", textAlign: "center",
            cursor: "pointer", background: dragging ? T.bg : "transparent",
            transition: "all 0.15s", marginBottom: files.length ? 16 : 0,
          }}
        >
          <div style={{ fontSize: 20, marginBottom: 8, opacity: 0.3 }}>↑</div>
          <div style={{ fontSize: 13, color: T.sub, marginBottom: 4 }}>Drop files here or <span style={{ color: T.text, fontWeight: 500 }}>browse</span></div>
          <div style={{ fontSize: 11, color: T.faint }}>PDF or TXT · Max 10 MB each</div>
          <input
            id="voice-file-input"
            type="file"
            accept=".pdf,.txt"
            multiple
            style={{ display: "none" }}
            onChange={e => handleFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((f, i) => (
              <div key={f.id}>
                {i === 0 && <Divider style={{ marginBottom: 8 }} />}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: f.type === "pdf" ? "#fdf0f8" : "#f0f7fd",
                      border: `1px solid ${f.type === "pdf" ? "#f0cee5" : "#c5dff0"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 600,
                      color: f.type === "pdf" ? "#8c3a6e" : "#3a6e8c",
                      flexShrink: 0,
                    }}>
                      {f.type.toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, color: T.text, fontWeight: 500 }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: T.faint, marginTop: 1 }}>{fmt(f.size)}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(f.id)}
                    style={{
                      background: "none", border: "none", color: T.faint,
                      fontSize: 16, cursor: "pointer", padding: "4px 8px",
                      lineHeight: 1, fontFamily: "inherit",
                    }}
                  >×</button>
                </div>
                {i < files.length - 1 && <Divider />}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <MiniLabel>Active platforms</MiniLabel>
        <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["instagram", "threads", "x"].map(p => (
            <Tag key={p} type={p}>{P_LABEL[p]} · Active</Tag>
          ))}
        </div>
      </Card>

      <div><Btn onClick={save}>{saved ? "✓ Saved" : "Save voice settings"}</Btn></div>
    </div>
  );
}

/* ── Shell ── */
export default function App() {
  const [view, setView] = useState("Overview");
  const flagCount = COMMENTS.filter(c => c.status === "flagged").length;
  const views = {
    Overview: <Overview setView={setView} />,
    Feed:     <Feed />,
    Flagged:  <Flagged />,
    Voice:    <Voice />,
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: T.bg, fontFamily: "'DM Sans', sans-serif", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=Playfair+Display:wght@300;400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        button:hover { opacity: 0.7; }
        ::-webkit-scrollbar { width: 0; }
      `}</style>

      {/* ── Sidebar ── */}
      <div style={{
        width: 220, background: T.sidebar,
        borderRight: `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        position: "sticky", top: 0, height: "100vh",
        flexShrink: 0,
      }}>
        {/* Wordmark */}
        <div style={{ padding: "32px 24px 28px", borderBottom: `1px solid ${T.borderLight}` }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.03em", color: T.text }}>EngageAI</div>
          <div style={{ fontSize: 11, color: T.xfaint, marginTop: 3 }}>by Promptpreneur</div>
        </div>

        {/* Nav links */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          {NAV_ITEMS.map(({ id, icon, alert }) => {
            const active = view === id;
            return (
              <button
                key={id} onClick={() => setView(id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px", borderRadius: 7, border: "none",
                  background: active ? T.bg : "transparent",
                  color: active ? T.text : T.faint,
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  cursor: "pointer", fontFamily: "inherit",
                  textAlign: "left", marginBottom: 2,
                  transition: "background 0.12s, color 0.12s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, opacity: 0.5 }}>{icon}</span>
                  {id}
                </div>
                {alert && flagCount > 0 && (
                  <span style={{
                    fontSize: 10, background: T.text, color: "#fff",
                    borderRadius: 100, padding: "1px 7px", fontWeight: 600,
                  }}>{flagCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Agent status */}
        <div style={{ padding: "20px 24px", borderTop: `1px solid ${T.borderLight}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#7ab87a", flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: T.faint }}>Agent active</span>
          </div>
          <div style={{ fontSize: 11, color: T.xfaint, lineHeight: 1.8 }}>
            Next sync in 23 min<br />
            Instagram · Threads · X
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 48px 100px" }}>

          {/* Page header */}
          <div style={{ marginBottom: 32 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: T.faint }}>
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <h1 style={{
              fontSize: 32, fontWeight: 300, letterSpacing: "-0.03em",
              color: T.text, lineHeight: 1.1, marginTop: 6,
              fontFamily: "'Playfair Display', serif",
            }}>{view}</h1>
          </div>

          {views[view]}
        </div>
      </div>
    </div>
  );
}
