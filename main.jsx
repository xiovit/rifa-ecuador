import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ─── CONFIG ────────────────────────────────────────────────────────────────
const SUPABASE_URL  = "https://lgumcxmtjghkvygsmdrh.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxndW1jeG10amdoa3Z5Z3NtZHJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwMTY3MTksImV4cCI6MjA5NjU5MjcxOX0.RmvXGLt_4Sd-p7hkyysBjcKVb2udJO9Z2c-JBCuVyIs";
const ADMIN_PWD     = "rifa2026";
const PRECIO        = 5;
const META_USD      = 2160;
const TOTAL_NUMS    = 500;

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── HELPERS ───────────────────────────────────────────────────────────────
const fmt = (n) => String(n).padStart(3, "0");

const C = {
  disponible: { bg: "#0d2a18", border: "#1a5c32", text: "#6fcf97", label: "Disponible" },
  reservado:  { bg: "#3a2800", border: "#c8960a", text: "#ffd966", label: "Reservado"  },
  vendido:    { bg: "#1a0d00", border: "#D4A843", text: "#D4A843", label: "Vendido"    },
};

const estiloInput = {
  width: "100%", padding: "11px 14px", borderRadius: 9,
  border: "1px solid rgba(212,168,67,0.25)", background: "#0a0800",
  color: "#E8E0CC", fontSize: 14, boxSizing: "border-box", outline: "none",
  fontFamily: "Georgia, serif",
};

// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const [nums,       setNums]       = useState({});
  const [vista,      setVista]      = useState("publica");
  const [pass,       setPass]       = useState("");
  const [loginErr,   setLoginErr]   = useState("");
  const [sel,        setSel]        = useState(null);
  const [form,       setForm]       = useState({ nombre:"", telefono:"", email:"", notas:"" });
  const [filtro,     setFiltro]     = useState("todos");
  const [busq,       setBusq]       = useState("");
  const [toast,      setToast]      = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [cargando,   setCargando]   = useState(true);

  useEffect(() => { cargar(); }, []);

  // ── Carga desde Supabase ─────────────────────────────────────────────────
  async function cargar() {
    setCargando(true);
    const base = {};
    for (let i = 1; i <= TOTAL_NUMS; i++) {
      base[i] = { status: "disponible", comprador: null, id: null };
    }
    const { data, error } = await db.from("rifa_ecuador").select("*");
    if (!error && data) {
      data.forEach(row => {
        const n = parseInt(row.numero);
        if (n >= 1 && n <= TOTAL_NUMS) {
          base[n] = {
            status:    row.status || "vendido",
            comprador: { nombre: row.nombre || "", email: row.email || "", telefono: row.telefono || "", notas: row.notas || "" },
            id:        row.id,
          };
        }
      });
    }
    setNums(base);
    setCargando(false);
  }

  const toast_ = (msg, tipo = "ok") => {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 3000);
  };

  // Stats
  const vals = Object.values(nums);
  const st = {
    disponible: vals.filter(n => n.status === "disponible").length,
    reservado:  vals.filter(n => n.status === "reservado").length,
    vendido:    vals.filter(n => n.status === "vendido").length,
  };
  const recaudado = st.vendido * PRECIO;
  const pct = Math.min((recaudado / META_USD) * 100, 100).toFixed(1);

  // ── Login ────────────────────────────────────────────────────────────────
  const login = () => {
    if (pass === ADMIN_PWD) { setVista("admin"); setLoginErr(""); setPass(""); }
    else setLoginErr("Contraseña incorrecta");
  };

  // ── Abrir detalle ────────────────────────────────────────────────────────
  const abrir = (n) => {
    setSel(n);
    const c = nums[n]?.comprador;
    setForm(c ? { ...c } : { nombre:"", telefono:"", email:"", notas:"" });
    setVista("detalle");
  };

  // ── Guardar comprador ────────────────────────────────────────────────────
  async function guardar(n, status) {
    if (!form.nombre.trim()) { toast_("El nombre es obligatorio", "error"); return; }
    const id = nums[n]?.id;
    const payload = { status, nombre: form.nombre, email: form.email, telefono: form.telefono, notas: form.notas };
    let err;
    if (id) {
      ({ error: err } = await db.from("rifa_ecuador").update(payload).eq("id", id));
    } else {
      ({ error: err } = await db.from("rifa_ecuador").insert({ numero: fmt(n), ...payload }));
    }
    if (err) { toast_("Error: " + err.message, "error"); return; }
    await cargar();
    toast_(`#${fmt(n)} registrado para ${form.nombre}`);
    setVista("admin");
  }

  // ── Cambio rápido ────────────────────────────────────────────────────────
  async function cambiar(n, status) {
    const id = nums[n]?.id;
    if (status === "disponible" && id) {
      await db.from("rifa_ecuador").delete().eq("id", id);
    } else if (id) {
      await db.from("rifa_ecuador").update({ status }).eq("id", id);
    }
    await cargar();
    toast_(`#${fmt(n)} → ${C[status].label}`);
    setVista("admin");
  }

  // ── Liberar número ───────────────────────────────────────────────────────
  async function liberar(n) {
    const id = nums[n]?.id;
    if (id) await db.from("rifa_ecuador").delete().eq("id", id);
    await cargar();
    toast_(`#${fmt(n)} liberado`);
    setConfirmDel(null);
    setVista("admin");
  }

  // Filtrado
  const filtrados = Object.entries(nums).filter(([n, d]) => {
    const okE = filtro === "todos" || d.status === filtro;
    const okB = busq === "" || fmt(Number(n)).includes(busq);
    return okE && okB;
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VISTA PÚBLICA
  // ═══════════════════════════════════════════════════════════════════════════
  if (vista === "publica") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#000 0%,#0a0800 50%,#000 100%)", fontFamily:"Georgia,serif", color:"#E8E0CC" }}>

      {/* Header */}
      <div style={{ textAlign:"center", padding:"32px 20px 16px", background:"linear-gradient(180deg,#0a0800 0%,transparent 100%)", borderBottom:"1px solid #D4A84322", position:"relative" }}>
        <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,transparent,#D4A843,transparent)" }} />
        <div style={{ fontSize:10, letterSpacing:5, color:"#D4A843", textTransform:"uppercase", marginBottom:10 }}>✦ Rifa Solidaria Ecuador 2026 ✦</div>
        <h1 style={{ margin:0, fontSize:"clamp(24px,6vw,40px)", fontWeight:900, background:"linear-gradient(135deg,#D4A843,#F0C96A,#D4A843)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1.2 }}>
          Viaje a <em>Cuenca</em>
        </h1>
        <div style={{ marginTop:10, display:"inline-block", padding:"4px 16px", borderRadius:20, background:"rgba(212,168,67,0.08)", border:"1px solid rgba(212,168,67,0.2)" }}>
          <p style={{ color:"#A89878", margin:0, fontSize:13 }}>Apoya el sueño universitario de <strong style={{ color:"#D4A843" }}>Dariela Quintana</strong> 🇪🇸</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:"flex", justifyContent:"center", gap:10, padding:"18px 20px", flexWrap:"wrap" }}>
        {[
          { label:"Disponibles", count: cargando ? "…" : st.disponible, color:"#6fcf97" },
          { label:"Reservados",  count: cargando ? "…" : st.reservado,  color:"#ffd966" },
          { label:"Vendidos",    count: cargando ? "…" : st.vendido,    color:"#D4A843" },
        ].map(s => (
          <div key={s.label} style={{ background:"rgba(255,255,255,0.04)", border:`1px solid ${s.color}28`, borderRadius:14, padding:"12px 18px", textAlign:"center", minWidth:85 }}>
            <div style={{ fontSize:26, fontWeight:900, color:s.color }}>{s.count}</div>
            <div style={{ fontSize:10, color:"#A89878", letterSpacing:1.5, textTransform:"uppercase" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barra de progreso */}
      {!cargando && (
        <div style={{ margin:"0 20px 18px", maxWidth:480, marginLeft:"auto", marginRight:"auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#D4A843", marginBottom:4, letterSpacing:1 }}>
            <span>META: €2.000 inscripción universitaria</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height:8, background:"#ffffff12", borderRadius:4, overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#D4A843,#F0C96A)", borderRadius:4, transition:"width 0.5s" }} />
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#A89878", opacity:0.6, marginTop:3 }}>
            <span>${recaudado.toFixed(2)} recaudados</span>
            <span>≈ $2.160 necesarios</span>
          </div>
        </div>
      )}

      {/* Premio */}
      <div style={{ margin:"0 16px 18px", background:"linear-gradient(135deg,rgba(212,168,67,0.10),rgba(10,8,0,0.5))", border:"1px solid rgba(212,168,67,0.3)", borderRadius:18, padding:"18px 20px", display:"flex", gap:16, alignItems:"center" }}>
        <div style={{ fontSize:40 }}>🏆</div>
        <div>
          <div style={{ color:"#D4A843", fontWeight:700, fontSize:11, letterSpacing:2, textTransform:"uppercase" }}>Premio del Ganador</div>
          <div style={{ color:"#F5F0E8", fontSize:16, fontWeight:700, marginTop:2 }}>Fin de semana en Cuenca, Ecuador</div>
          <div style={{ color:"#A89878", fontSize:12, marginTop:4 }}>🏨 1 noche · 👫 2 personas · ✈️ Viaje incluido · <strong style={{ color:"#D4A843" }}>${PRECIO} USD</strong> / ticket · Solo 500 números</div>
        </div>
      </div>

      {/* Leyenda */}
      <div style={{ display:"flex", justifyContent:"center", gap:18, padding:"0 20px 14px", flexWrap:"wrap" }}>
        {Object.entries(C).map(([k,v]) => (
          <div key={k} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12 }}>
            <div style={{ width:14, height:14, borderRadius:4, background:v.bg, border:`2px solid ${v.border}` }} />
            <span style={{ color:"#A89878" }}>{v.label}</span>
          </div>
        ))}
      </div>

      {/* Grilla pública (solo lectura) */}
      <div style={{ padding:"0 12px 24px" }}>
        {cargando ? (
          <div style={{ textAlign:"center", padding:40, color:"#D4A843", fontSize:14 }}>
            Cargando tickets...
            <div style={{ width:40, height:2, background:"#D4A843", margin:"10px auto 0", animation:"pulse 1s infinite" }} />
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(52px,1fr))", gap:6 }}>
            {Array.from({ length: TOTAL_NUMS }, (_, i) => i + 1).map(n => {
              const d = nums[n] || { status:"disponible" };
              const c = C[d.status];
              return (
                <div key={n} style={{ background:c.bg, border:`2px solid ${c.border}`, borderRadius:9, padding:"8px 4px", textAlign:"center" }}>
                  <div style={{ fontSize:13, fontWeight:700, color:c.text, fontFamily:"monospace" }}>{fmt(n)}</div>
                  {d.status === "vendido"    && <div style={{ fontSize:8, color:c.border, marginTop:2 }}>✓</div>}
                  {d.status === "reservado"  && <div style={{ fontSize:8, color:c.border, marginTop:2 }}>◷</div>}
                  {d.status === "disponible" && <div style={{ fontSize:8, color:"#1a3a22" }}>libre</div>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pago info */}
      <div style={{ margin:"0 16px 20px", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 }}>
        <div style={{ background:"#0A0A0A", border:"1px solid #D4A84340", padding:"1.2rem", borderRadius:8 }}>
          <div style={{ fontSize:20, marginBottom:8 }}>🏦</div>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:2, color:"#D4A843", marginBottom:8 }}>Transferencia Bancaria</div>
          <div style={{ fontSize:13, lineHeight:1.8, color:"#E8E0CC" }}>
            <div><span style={{ color:"#A89878", fontSize:11 }}>BANCO</span><br/><strong>Banco Guayaquil</strong></div>
            <div style={{ marginTop:6 }}><span style={{ color:"#A89878", fontSize:11 }}>TITULAR</span><br/><strong>Dariela Belén Quintana Pacheco</strong></div>
            <div style={{ marginTop:6 }}><span style={{ color:"#A89878", fontSize:11 }}>CUENTA AHORROS</span><br/><strong style={{ color:"#D4A843", fontSize:15 }}># 0006738333</strong></div>
          </div>
        </div>
        <div style={{ background:"#0A0A0A", border:"1px solid #D4A84340", padding:"1.2rem", borderRadius:8 }}>
          <div style={{ fontSize:20, marginBottom:8 }}>✉️</div>
          <div style={{ fontSize:10, textTransform:"uppercase", letterSpacing:2, color:"#D4A843", marginBottom:8 }}>Envía tu comprobante</div>
          <div style={{ fontSize:13, lineHeight:1.8, color:"#E8E0CC" }}>
            <p>Después de pagar, envía tu comprobante a:</p>
            <a href="mailto:belendariela@gmail.com" style={{ color:"#D4A843", fontWeight:700, textDecoration:"none" }}>belendariela@gmail.com</a>
            <p style={{ color:"#A89878", fontSize:12, marginTop:8 }}>Incluye tu nombre completo para registrar tus tickets.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign:"center", padding:"20px", borderTop:"1px solid rgba(212,168,67,0.12)", fontSize:13, color:"#A89878" }}>
        <p style={{ margin:"0 0 14px", lineHeight:1.7 }}>
          Tu participación hace posible el sueño universitario de Dariela.<br/>
          <strong style={{ color:"#D4A843" }}>¡Gracias por tu apoyo solidario! 💛</strong>
        </p>
        <button onClick={() => setVista("login")} style={{ background:"transparent", border:"1px solid rgba(212,168,67,0.25)", color:"#A89878", padding:"8px 22px", borderRadius:10, cursor:"pointer", fontSize:12, letterSpacing:1 }}>
          🔐 Administración
        </button>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:0.3} 50%{opacity:1} }`}</style>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LOGIN
  // ═══════════════════════════════════════════════════════════════════════════
  if (vista === "login") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#000,#0a0800)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"Georgia,serif" }}>
      <div style={{ background:"rgba(212,168,67,0.05)", border:"1px solid rgba(212,168,67,0.2)", borderRadius:22, padding:40, width:"90%", maxWidth:360, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>🔐</div>
        <h2 style={{ color:"#D4A843", marginBottom:6, fontSize:20 }}>Panel de Administración</h2>
        <p style={{ color:"#A89878", fontSize:13, marginBottom:24 }}>Rifa Solidaria — Cuenca Ecuador 2026</p>
        <input
          type="password" placeholder="Contraseña"
          value={pass} onChange={e => setPass(e.target.value)}
          onKeyDown={e => e.key === "Enter" && login()}
          style={{ ...estiloInput, marginBottom:8, fontSize:16 }}
        />
        {loginErr && <div style={{ color:"#ff6b6b", fontSize:13, marginBottom:8 }}>{loginErr}</div>}
        <button onClick={login} style={{ width:"100%", padding:13, borderRadius:10, background:"linear-gradient(135deg,#D4A843,#F0C96A)", border:"none", color:"#000", fontWeight:800, fontSize:16, cursor:"pointer", marginBottom:12 }}>
          Entrar
        </button>
        <button onClick={() => setVista("publica")} style={{ background:"transparent", border:"none", color:"#A89878", cursor:"pointer", fontSize:13 }}>← Volver</button>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN
  // ═══════════════════════════════════════════════════════════════════════════
  if (vista === "admin") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#000,#0a0800)", fontFamily:"Georgia,serif", color:"#E8E0CC" }}>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)", background: toast.tipo==="error"?"#3a0f0f":"#0f2a1a", border:`1px solid ${toast.tipo==="error"?"#ff6b6b":"#6fcf97"}`, color: toast.tipo==="error"?"#ff6b6b":"#6fcf97", padding:"12px 24px", borderRadius:12, zIndex:9999, fontSize:14, fontWeight:700, boxShadow:"0 8px 32px rgba(0,0,0,0.6)", whiteSpace:"nowrap" }}>
          {toast.msg}
        </div>
      )}

      {/* Barra admin */}
      <div style={{ background:"rgba(0,0,0,0.7)", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderBottom:"1px solid rgba(212,168,67,0.15)", position:"sticky", top:0, zIndex:100 }}>
        <div>
          <div style={{ color:"#D4A843", fontWeight:700, fontSize:15 }}>⚙️ Panel Admin</div>
          <div style={{ color:"#A89878", fontSize:11 }}>Rifa Solidaria — Cuenca Ecuador 2026</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={cargar} style={{ background:"rgba(212,168,67,0.08)", border:"1px solid rgba(212,168,67,0.2)", color:"#D4A843", padding:"6px 12px", borderRadius:8, cursor:"pointer", fontSize:11 }}>⟳</button>
          <button onClick={() => setVista("publica")} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(212,168,67,0.2)", color:"#A89878", padding:"6px 12px", borderRadius:8, cursor:"pointer", fontSize:11 }}>Vista pública</button>
          <button onClick={() => setVista("publica")} style={{ background:"rgba(255,80,80,0.08)", border:"1px solid rgba(255,107,107,0.25)", color:"#ff6b6b", padding:"6px 12px", borderRadius:8, cursor:"pointer", fontSize:11 }}>Salir</button>
        </div>
      </div>

      {/* Stats admin */}
      <div style={{ display:"flex", gap:8, padding:"14px 14px 8px", flexWrap:"wrap" }}>
        {[
          { label:"Disponibles", count: st.disponible,    color:"#6fcf97" },
          { label:"Reservados",  count: st.reservado,     color:"#ffd966" },
          { label:"Vendidos",    count: st.vendido,        color:"#D4A843" },
          { label:"Recaudado",   count: `$${recaudado}`,  color:"#F0C96A" },
        ].map(s => (
          <div key={s.label} style={{ flex:1, minWidth:65, background:"rgba(255,255,255,0.04)", border:`1px solid ${s.color}22`, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
            <div style={{ fontSize:20, fontWeight:900, color:s.color }}>{s.count}</div>
            <div style={{ fontSize:9, color:"#A89878", textTransform:"uppercase", letterSpacing:0.8 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ padding:"6px 14px 12px", display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
        <input
          placeholder="Buscar nº..."
          value={busq} onChange={e => setBusq(e.target.value)}
          style={{ padding:"8px 12px", borderRadius:8, border:"1px solid rgba(212,168,67,0.25)", background:"#0a0800", color:"#E8E0CC", fontSize:13, width:100, outline:"none" }}
        />
        {["todos","disponible","reservado","vendido"].map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding:"7px 12px", borderRadius:8, fontSize:11, cursor:"pointer",
            background: filtro===f ? (f==="disponible"?"#0d2a18":f==="reservado"?"#3a2800":f==="vendido"?"#1a0d00":"#1a1200") : "rgba(255,255,255,0.03)",
            border: `1px solid ${filtro===f ? (f==="disponible"?"#1a5c32":f==="reservado"?"#c8960a":f==="vendido"?"#D4A843":"#D4A84444") : "rgba(255,255,255,0.07)"}`,
            color: filtro===f ? "#fff" : "#A89878",
          }}>
            {f === "todos" ? "Todos" : C[f]?.label}
          </button>
        ))}
      </div>

      {/* Grilla admin (clickeable) */}
      <div style={{ padding:"0 12px 32px" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(56px,1fr))", gap:6 }}>
          {filtrados.map(([n, d]) => {
            const num = Number(n);
            const c   = C[d.status];
            return (
              <div key={n} onClick={() => abrir(num)}
                style={{ background:c.bg, border:`2px solid ${c.border}`, borderRadius:10, padding:"10px 4px", textAlign:"center", cursor:"pointer", transition:"all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
                onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
              >
                <div style={{ fontSize:13, fontWeight:700, color:c.text, fontFamily:"monospace" }}>{fmt(num)}</div>
                {d.comprador?.nombre
                  ? <div style={{ fontSize:8, color:c.border, marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", padding:"0 2px" }}>{d.comprador.nombre.split(" ")[0]}</div>
                  : <div style={{ fontSize:8, color:"#1a3a22" }}>libre</div>
                }
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // DETALLE / FORMULARIO
  // ═══════════════════════════════════════════════════════════════════════════
  if (vista === "detalle" && sel) {
    const actual = nums[sel] || { status:"disponible", comprador:null };
    const c = C[actual.status];
    return (
      <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#000,#0a0800)", fontFamily:"Georgia,serif", color:"#E8E0CC" }}>

        {/* Modal confirmar liberación */}
        {confirmDel && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:9999 }}>
            <div style={{ background:"#0a0800", border:"1px solid #ff6b6b", borderRadius:18, padding:28, width:"85%", maxWidth:320, textAlign:"center" }}>
              <div style={{ fontSize:36, marginBottom:12 }}>⚠️</div>
              <p style={{ color:"#E8E0CC", marginBottom:20 }}>
                ¿Liberar el número <strong style={{ color:"#D4A843" }}>{fmt(sel)}</strong>?<br/>
                <span style={{ fontSize:13, color:"#A89878" }}>Los datos del comprador serán eliminados.</span>
              </p>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={() => setConfirmDel(null)} style={{ flex:1, padding:10, borderRadius:8, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(212,168,67,0.25)", color:"#A89878", cursor:"pointer" }}>Cancelar</button>
                <button onClick={() => liberar(sel)} style={{ flex:1, padding:10, borderRadius:8, background:"#3a0f0f", border:"1px solid #ff6b6b", color:"#ff6b6b", cursor:"pointer", fontWeight:700 }}>Liberar</button>
              </div>
            </div>
          </div>
        )}

        {/* Cabecera */}
        <div style={{ background:"rgba(0,0,0,0.7)", padding:"16px 18px", display:"flex", alignItems:"center", gap:12, borderBottom:"1px solid rgba(212,168,67,0.12)", position:"sticky", top:0, zIndex:100 }}>
          <button onClick={() => setVista("admin")} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(212,168,67,0.25)", color:"#A89878", padding:"6px 14px", borderRadius:8, cursor:"pointer" }}>←</button>
          <div>
            <div style={{ color:"#D4A843", fontWeight:700, fontSize:18, fontFamily:"monospace" }}>Nº {fmt(sel)}</div>
            <div style={{ fontSize:12, color:c.text }}>Estado actual: <strong>{c.label}</strong></div>
          </div>
        </div>

        <div style={{ padding:20 }}>
          {/* Cambio rápido */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:11, color:"#A89878", marginBottom:10, letterSpacing:1.5, textTransform:"uppercase" }}>Cambiar estado rápido</div>
            <div style={{ display:"flex", gap:8 }}>
              {Object.entries(C).map(([k,v]) => (
                <button key={k} onClick={() => cambiar(sel, k)} style={{
                  flex:1, padding:"10px 4px", borderRadius:10, cursor:"pointer", fontSize:11, fontWeight:700, transition:"all 0.15s",
                  background: actual.status===k ? v.bg : "rgba(255,255,255,0.03)",
                  border: `2px solid ${actual.status===k ? v.border : "rgba(255,255,255,0.07)"}`,
                  color: actual.status===k ? v.text : "#5a4a2a",
                }}>
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Formulario */}
          <div style={{ background:"rgba(212,168,67,0.04)", border:"1px solid rgba(212,168,67,0.12)", borderRadius:16, padding:20 }}>
            <div style={{ fontSize:13, color:"#D4A843", fontWeight:700, marginBottom:16, letterSpacing:1 }}>📋 Datos del Comprador</div>
            {[
              { key:"nombre",   label:"Nombre completo *", type:"text",  ph:"Ej: María García" },
              { key:"telefono", label:"Teléfono",          type:"tel",   ph:"Ej: +593 99 123 4567" },
              { key:"email",    label:"Email",             type:"email", ph:"maria@email.com" },
              { key:"notas",    label:"Notas",             type:"text",  ph:"Observaciones..." },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:14 }}>
                <label style={{ fontSize:12, color:"#A89878", display:"block", marginBottom:5 }}>{f.label}</label>
                <input
                  type={f.type} placeholder={f.ph}
                  value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={estiloInput}
                />
              </div>
            ))}

            <div style={{ display:"flex", gap:10, marginTop:20 }}>
              <button onClick={() => guardar(sel, "reservado")} style={{ flex:1, padding:13, borderRadius:10, background:"#3a2800", border:"2px solid #c8960a", color:"#ffd966", fontWeight:700, cursor:"pointer", fontSize:14 }}>
                Reservar
              </button>
              <button onClick={() => guardar(sel, "vendido")} style={{ flex:1, padding:13, borderRadius:10, background:"#1a0d00", border:"2px solid #D4A843", color:"#D4A843", fontWeight:700, cursor:"pointer", fontSize:14 }}>
                ✓ Vendido
              </button>
            </div>

            {actual.status !== "disponible" && (
              <button onClick={() => setConfirmDel(sel)} style={{ width:"100%", marginTop:12, padding:10, borderRadius:10, background:"transparent", border:"1px solid rgba(255,107,107,0.3)", color:"#ff6b6b", cursor:"pointer", fontSize:13 }}>
                🗑 Liberar número
              </button>
            )}
          </div>

          {/* Datos actuales del comprador */}
          {actual.comprador?.nombre && (
            <div style={{ marginTop:16, background:"rgba(212,168,67,0.05)", border:"1px solid rgba(212,168,67,0.18)", borderRadius:12, padding:16 }}>
              <div style={{ fontSize:12, color:"#D4A843", marginBottom:8 }}>👤 Comprador registrado</div>
              {[
                { key:"nombre",   label:"Nombre" },
                { key:"telefono", label:"Teléfono" },
                { key:"email",    label:"Email" },
                { key:"notas",    label:"Notas" },
              ].filter(f => actual.comprador[f.key]).map(f => (
                <div key={f.key} style={{ fontSize:13, color:"#E8E0CC", marginBottom:4 }}>
                  <span style={{ color:"#A89878", marginRight:8 }}>{f.label}:</span>
                  {actual.comprador[f.key]}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
