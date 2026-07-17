"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Heart, MessageCircle, Star, Flag, X, Plus, Search, LogIn, LogOut, Store } from "lucide-react";

const CATEGORIES = [
  { id: "roupa", label: "Roupa & Capulanas", color: "#C1440E", emoji: "👗" },
  { id: "eletro", label: "Eletrónicos", color: "#0F3D3E", emoji: "📱" },
  { id: "casa", label: "Casa & Cozinha", color: "#E8A33D", emoji: "🍲" },
  { id: "comida", label: "Alimentação", color: "#5B7B3C", emoji: "🥭" },
  { id: "servicos", label: "Serviços", color: "#1B2A4A", emoji: "🛠️" },
  { id: "veiculos", label: "Veículos", color: "#6B4226", emoji: "🚗" },
  { id: "outros", label: "Outros", color: "#5A5A5A", emoji: "📦" },
];

const DATA_KEY = "mozmarket-data";
const SESSION_KEY = "mozmarket-session";

const storage = {
  async get(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return null;
      return { key, value: raw };
    } catch (e) {
      return null;
    }
  },
  async set(key, value) {
    try {
      window.localStorage.setItem(key, value);
      return { key, value };
    } catch (e) {
      return null;
    }
  },
  async delete(key) {
    try {
      window.localStorage.removeItem(key);
      return { key, deleted: true };
    } catch (e) {
      return null;
    }
  },
};

function catInfo(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function formatMT(n) {
  return Number(n).toLocaleString("pt-PT") + " MT";
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora mesmo";
  if (s < 3600) return Math.floor(s / 60) + " min";
  if (s < 86400) return Math.floor(s / 3600) + " h";
  return Math.floor(s / 86400) + " d";
}

function sellerTrust(posts, email) {
  const mine = posts.filter((p) => p.sellerEmail === email);
  let totalStars = 0,
    countStars = 0,
    totalFlags = 0;
  mine.forEach((p) => {
    Object.values(p.ratings || {}).forEach((v) => {
      totalStars += v;
      countStars++;
    });
    totalFlags += (p.flags || []).length;
  });
  const avg = countStars ? totalStars / countStars : 0;
  let label = "Novo",
    color = "#5A5A5A";
  if (totalFlags >= 3) {
    label = "Cuidado";
    color = "#C1440E";
  } else if (countStars === 0) {
    label = "Novo";
    color = "#5A5A5A";
  } else if (avg >= 4) {
    label = "Confiável";
    color = "#0F3D3E";
  } else {
    label = "Regular";
    color = "#E8A33D";
  }
  return { avg, countStars, totalFlags, label, color };
}

function Stamp({ label, color, sub }) {
  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 62,
        height: 62,
        borderRadius: "50%",
        border: `2px dashed ${color}`,
        color: color,
        transform: "rotate(-8deg)",
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: 10,
        letterSpacing: "0.03em",
        textTransform: "uppercase",
        lineHeight: 1.1,
        flexShrink: 0,
        background: "rgba(255,255,255,0.5)",
      }}
    >
      <span>{label}</span>
      {sub && <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.8 }}>{sub}</span>}
    </div>
  );
}

export default function MozMarketPlace() {
  const [data, setData] = useState({ posts: [] });
  const [loaded, setLoaded] = useState(false);
  const [session, setSession] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [activeCat, setActiveCat] = useState("all");
  const [query, setQuery] = useState("");
  const [openComments, setOpenComments] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await storage.get(DATA_KEY);
      if (res && res.value) {
        try {
          setData(JSON.parse(res.value));
        } catch (e) {}
      }
      const s = await storage.get(SESSION_KEY);
      if (s && s.value) {
        try {
          setSession(JSON.parse(s.value));
        } catch (e) {}
      }
      setLoaded(true);
    })();
  }, []);

  async function persist(next) {
    setData(next);
    setSaving(true);
    await storage.set(DATA_KEY, JSON.stringify(next));
    setSaving(false);
  }

  async function login(name, email) {
    const s = { name, email };
    setSession(s);
    setShowLogin(false);
    await storage.set(SESSION_KEY, JSON.stringify(s));
  }

  async function logout() {
    setSession(null);
    await storage.delete(SESSION_KEY);
  }

  async function addPost({ title, price, category, description }) {
    const post = {
      id: "p_" + Date.now(),
      title,
      price,
      category,
      description,
      sellerEmail: session.email,
      sellerName: session.name,
      createdAt: Date.now(),
      likes: [],
      comments: [],
      ratings: {},
      flags: [],
    };
    await persist({ ...data, posts: [post, ...data.posts] });
    setShowCompose(false);
  }

  async function toggleLike(postId) {
    if (!session) return setShowLogin(true);
    const posts = data.posts.map((p) => {
      if (p.id !== postId) return p;
      const liked = p.likes.includes(session.email);
      return { ...p, likes: liked ? p.likes.filter((e) => e !== session.email) : [...p.likes, session.email] };
    });
    await persist({ ...data, posts });
  }

  async function rate(postId, stars) {
    if (!session) return setShowLogin(true);
    const posts = data.posts.map((p) => {
      if (p.id !== postId) return p;
      if (p.sellerEmail === session.email) return p;
      return { ...p, ratings: { ...p.ratings, [session.email]: stars } };
    });
    await persist({ ...data, posts });
  }

  async function flagSeller(postId) {
    if (!session) return setShowLogin(true);
    const posts = data.posts.map((p) => {
      if (p.id !== postId) return p;
      if (p.sellerEmail === session.email) return p;
      if (p.flags.includes(session.email)) return p;
      return { ...p, flags: [...p.flags, session.email] };
    });
    await persist({ ...data, posts });
  }

  async function addComment(postId) {
    if (!session) return setShowLogin(true);
    const text = (commentDrafts[postId] || "").trim();
    if (!text) return;
    const posts = data.posts.map((p) => {
      if (p.id !== postId) return p;
      return { ...p, comments: [...p.comments, { author: session.name, text, at: Date.now() }] };
    });
    await persist({ ...data, posts });
    setCommentDrafts({ ...commentDrafts, [postId]: "" });
  }

  const filtered = useMemo(() => {
    return data.posts.filter((p) => {
      if (activeCat !== "all" && p.category !== activeCat) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!p.title.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [data.posts, activeCat, query]);

  if (!loaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Space Grotesk', sans-serif" }}>
        A carregar o mercado…
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F1E6", fontFamily: "'Inter', sans-serif", color: "#1A1A1A" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@600&display=swap');
        * { box-sizing: border-box; }
        button { cursor: pointer; font-family: inherit; }
        input, textarea, select { font-family: inherit; }
        .catpill { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .catpill:hover { transform: translateY(-1px); }
        .card { transition: box-shadow 0.2s ease, transform 0.2s ease; }
        .card:hover { box-shadow: 6px 6px 0 rgba(27,42,74,0.12); transform: translateY(-2px); }
        .starbtn { transition: transform 0.1s ease; }
        .starbtn:hover { transform: scale(1.2); }
        ::selection { background: #E8A33D; color: #1A1A1A; }
      `}</style>

      <header style={{ background: "#1B2A4A", color: "#F5F1E6", padding: "18px 20px", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em" }}>
              Moz<span style={{ color: "#E8A33D" }}>.</span>
            </span>
            <span style={{ fontSize: 13, opacity: 0.8, letterSpacing: "0.04em" }}>Marketing Place</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 260px", maxWidth: 420 }}>
            <div style={{ display: "flex", alignItems: "center", background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "8px 12px", flex: 1 }}>
              <Search size={16} style={{ opacity: 0.7, marginRight: 8, flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Procurar produtos ou serviços…"
                style={{ background: "transparent", border: "none", outline: "none", color: "#F5F1E6", fontSize: 14, width: "100%" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {session ? (
              <>
                <span style={{ fontSize: 13, opacity: 0.85 }}>Olá, {session.name.split(" ")[0]}</span>
                <button
                  onClick={logout}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.3)", color: "#F5F1E6", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}
                >
                  <LogOut size={14} /> Sair
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowLogin(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8A33D", color: "#1A1A1A", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13 }}
              >
                <LogIn size={14} /> Entrar
              </button>
            )}
            <button
              onClick={() => (session ? setShowCompose(true) : setShowLogin(true))}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#C1440E", color: "#F5F1E6", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, fontSize: 13 }}
            >
              <Plus size={14} /> Publicar
            </button>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 20px 0", display: "flex", gap: 8, overflowX: "auto" }}>
        <button
          className="catpill"
          onClick={() => setActiveCat("all")}
          style={{
            flexShrink: 0,
            padding: "7px 14px",
            borderRadius: 999,
            border: activeCat === "all" ? "2px solid #1B2A4A" : "1px solid #ccc4b0",
            background: activeCat === "all" ? "#1B2A4A" : "#fff",
            color: activeCat === "all" ? "#fff" : "#1A1A1A",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Tudo
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            className="catpill"
            onClick={() => setActiveCat(c.id)}
            style={{
              flexShrink: 0,
              padding: "7px 14px",
              borderRadius: 999,
              border: activeCat === c.id ? `2px solid ${c.color}` : "1px solid #ccc4b0",
              background: activeCat === c.id ? c.color : "#fff",
              color: activeCat === c.id ? "#fff" : "#1A1A1A",
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
            }}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "20px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 18 }}>
        {filtered.length === 0 && (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px", color: "#5A5A5A" }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🗂️</div>
            <p style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, margin: 0 }}>Nada por aqui ainda</p>
            <p style={{ fontSize: 14, marginTop: 6 }}>Seja o primeiro a publicar um produto nesta categoria.</p>
          </div>
        )}

        {filtered.map((p) => {
          const cat = catInfo(p.category);
          const trust = sellerTrust(data.posts, p.sellerEmail);
          const liked = session && p.likes.includes(session.email);
          const myRating = session ? p.ratings[session.email] : 0;
          const flagged = session && p.flags.includes(session.email);
          const isOpen = openComments[p.id];

          return (
            <div key={p.id} className="card" style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e6ddc8" }}>
              <div style={{ background: cat.color, padding: "22px 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 44 }}>{cat.emoji}</span>
              </div>
              <div style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: cat.color, fontWeight: 700 }}>{cat.label}</span>
                    <h3 style={{ margin: "4px 0 0", fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, lineHeight: 1.25 }}>{p.title}</h3>
                  </div>
                  <Stamp label={trust.label} color={trust.color} sub={trust.countStars ? `★${trust.avg.toFixed(1)}` : null} />
                </div>

                <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, fontSize: 20, color: "#1B2A4A", margin: "10px 0" }}>{formatMT(p.price)}</div>

                <p style={{ fontSize: 13.5, color: "#3a3a3a", lineHeight: 1.5, margin: "0 0 10px" }}>{p.description}</p>

                <div style={{ fontSize: 12, color: "#8a8271", marginBottom: 10 }}>
                  Vendido por <strong>{p.sellerName}</strong> · {timeAgo(p.createdAt)}
                  {trust.totalFlags >= 3 && (
                    <span style={{ color: "#C1440E", fontWeight: 700 }}> · ⚠️ vários utilizadores reportaram este vendedor</span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 10 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className="starbtn"
                      onClick={() => rate(p.id, n)}
                      title={`Avaliar com ${n} estrela(s)`}
                      style={{ background: "none", border: "none", padding: 2 }}
                    >
                      <Star size={18} fill={n <= myRating ? "#E8A33D" : "none"} color="#E8A33D" />
                    </button>
                  ))}
                  <span style={{ fontSize: 12, color: "#8a8271", marginLeft: 4 }}>
                    {trust.countStars ? `${trust.avg.toFixed(1)} (${trust.countStars})` : "sem avaliações"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: "1px solid #eee5cf", paddingTop: 10 }}>
                  <button onClick={() => toggleLike(p.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", fontSize: 13, color: liked ? "#C1440E" : "#5A5A5A" }}>
                    <Heart size={16} fill={liked ? "#C1440E" : "none"} /> {p.likes.length}
                  </button>
                  <button
                    onClick={() => setOpenComments({ ...openComments, [p.id]: !isOpen })}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", fontSize: 13, color: "#5A5A5A" }}
                  >
                    <MessageCircle size={16} /> {p.comments.length}
                  </button>
                  <button
                    onClick={() => flagSeller(p.id)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", fontSize: 13, color: flagged ? "#C1440E" : "#5A5A5A", marginLeft: "auto" }}
                    title="Reportar vendedor pouco sério"
                  >
                    <Flag size={16} fill={flagged ? "#C1440E" : "none"} /> {p.flags.length}
                  </button>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: "1px dashed #e6ddc8", paddingTop: 10 }}>
                    {p.comments.length === 0 && <p style={{ fontSize: 12.5, color: "#8a8271" }}>Sem comentários ainda.</p>}
                    {p.comments.map((c, i) => (
                      <div key={i} style={{ fontSize: 12.5, marginBottom: 6 }}>
                        <strong>{c.author}</strong> <span style={{ color: "#8a8271" }}>· {timeAgo(c.at)}</span>
                        <div>{c.text}</div>
                      </div>
                    ))}
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input
                        value={commentDrafts[p.id] || ""}
                        onChange={(e) => setCommentDrafts({ ...commentDrafts, [p.id]: e.target.value })}
                        onKeyDown={(e) => e.key === "Enter" && addComment(p.id)}
                        placeholder={session ? "Escreva um comentário…" : "Entre para comentar"}
                        disabled={!session}
                        style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #ccc4b0", fontSize: 13 }}
                      />
                      <button
                        onClick={() => addComment(p.id)}
                        style={{ background: "#1B2A4A", color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", fontSize: 13 }}
                      >
                        Enviar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <footer style={{ textAlign: "center", padding: "24px 20px 40px", fontSize: 12, color: "#8a8271" }}>
        <Store size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />
        Moz Marketing Place — os anúncios ficam guardados apenas neste navegador por agora.
        {saving && <span> · a guardar…</span>}
      </footer>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={login} />}
      {showCompose && <ComposeModal onClose={() => setShowCompose(false)} onSubmit={addPost} />}
    </div>
  );
}

function LoginModal({ onClose, onLogin }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", margin: "0 0 4px" }}>Entrar no Moz.</h2>
        <p style={{ fontSize: 13, color: "#8a8271", margin: "0 0 18px" }}>Protótipo — qualquer email/senha funciona.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && email.trim()) onLogin(name.trim(), email.trim().toLowerCase());
          }}
        >
          <label style={labelStyle}>Nome</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required style={inputStyle} placeholder="Ex: Rafael Thovela" />
          <label style={labelStyle}>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={inputStyle} placeholder="voce@exemplo.com" />
          <label style={labelStyle}>Senha</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />
          <button type="submit" style={{ ...primaryBtnStyle, width: "100%", marginTop: 8 }}>Entrar</button>
        </form>
      </div>
    </div>
  );
}

function ComposeModal({ onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [description, setDescription] = useState("");

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={closeBtnStyle}><X size={18} /></button>
        <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", margin: "0 0 16px" }}>Publicar anúncio</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && price && description.trim()) {
              onSubmit({ title: title.trim(), price: Number(price), category, description: description.trim() });
            }
          }}
        >
          <label style={labelStyle}>Título do produto ou serviço</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required style={inputStyle} placeholder="Ex: Capulana estampada nova" />
          <label style={labelStyle}>Preço (MT)</label>
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} required style={inputStyle} placeholder="500" />
          <label style={labelStyle}>Categoria</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
            ))}
          </select>
          <label style={labelStyle}>Descrição</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} required style={{ ...inputStyle, minHeight: 80, resize: "vertical" }} placeholder="Descreva o produto, estado, condições de entrega…" />
          <button type="submit" style={{ ...primaryBtnStyle, width: "100%", marginTop: 8 }}>Publicar</button>
        </form>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  background: "rgba(26,26,26,0.55)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100,
  padding: 16,
};

const modalStyle = {
  background: "#F5F1E6",
  borderRadius: 14,
  padding: 26,
  width: "100%",
  maxWidth: 380,
  position: "relative",
  fontFamily: "'Inter', sans-serif",
  maxHeight: "90vh",
  overflowY: "auto",
};

const closeBtnStyle = {
  position: "absolute",
  top: 14,
  right: 14,
  background: "none",
  border: "none",
  color: "#5A5A5A",
};

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, margin: "10px 0 4px", color: "#3a3a3a" };

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #ccc4b0",
  fontSize: 14,
  background: "#fff",
};

const primaryBtnStyle = {
  background: "#C1440E",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "11px 16px",
  fontWeight: 600,
  fontSize: 14,
};
