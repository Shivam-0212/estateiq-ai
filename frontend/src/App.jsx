import { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import ReactMarkdown from "react-markdown";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Cell, ResponsiveContainer, RadialBarChart, RadialBar
} from "recharts";

const API = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const USD_TO_INR = 84.5;

const CITY_ZIP = {"Algona":[98001],"Auburn":[98001,98002,98092],"Beaux Arts Village":[98004],"Bellevue":[98004,98005,98006,98007,98008],"Black Diamond":[98010],"Bothell":[98011,98028],"Burien":[98146,98148,98166,98168],"Carnation":[98014],"Clyde Hill":[98004],"Covington":[98042],"Des Moines":[98148,98198],"Duvall":[98019],"Enumclaw":[98022],"Fall City":[98024],"Federal Way":[98001,98003,98023],"Inglewood-Finn Hill":[98034],"Issaquah":[98027,98029,98075],"Kenmore":[98028],"Kent":[98030,98031,98032,98042],"Kirkland":[98033,98034],"Lake Forest Park":[98155],"Maple Valley":[98038],"Medina":[98039],"Mercer Island":[98040],"Milton":[98354],"Newcastle":[98056,98059],"Normandy Park":[98166,98198],"North Bend":[98045],"Pacific":[98047],"Preston":[98050],"Ravensdale":[98051],"Redmond":[98052,98053,98074],"Renton":[98055,98056,98057,98058,98059],"Sammamish":[98074,98075],"SeaTac":[98168,98188,98198],"Seattle":[98102,98103,98105,98106,98107,98108,98109,98112,98115,98116,98117,98118,98119,98122,98125,98126,98133,98136,98144,98146,98148,98168,98177,98178,98199],"Shoreline":[98133,98155,98177],"Skykomish":[98288],"Snoqualmie":[98065],"Snoqualmie Pass":[98068],"Tukwila":[98168,98178,98188],"Vashon":[98070],"Woodinville":[98072,98077],"Yarrow Point":[98004]};
const CITIES = Object.keys(CITY_ZIP).sort();

const fmtUSD = (n) => n == null ? "—" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const fmtINR = (n) => {
  if (n == null) return "—";
  let inr = Number(n) * USD_TO_INR;
  if (inr >= 10000000) return `₹${(inr / 10000000).toFixed(2)} Cr`;
  return `₹${(inr / 100000).toFixed(2)} L`;
};
const fmtCur = (n, inr) => inr ? fmtINR(n) : fmtUSD(n);
const pct = (n) => n == null ? "—" : `${n > 0 ? "+" : ""}${Number(n).toFixed(1)}%`;

const GRADE = {
  A: { color: "#C9922A", glow: "rgba(201,146,42,0.18)", label: "Excellent" },
  B: { color: "#2EA89C", glow: "rgba(46,168,156,0.16)", label: "Good" },
  C: { color: "#D4974A", glow: "rgba(212,151,74,0.16)", label: "Moderate" },
  D: { color: "#CC6B3D", glow: "rgba(204,107,61,0.16)", label: "Caution" },
  F: { color: "#C44B2E", glow: "rgba(196,75,46,0.16)", label: "Avoid" },
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/* ══════════════ CSS ══════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600;700&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;}
  body{
    background:#12100E;
    color:#EDE8DF;
    font-family:'DM Sans',sans-serif;
    -webkit-font-smoothing:antialiased;
    min-height:100vh;
  }
  ::selection{background:rgba(201,146,42,0.28);}
  ::-webkit-scrollbar{width:5px}
  ::-webkit-scrollbar-track{background:rgba(255,255,255,0.04)}
  ::-webkit-scrollbar-thumb{background:rgba(201,146,42,0.35);border-radius:4px}
  select option{background:#1E1C19;color:#EDE8DF;}

  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes drift1{0%,100%{transform:translate(0,0)}33%{transform:translate(60px,-80px)}66%{transform:translate(-30px,50px)}}
  @keyframes drift2{0%,100%{transform:translate(0,0)}33%{transform:translate(-70px,40px)}66%{transform:translate(40px,-50px)}}
  @keyframes drift3{0%,100%{transform:translate(0,0)}50%{transform:translate(30px,-35px)}}
  @keyframes shimmer{0%{background-position:200% center}100%{background-position:-200% center}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes slideRight{from{width:0}to{width:100%}}
  @keyframes countUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes particleFloat{0%{transform:translateY(100vh) translateX(0);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateY(-10vh) translateX(var(--drift));opacity:0}}
  @keyframes gradientShift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}

  .orb{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}
  .orb1{width:800px;height:800px;top:-300px;right:-200px;background:radial-gradient(circle,rgba(201,146,42,0.07) 0%,transparent 65%);animation:drift1 25s ease-in-out infinite;}
  .orb2{width:600px;height:600px;bottom:-200px;left:-150px;background:radial-gradient(circle,rgba(46,168,156,0.06) 0%,transparent 65%);animation:drift2 30s ease-in-out infinite;}
  .orb3{width:400px;height:400px;top:40%;left:30%;background:radial-gradient(circle,rgba(201,146,42,0.04) 0%,transparent 65%);animation:drift3 18s ease-in-out infinite;}

  .fade-up{animation:fadeUp 0.6s cubic-bezier(0.22,1,0.36,1) forwards;}
  .fade-up-1{animation:fadeUp 0.6s 0.1s cubic-bezier(0.22,1,0.36,1) both;}
  .fade-up-2{animation:fadeUp 0.6s 0.2s cubic-bezier(0.22,1,0.36,1) both;}
  .fade-up-3{animation:fadeUp 0.6s 0.3s cubic-bezier(0.22,1,0.36,1) both;}
  .fade-up-4{animation:fadeUp 0.6s 0.4s cubic-bezier(0.22,1,0.36,1) both;}
  .fade-up-5{animation:fadeUp 0.6s 0.5s cubic-bezier(0.22,1,0.36,1) both;}

  .card{
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:20px;
    transition:border-color 0.3s,background 0.3s,transform 0.25s,box-shadow 0.3s;
  }
  .card:hover{
    background:rgba(255,255,255,0.06);
    border-color:rgba(255,255,255,0.14);
  }
  .card-gold{border-color:rgba(201,146,42,0.2)!important;}
  .card-gold:hover{border-color:rgba(201,146,42,0.45)!important;box-shadow:0 4px 32px rgba(201,146,42,0.08)!important;}

  .inp{
    width:100%;
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:14px;
    padding:13px 16px;
    color:#EDE8DF;
    font-size:14.5px;
    font-family:'DM Sans',sans-serif;
    outline:none;
    transition:border-color 0.25s,box-shadow 0.25s,background 0.25s;
  }
  .inp:hover{background:rgba(255,255,255,0.07);border-color:rgba(255,255,255,0.16);}
  .inp:focus{border-color:rgba(201,146,42,0.6);box-shadow:0 0 0 3px rgba(201,146,42,0.1);background:rgba(255,255,255,0.07);}
  .inp-sel{
    appearance:none;
    background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='7' viewBox='0 0 12 7'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23C9922A' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
    background-repeat:no-repeat;
    background-position:right 14px center;
    padding-right:38px!important;
    cursor:pointer;
  }
  input[type=number]::-webkit-inner-spin-button{opacity:0}

  .btn-primary{
    background:linear-gradient(135deg,#C9922A,#E8B84B);
    border:none;
    border-radius:14px;
    color:#12100E;
    font-weight:700;
    font-family:'DM Sans',sans-serif;
    cursor:pointer;
    transition:transform 0.25s,box-shadow 0.25s,filter 0.25s;
    box-shadow:0 6px 28px rgba(201,146,42,0.32);
    letter-spacing:0.3px;
  }
  .btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(201,146,42,0.45);filter:brightness(1.05);}
  .btn-primary:active{transform:translateY(0);}
  .btn-primary:disabled{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.3);cursor:not-allowed;transform:none;box-shadow:none;filter:none;}

  .btn-ghost{
    background:transparent;
    border:1px solid rgba(255,255,255,0.12);
    border-radius:12px;
    color:rgba(237,232,223,0.6);
    font-family:'DM Sans',sans-serif;
    cursor:pointer;
    transition:all 0.25s;
  }
  .btn-ghost:hover{border-color:rgba(201,146,42,0.5);color:#C9922A;background:rgba(201,146,42,0.07);}

  .step-indicator{
    display:flex;align-items:center;gap:0;
  }
  .step-dot{
    width:36px;height:36px;border-radius:50%;
    display:flex;align-items:center;justify-content:center;
    font-size:13px;font-weight:700;
    transition:all 0.4s cubic-bezier(0.22,1,0.36,1);
    position:relative;z-index:1;
    cursor:default;
  }
  .step-dot.done{background:linear-gradient(135deg,#C9922A,#E8B84B);color:#12100E;box-shadow:0 4px 16px rgba(201,146,42,0.35);}
  .step-dot.active{background:rgba(201,146,42,0.15);border:2px solid #C9922A;color:#C9922A;box-shadow:0 0 0 4px rgba(201,146,42,0.12);}
  .step-dot.todo{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:rgba(237,232,223,0.3);}
  .step-line{height:1px;flex:1;transition:background 0.4s;}
  .step-line.done{background:linear-gradient(90deg,#C9922A,rgba(201,146,42,0.3));}
  .step-line.todo{background:rgba(255,255,255,0.07);}

  .markdown-body {
    font-family: inherit;
    line-height: 1.5;
  }
  .markdown-body p {
    margin-bottom: 8px;
  }
  .markdown-body p:last-child {
    margin-bottom: 0;
  }
  .markdown-body strong {
    color: #C9922A;
    font-weight: 700;
  }
  .markdown-body ul {
    margin-left: 18px;
    margin-bottom: 8px;
    list-style-type: disc;
  }
  .markdown-body li {
    margin-bottom: 4px;
  }
  .markdown-body h1, .markdown-body h2, .markdown-body h3 {
    margin-bottom: 10px;
    font-family: 'DM Serif Display', serif;
    color: #EDE8DF;
  }

  .stepper-ctrl{
    display:flex;align-items:center;
    background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:14px;overflow:hidden;
    transition:border-color 0.25s;
  }
  .stepper-ctrl:hover{border-color:rgba(255,255,255,0.18);}
  .step-btn{
    background:none;border:none;color:#C9922A;
    font-size:20px;width:46px;height:46px;
    cursor:pointer;font-weight:300;
    transition:background 0.2s;
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;
  }
  .step-btn:hover{background:rgba(201,146,42,0.12);}

  .tag{
    display:inline-flex;align-items:center;gap:7px;
    border-radius:100px;padding:6px 16px;
    font-size:10px;letter-spacing:2px;
    text-transform:uppercase;font-weight:600;
  }

  .label{
    display:block;
    font-size:10px;
    letter-spacing:2px;
    text-transform:uppercase;
    color:rgba(237,232,223,0.38);
    font-weight:600;
    margin-bottom:9px;
  }

  .bar-fill{
    height:7px;border-radius:5px;
    transition:width 1.4s cubic-bezier(0.22,1,0.36,1);
  }

  .feature-pill{
    display:flex;align-items:center;gap:10px;
    padding:10px 18px;
    background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.08);
    border-radius:100px;
    font-size:12px;color:rgba(237,232,223,0.55);
    transition:all 0.25s;white-space:nowrap;
  }
  .feature-pill:hover{border-color:rgba(201,146,42,0.35);color:#C9922A;background:rgba(201,146,42,0.06);}

  .ins-card{
    display:flex;gap:12px;align-items:flex-start;
    border-radius:14px;padding:14px 16px;
    transition:transform 0.2s;
  }
  .ins-card:hover{transform:translateX(3px);}

  .nav-stat{text-align:center;padding:0 14px;border-right:1px solid rgba(255,255,255,0.08);}
  .nav-stat:last-child{border-right:none;}

  .shimmer-text{
    background:linear-gradient(90deg,#C9922A 0%,#F5D07A 30%,#C9922A 60%,#E8B84B 100%);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:shimmer 4s linear infinite;
  }

  .particle{
    position:absolute;
    width:2px;height:2px;
    border-radius:50%;
    background:rgba(201,146,42,0.6);
    pointer-events:none;
    animation:particleFloat var(--dur) ease-in-out infinite;
    animation-delay:var(--delay);
  }

  .grid-bg{
    position:absolute;inset:0;
    background-image:
      linear-gradient(rgba(201,146,42,0.025) 1px,transparent 1px),
      linear-gradient(90deg,rgba(201,146,42,0.025) 1px,transparent 1px);
    background-size:72px 72px;
  }

  .noise{
    position:absolute;inset:0;
    opacity:0.03;
    background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
    background-size:200px 200px;
  }

  .result-hero{
    background:linear-gradient(135deg,rgba(201,146,42,0.08) 0%,rgba(46,168,156,0.05) 100%);
    border:1px solid rgba(201,146,42,0.2);
  }

  @media(max-width:768px){
    .hide-mob{display:none!important;}
    .grid-2{grid-template-columns:1fr!important;}
    .grid-3{grid-template-columns:1fr 1fr!important;}
    .grid-4{grid-template-columns:1fr 1fr!important;}
  }
`;

/* ══ Background ══ */
function Background() {
  const particles = Array.from({length: 18}, (_,i) => ({
    id: i,
    left: `${Math.random()*100}%`,
    dur: `${15 + Math.random()*20}s`,
    delay: `${-Math.random()*20}s`,
    drift: `${(Math.random()-0.5)*120}px`,
  }));
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,pointerEvents:"none",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,#14120F 0%,#1A1712 40%,#12100E 100%)"}}/>
      <div className="grid-bg"/>
      <div className="noise"/>
      <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>
      {particles.map(p=>(
        <div key={p.id} className="particle" style={{left:p.left,"--dur":p.dur,"--delay":p.delay,"--drift":p.drift}}/>
      ))}
      <div style={{position:"absolute",bottom:0,left:0,right:0,height:"200px",background:"linear-gradient(to top,#12100E,transparent)"}}/>
    </div>
  );
}

/* ══ Animated Counter ══ */
function Counter({ to, prefix="", suffix="", dec=0, dur=1200 }) {
  const [v,setV]=useState(0);
  const t0=useRef(null),raf=useRef(null);
  useEffect(()=>{
    if(!to) return;
    const target=Number(to); t0.current=null;
    const tick=(ts)=>{
      if(!t0.current) t0.current=ts;
      const p=Math.min((ts-t0.current)/dur,1);
      const e=1-Math.pow(1-p,4);
      setV(+(target*e).toFixed(dec));
      if(p<1) raf.current=requestAnimationFrame(tick);
    };
    raf.current=requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf.current);
  },[to]);
  return <>{prefix}{v.toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec})}{suffix}</>;
}

/* ══ Score Ring ══ */
function ScoreRing({ score, grade }) {
  const c = GRADE[grade]||GRADE.C;
  return (
    <div style={{position:"relative",width:150,height:150,flexShrink:0}}>
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart cx="50%" cy="50%" innerRadius="68%" outerRadius="100%" startAngle={90} endAngle={-270} data={[{v:score},{v:100-score}]} barSize={11}>
          <RadialBar dataKey="v" cornerRadius={5} background={{fill:"rgba(255,255,255,0.05)"}}>
            <Cell fill={c.color}/><Cell fill="transparent"/>
          </RadialBar>
        </RadialBarChart>
      </ResponsiveContainer>
      <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:2}}>
        <span style={{fontSize:36,fontWeight:700,color:c.color,fontFamily:"'DM Serif Display',serif",lineHeight:1}}>{score}</span>
        <span style={{fontSize:9,color:"rgba(237,232,223,0.3)",letterSpacing:2}}>/100</span>
        <span style={{fontSize:10,fontWeight:700,color:c.color,letterSpacing:2.5,textTransform:"uppercase",marginTop:2}}>Grade {grade}</span>
      </div>
    </div>
  );
}

/* ══ Stepper control ══ */
function Stepper({ label, value, onChange, min=0, max=20, step=1 }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="stepper-ctrl">
        <button className="step-btn" onClick={()=>onChange(Math.max(min,+(value-step).toFixed(2)))}>−</button>
        <span style={{flex:1,textAlign:"center",color:"#EDE8DF",fontWeight:700,fontSize:16}}>{value}</span>
        <button className="step-btn" onClick={()=>onChange(Math.min(max,+(value+step).toFixed(2)))}>+</button>
      </div>
    </div>
  );
}

/* ══ Field helpers ══ */
function Sel({ label, name, value, onChange, options, placeholder="" }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <select name={name} value={value} onChange={onChange} className="inp inp-sel">
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(([v,l])=><option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
function Inp({ label, name, value, onChange, placeholder="", min, max, step=1 }) {
  return (
    <div>
      {label && <label className="label">{label}</label>}
      <input type="number" name={name} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} step={step} className="inp"/>
    </div>
  );
}

/* ══ Currency toggle ══ */
function CurrencyToggle({ inr, setInr }) {
  return (
    <button onClick={()=>setInr(x=>!x)} style={{
      display:"flex",alignItems:"center",gap:6,
      background:inr?"rgba(201,146,42,0.1)":"rgba(46,168,156,0.1)",
      border:`1px solid ${inr?"rgba(201,146,42,0.35)":"rgba(46,168,156,0.35)"}`,
      borderRadius:100,padding:"8px 18px",cursor:"pointer",
      color:inr?"#C9922A":"#2EA89C",fontSize:12,fontWeight:700,
      fontFamily:"'DM Sans',sans-serif",transition:"all 0.3s",letterSpacing:0.6
    }}>
      <span>{inr?"₹":"$"}</span>
      <span>{inr?"INR":"USD"}</span>
      <span style={{opacity:0.6,fontSize:10}}>⇄</span>
    </button>
  );
}

/* ══ Nav ══ */
function Nav({ onBack, inr, setInr, marketData }) {
  return (
    <nav style={{
      display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"16px 40px",
      borderBottom:"1px solid rgba(255,255,255,0.06)",
      background:"rgba(18,16,14,0.7)",
      backdropFilter:"blur(20px)",
      position:"sticky",top:0,zIndex:100,
    }}>
      <div style={{width:120}}>
        {onBack && (
          <button className="btn-ghost" onClick={onBack} style={{padding:"8px 16px",fontSize:13,display:"flex",alignItems:"center",gap:6}}>
            ← Back
          </button>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{
          width:36,height:36,borderRadius:10,
          background:"linear-gradient(135deg,#C9922A,#E8B84B)",
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:16,boxShadow:"0 4px 20px rgba(201,146,42,0.35)",
        }}>🏛</div>
        <span style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:"#EDE8DF",letterSpacing:0.5}}>EstateIQ</span>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14,width:120,justifyContent:"flex-end"}}>
        <CurrencyToggle inr={inr} setInr={setInr}/>
      </div>
    </nav>
  );
}

/* ══ Insight card ══ */
function Insight({ type, text }) {
  const s = {
    positive: { icon:"▲", c:"#2EA89C", bg:"rgba(46,168,156,0.07)", b:"rgba(46,168,156,0.2)" },
    negative: { icon:"▼", c:"#C44B2E", bg:"rgba(196,75,46,0.07)", b:"rgba(196,75,46,0.2)" },
    neutral: { icon:"◆", c:"#9A8F7E", bg:"rgba(154,143,126,0.06)", b:"rgba(154,143,126,0.15)" },
  }[type] || {};
  return (
    <div className="ins-card" style={{background:s.bg,border:`1px solid ${s.b}`}}>
      <span style={{color:s.c,fontWeight:900,fontSize:9,marginTop:4,flexShrink:0}}>{s.icon}</span>
      <span style={{fontSize:13,color:"rgba(237,232,223,0.68)",lineHeight:1.6}}>{text}</span>
    </div>
  );
}

/* ══ Chart tooltip ══ */
const ChartTip = ({ active, payload, label, inr }) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"rgba(20,18,15,0.96)",border:"1px solid rgba(201,146,42,0.25)",borderRadius:12,padding:"10px 16px",backdropFilter:"blur(16px)"}}>
      <p style={{color:"#C9922A",fontSize:11,marginBottom:4,letterSpacing:1}}>{label}</p>
      <p style={{color:"#EDE8DF",fontSize:15,fontWeight:700}}>{inr?fmtINR(payload[0].value):fmtUSD(payload[0].value)}</p>
    </div>
  );
};

/* ══ Step progress ══ */
function StepProgress({ current, steps }) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:0,maxWidth:400,margin:"0 auto 40px"}}>
      {steps.map((label, i) => (
        <div key={i} style={{display:"flex",alignItems:"center",flex:i<steps.length-1?1:"auto"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7}}>
            <div className={`step-dot ${i<current?"done":i===current?"active":"todo"}`}>
              {i<current ? "✓" : i+1}
            </div>
            <span style={{fontSize:9,letterSpacing:1.5,textTransform:"uppercase",
              color:i<=current?"rgba(201,146,42,0.8)":"rgba(237,232,223,0.25)",
              fontWeight:600,whiteSpace:"nowrap"}}>{label}</span>
          </div>
          {i<steps.length-1 && (
            <div className={`step-line ${i<current?"done":"todo"}`} style={{marginBottom:26,marginLeft:6,marginRight:6}}/>
          )}
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN APP
══════════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState("home");
  const [inr, setInr] = useState(true);
  const [step, setStep] = useState(0);
  const [marketData, setMarketData] = useState(null);
  const [cityData, setCityData] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Chatbot states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleChat = async () => {
    if(!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput("");
    setChatHistory(prev => [...prev, {role: 'user', text: msg}]);
    setChatLoading(true);
    
    try {
      const r = await axios.post(`${API}/chat`, {
        message: msg,
        context: result,
        api_key: "backend_env"
      });
      setChatHistory(prev => [...prev, {role: 'ai', text: r.data.reply}]);
    } catch(e) {
      const errDetail = e.response?.data?.detail || "Error connecting to AI. Please check your Gemini API key.";
      setChatHistory(prev => [...prev, {role: 'ai', text: `Error: ${errDetail}`}]);
    } finally {
      setChatLoading(false);
    }
  };

  const [form, setForm] = useState({
    city:"Seattle", zipcode:98103, address:"",
    bedrooms:3, bathrooms:2, floors:1,
    sqft_living:1500, sqft_lot:5000,
    sqft_above:1500, sqft_basement:0,
    waterfront:0, view:0, condition:3,
    yr_built:2000, yr_renovated:0,
    sale_month:6, asking_price:""
  });

  useEffect(()=>{
    axios.get(`${API}/market-overview`).then(r=>setMarketData(r.data)).catch(()=>{});
    axios.get(`${API}/city-stats/Seattle`).then(r=>setCityData(r.data)).catch(()=>{});
  },[]);

  const onCityChange = async (city) => {
    const zips = CITY_ZIP[city]||[];
    setForm(f=>({...f,city,zipcode:zips[0]||""}));
    if(!city){setCityData(null);return;}
    try{const r=await axios.get(`${API}/city-stats/${encodeURIComponent(city)}`);setCityData(r.data);}
    catch{setCityData(null);}
  };

  const set=(n,v)=>setForm(f=>({...f,[n]:v}));
  const setE=(e)=>{
    const {name,value}=e.target;
    const nums=["sqft_living","sqft_lot","sqft_above","sqft_basement","yr_built","yr_renovated","sale_month","zipcode","floors","waterfront","view","condition"];
    set(name,nums.includes(name)?(value===""?"":Number(value)):value);
  };

  const handleSubmit = async () => {
    setLoading(true);setError("");setResult(null);
    try{
      const payload = { ...form };
      ["sqft_living","sqft_lot","sqft_above","sqft_basement","yr_built","yr_renovated"].forEach(k => {
        if (payload[k] === "") payload[k] = 0;
      });
      const r=await axios.post(`${API}/analyze`,{
        ...payload,
        zipcode:payload.zipcode?Number(payload.zipcode):null,
        asking_price:payload.asking_price?Number(payload.asking_price):null
      });
      setResult(r.data);setScreen("results");
    }catch(e){
      setError(e.response?.data?.detail||"Backend error — is uvicorn running on port 8000?");
    }finally{setLoading(false);}
  };

  const cfg = result?(GRADE[result.investment_grade]||GRADE.C):null;
  const chartData = result?[
    {name:"This Property",value:result.predicted_price,color:"#C9922A"},
    {name:"ZIP Avg",value:result.zip_avg_price,color:"#2EA89C"},
    {name:"City Avg",value:result.city_avg_price,color:"#6B7F8A"},
    {name:"City Median",value:result.city_median_price,color:"#4E6172"},
  ].filter(d=>d.value>0):[];

  const STEPS = ["Location","Property","Quality","Deal"];

  /* ═══ HOME ═══ */
  if(screen==="home") return (
    <div style={{minHeight:"100vh",position:"relative"}}>
      <style>{CSS}</style>
      <Background/>
      <div style={{position:"relative",zIndex:1}}>
        <Nav inr={inr} setInr={setInr} marketData={marketData}/>

        {/* Hero */}
        <div style={{maxWidth:900,margin:"0 auto",padding:"88px 24px 72px",textAlign:"center"}}>

          {/* Badge */}
          <div className="fade-up-1 tag" style={{
            background:"rgba(201,146,42,0.1)",border:"1px solid rgba(201,146,42,0.25)",
            color:"rgba(201,146,42,0.85)",marginBottom:36,
          }}>
            <span style={{width:6,height:6,borderRadius:"50%",background:"#2EA89C",display:"inline-block",animation:"pulse 2s infinite"}}/>
            XGBoost ML · R² 0.84 · King County WA
          </div>

          <h1 className="fade-up-2" style={{
            fontFamily:"'DM Serif Display',serif",
            fontSize:"clamp(44px,6vw,84px)",
            color:"#EDE8DF",
            lineHeight:1.05,
            letterSpacing:-1.5,
            marginBottom:10,
          }}>
            AI-Powered Real Estate
          </h1>
          <h1 className="fade-up-3 shimmer-text" style={{
            fontFamily:"'DM Serif Display',serif",
            fontSize:"clamp(44px,6vw,84px)",
            lineHeight:1.05,
            letterSpacing:-1.5,
            marginBottom:28,
          }}>
            Investment Analysis
          </h1>

          <p className="fade-up-4" style={{
            fontSize:17,color:"rgba(237,232,223,0.45)",
            maxWidth:500,margin:"0 auto 52px",lineHeight:1.85,
          }}>
            Predict property values, score investment potential A–F, and make data-driven decisions using ML trained on {(marketData?.market_stats?.total_properties||4368).toLocaleString()} real transactions.
          </p>

          <button className="fade-up-5 btn-primary" onClick={()=>{setScreen("form");setStep(0);}} style={{padding:"18px 56px",fontSize:16}}>
            Analyze a Property →
          </button>

          {/* Stats row */}
          {marketData && (
            <div className="fade-up-5" style={{
              display:"flex",justifyContent:"center",gap:0,
              marginTop:64,
              background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.07)",
              borderRadius:18,
              maxWidth:520,margin:"64px auto 0",
              overflow:"hidden",
            }}>
              {[
                [`${(marketData.model_metrics?.r2*100||0).toFixed(1)}%`,"Model Accuracy","#C9922A"],
                [(marketData.market_stats?.total_properties||0).toLocaleString(),"Properties","#EDE8DF"],
                [marketData.market_stats?.cities_covered,"Cities Covered","#2EA89C"],
              ].map(([v,l,c],i)=>(
                <div key={l} style={{flex:1,padding:"22px 16px",textAlign:"center",borderRight:i<2?"1px solid rgba(255,255,255,0.07)":"none"}}>
                  <p style={{fontSize:24,fontWeight:700,color:c,fontFamily:"'DM Serif Display',serif"}}>{v}</p>
                  <p style={{fontSize:10,color:"rgba(237,232,223,0.3)",letterSpacing:1.5,textTransform:"uppercase",marginTop:4}}>{l}</p>
                </div>
              ))}
            </div>
          )}

          {/* Feature pills */}
          <div className="fade-up-5" style={{
            display:"flex",flexWrap:"wrap",gap:10,
            justifyContent:"center",marginTop:52,
          }}>
            {[
              ["🧠","ML Price Prediction"],["📊","Investment Scoring A–F"],
              ["🏙","ZIP-Level Analysis"],["💰","ROI & Rental Estimates"],
              ["⚖","Deal Valuation"],["🌏","INR / USD"],
            ].map(([icon,label])=>(
              <div key={label} className="feature-pill">
                <span>{icon}</span><span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  /* ═══ FORM (multi-step) ═══ */
  if(screen==="form") return (
    <div style={{minHeight:"100vh",position:"relative"}}>
      <style>{CSS}</style>
      <Background/>
      <div style={{position:"relative",zIndex:1}}>
        <Nav onBack={()=>setScreen("home")} inr={inr} setInr={setInr}/>

        <div style={{maxWidth:680,margin:"0 auto",padding:"44px 24px 80px"}}>

          {/* Title */}
          <div className="fade-up" style={{textAlign:"center",marginBottom:44}}>
            <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:36,color:"#EDE8DF",marginBottom:8}}>
              Property Details
            </h2>
            <p style={{color:"rgba(237,232,223,0.4)",fontSize:14}}>
              Values in <span style={{color:"#C9922A",fontWeight:600}}>{inr?"Indian Rupees ₹":"US Dollars $"}</span>
            </p>
          </div>

          {/* Step progress */}
          <StepProgress current={step} steps={STEPS}/>

          {/* ── Step 0: Location ── */}
          {step===0 && (
            <div key="s0" className="fade-up">
              <div className="card card-gold" style={{padding:"32px 32px 36px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"rgba(201,146,42,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,border:"1px solid rgba(201,146,42,0.2)"}}>📍</div>
                  <div>
                    <p style={{fontSize:14,fontWeight:600,color:"#EDE8DF"}}>Location</p>
                    <p style={{fontSize:12,color:"rgba(237,232,223,0.35)"}}>Select city — ZIP fills automatically</p>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:24}}>
                  <div>
                    <label className="label">City *</label>
                    <select value={form.city} onChange={e=>onCityChange(e.target.value)} className="inp inp-sel">
                      <option value="">Select city…</option>
                      {CITIES.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">ZIP Code <span style={{color:"#2EA89C",fontSize:8,letterSpacing:1,marginLeft:4}}>AUTO</span></label>
                    <select
                      value={form.zipcode}
                      onChange={e=>set("zipcode",Number(e.target.value))}
                      className="inp inp-sel"
                      disabled={!CITY_ZIP[form.city]?.length}
                      style={{borderColor:"rgba(46,168,156,0.3)",opacity:!CITY_ZIP[form.city]?.length?0.5:1}}
                    >
                      {(CITY_ZIP[form.city]||[]).map(z=><option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                </div>

                {/* City market preview */}
                {cityData && (
                  <div style={{
                    background:"rgba(201,146,42,0.06)",
                    border:"1px solid rgba(201,146,42,0.15)",
                    borderRadius:14,padding:"18px 20px",
                    animation:"fadeIn 0.4s ease",
                  }}>
                    <p style={{fontSize:10,letterSpacing:2,color:"rgba(201,146,42,0.7)",textTransform:"uppercase",fontWeight:600,marginBottom:14}}>📊 {form.city} Market Overview</p>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                      {[
                        ["Avg Price",fmtCur(cityData.city_avg_price,inr)],
                        ["Median",fmtCur(cityData.city_median_price,inr)],
                        [inr?"₹/sqft":"$/sqft",inr?`₹${(cityData.city_avg_ppsf*USD_TO_INR).toFixed(0)}`:  `$${cityData.city_avg_ppsf?.toFixed(0)}`],
                        ["Listings",cityData.city_count?.toLocaleString()],
                      ].map(([k,v])=>(
                        <div key={k} style={{textAlign:"center"}}>
                          <p style={{fontSize:14,fontWeight:700,color:"#C9922A",fontFamily:"'DM Serif Display',serif"}}>{v}</p>
                          <p style={{fontSize:9,color:"rgba(237,232,223,0.3)",letterSpacing:1.5,textTransform:"uppercase",marginTop:3}}>{k}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{display:"flex",justifyContent:"flex-end"}}>
                <button className="btn-primary" onClick={()=>setStep(1)} disabled={!form.city} style={{padding:"14px 36px",fontSize:15}}>
                  Next: Property →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: Property Specs ── */}
          {step===1 && (
            <div key="s1" className="fade-up">
              <div className="card" style={{padding:"32px 32px 36px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"rgba(201,146,42,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,border:"1px solid rgba(201,146,42,0.2)"}}>🏠</div>
                  <div>
                    <p style={{fontSize:14,fontWeight:600,color:"#EDE8DF"}}>Property Specs</p>
                    <p style={{fontSize:12,color:"rgba(237,232,223,0.35)"}}>Rooms, floors, and sizes</p>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18,marginBottom:22}} className="grid-3">
                  <Stepper label="Bedrooms" value={form.bedrooms} onChange={v=>set("bedrooms",v)} min={1} max={10}/>
                  <Stepper label="Bathrooms" value={form.bathrooms} onChange={v=>set("bathrooms",v)} min={1} max={10} step={0.5}/>
                  <Stepper label="Floors" value={form.floors} onChange={v=>set("floors",v)} min={1} max={4} step={0.5}/>
                </div>

                <div style={{height:1,background:"rgba(255,255,255,0.06)",margin:"4px 0 22px"}}/>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}} className="grid-2">
                  <Inp label="Living Area (sqft)" name="sqft_living" value={form.sqft_living} onChange={setE} min={200}/>
                  <Inp label="Lot Size (sqft)" name="sqft_lot" value={form.sqft_lot} onChange={setE} min={500}/>
                  <Inp label="Above Ground (sqft)" name="sqft_above" value={form.sqft_above} onChange={setE} min={0}/>
                  <Inp label="Basement (sqft)" name="sqft_basement" value={form.sqft_basement} onChange={setE} min={0} placeholder="0 if none"/>
                </div>
              </div>

              <div style={{display:"flex",gap:12}}>
                <button className="btn-ghost" onClick={()=>setStep(0)} style={{padding:"14px 28px",fontSize:15,flex:"0 0 auto"}}>← Back</button>
                <button className="btn-primary" onClick={()=>setStep(2)} style={{padding:"14px 36px",fontSize:15,flex:1}}>Next: Quality →</button>
              </div>
            </div>
          )}

          {/* ── Step 2: Quality & Age ── */}
          {step===2 && (
            <div key="s2" className="fade-up">
              <div className="card" style={{padding:"32px 32px 36px",marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:28}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"rgba(201,146,42,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,border:"1px solid rgba(201,146,42,0.2)"}}>⭐</div>
                  <div>
                    <p style={{fontSize:14,fontWeight:600,color:"#EDE8DF"}}>Property Quality</p>
                    <p style={{fontSize:12,color:"rgba(237,232,223,0.35)"}}>Condition and views</p>
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18,marginBottom:22}} className="grid-3">
                  <Sel label="Condition (1–5)" name="condition" value={form.condition} onChange={setE}
                    options={[[1,"1 — Poor"],[2,"2 — Fair"],[3,"3 — Average"],[4,"4 — Good"],[5,"5 — Excellent"]]}/>
                  <Sel label="View Quality (0–4)" name="view" value={form.view} onChange={setE}
                    options={[[0,"0 — None"],[1,"1 — Fair"],[2,"2 — Average"],[3,"3 — Good"],[4,"4 — Excellent"]]}/>
                  <Sel label="Waterfront" name="waterfront" value={form.waterfront} onChange={setE}
                    options={[[0,"No Waterfront"],[1,"Yes — Waterfront"]]}/>
                </div>
              </div>

              <div style={{display:"flex",gap:12}}>
                <button className="btn-ghost" onClick={()=>setStep(1)} style={{padding:"14px 28px",fontSize:15,flex:"0 0 auto"}}>← Back</button>
                <button className="btn-primary" onClick={()=>setStep(3)} style={{padding:"14px 36px",fontSize:15,flex:1}}>Next: Deal Analysis →</button>
              </div>
            </div>
          )}

          {/* ── Step 3: Deal + Submit ── */}
          {step===3 && (
            <div key="s3" className="fade-up">
              {/* Summary card */}
              <div className="card" style={{padding:"24px 28px",marginBottom:16,background:"rgba(255,255,255,0.03)"}}>
                <p style={{fontSize:10,letterSpacing:2,color:"rgba(201,146,42,0.7)",textTransform:"uppercase",fontWeight:600,marginBottom:14}}>📋 Summary</p>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
                  {[
                    ["Location",`${form.city} · ${form.zipcode}`],
                    ["Property",`${form.bedrooms}bd/${form.bathrooms}ba · ${form.floors}fl`],
                    ["Area",`${form.sqft_living.toLocaleString()} sqft`],
                    ["Condition",`${form.condition}/5`],
                  ].map(([k,v])=>(
                    <div key={k} style={{background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 14px"}}>
                      <p style={{fontSize:9,letterSpacing:1.5,color:"rgba(237,232,223,0.3)",textTransform:"uppercase",marginBottom:5}}>{k}</p>
                      <p style={{fontSize:12.5,fontWeight:600,color:"#EDE8DF"}}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card card-gold" style={{padding:"32px 32px 36px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                  <div style={{width:36,height:36,borderRadius:10,background:"rgba(201,146,42,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,border:"1px solid rgba(201,146,42,0.2)"}}>💰</div>
                  <div>
                    <p style={{fontSize:14,fontWeight:600,color:"#EDE8DF"}}>Deal Analysis <span style={{fontSize:11,color:"rgba(237,232,223,0.35)",fontWeight:400,marginLeft:6}}>optional</span></p>
                    <p style={{fontSize:12,color:"rgba(237,232,223,0.35)"}}>Compare seller's asking price vs AI estimate</p>
                  </div>
                </div>

                <p style={{fontSize:12.5,color:"rgba(237,232,223,0.38)",marginBottom:18,lineHeight:1.65}}>
                  Enter the seller's price to instantly see if the property is undervalued or overpriced — leave blank to skip.
                </p>

                <div>
                  <label className="label">Seller's Asking Price (USD)</label>
                  <div style={{position:"relative"}}>
                    <span style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",color:"rgba(237,232,223,0.4)",fontSize:15,fontWeight:500}}>$</span>
                    <input
                      type="number"
                      name="asking_price"
                      value={form.asking_price}
                      onChange={setE}
                      placeholder="e.g. 450000 — leave blank to skip"
                      className="inp"
                      style={{paddingLeft:28}}
                    />
                  </div>
                  {inr && form.asking_price && (
                    <div style={{marginTop:10,padding:"8px 14px",background:"rgba(46,168,156,0.08)",border:"1px solid rgba(46,168,156,0.2)",borderRadius:10,display:"inline-flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:10,color:"rgba(46,168,156,0.7)",letterSpacing:1}}>≈</span>
                      <span style={{fontSize:13,fontWeight:700,color:"#2EA89C"}}>₹{(Number(form.asking_price)*USD_TO_INR/100000).toFixed(2)} Lakhs</span>
                      <span style={{fontSize:11,color:"rgba(237,232,223,0.3)"}}>(₹{(Number(form.asking_price)*USD_TO_INR).toLocaleString()})</span>
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div style={{background:"rgba(196,75,46,0.1)",border:"1px solid rgba(196,75,46,0.3)",borderRadius:14,padding:"14px 18px",marginBottom:16,display:"flex",gap:12,alignItems:"center"}}>
                  <span style={{fontSize:16}}>⚠</span>
                  <p style={{color:"#C44B2E",fontSize:13}}>{error}</p>
                </div>
              )}

              <div style={{display:"flex",gap:12}}>
                <button className="btn-ghost" onClick={()=>setStep(2)} style={{padding:"14px 28px",fontSize:15,flex:"0 0 auto"}}>← Back</button>
                <button
                  className="btn-primary"
                  onClick={handleSubmit}
                  disabled={loading}
                  style={{padding:"18px 32px",fontSize:16,flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}
                >
                  {loading?(
                    <>
                      <span style={{width:18,height:18,border:"2px solid rgba(18,16,14,0.3)",borderTopColor:"#12100E",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite"}}/>
                      Running ML Model…
                    </>
                  ):"🔍 Get Investment Analysis →"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ═══ RESULTS ═══ */
  if(screen==="results" && result) return (
    <div style={{minHeight:"100vh",position:"relative"}}>
      <style>{CSS}</style>
      <Background/>
      <div style={{position:"relative",zIndex:1}}>
        <Nav onBack={()=>setScreen("form")} inr={inr} setInr={setInr}/>

        <div style={{maxWidth:1080,margin:"0 auto",padding:"36px 24px 80px"}}>

          {/* Score Hero */}
          <div className="card result-hero fade-up" style={{padding:"32px 36px",marginBottom:20}}>
            <div style={{display:"grid",gridTemplateColumns:"150px 1fr auto",gap:32,alignItems:"center"}}>
              <ScoreRing score={result.investment_score} grade={result.investment_grade}/>
              <div>
                <div className="tag" style={{
                  background:cfg.glow,border:`1px solid ${cfg.color}40`,
                  color:cfg.color,marginBottom:14,fontSize:10,letterSpacing:2,
                }}>
                  <span style={{width:7,height:7,borderRadius:"50%",background:cfg.color,display:"inline-block"}}/>
                  {cfg.label} Investment · {result.risk_level} Risk
                </div>
                <h2 style={{fontFamily:"'DM Serif Display',serif",fontSize:28,color:"#EDE8DF",marginBottom:10,lineHeight:1.15}}>
                  {result.investment_label}
                </h2>
                <p style={{fontSize:13.5,color:"rgba(237,232,223,0.5)",lineHeight:1.7,maxWidth:520,background:"rgba(255,255,255,0.04)",borderRadius:12,padding:"12px 16px"}}>
                  {result.recommendation}
                </p>
              </div>
              <div style={{textAlign:"right"}}>
                <p style={{fontSize:9,letterSpacing:2.5,color:"rgba(237,232,223,0.3)",textTransform:"uppercase",marginBottom:8}}>AI Predicted Value</p>
                <p style={{fontFamily:"'DM Serif Display',serif",fontSize:40,fontWeight:400,color:cfg.color,lineHeight:1}}>
                  {fmtCur(result.predicted_price, inr)}
                </p>
                <p style={{fontSize:12,color:"rgba(237,232,223,0.3)",marginTop:8}}>
                  {inr?`₹${(result.price_per_sqft*USD_TO_INR).toFixed(0)}`:`$${result.price_per_sqft?.toFixed(0)}`}/sqft
                </p>
              </div>
            </div>
          </div>

          {/* AI Structured Report */}
          {result.ai_summary && typeof result.ai_summary === 'object' && (
            <div className="card fade-up-1" style={{padding:0, overflow:"hidden", marginBottom:20}}>
              <div style={{background:"linear-gradient(135deg,rgba(201,146,42,0.1),rgba(46,168,156,0.05))", padding:"24px 32px", borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{display:"flex", gap:14, alignItems:"center", marginBottom:12}}>
                  <div style={{fontSize:22}}>✨</div>
                  <h3 style={{fontFamily:"'DM Serif Display',serif",fontSize:22,color:"#EDE8DF"}}>Generative AI Report</h3>
                </div>
                <p style={{fontSize:15, color:"rgba(237,232,223,0.8)", lineHeight:1.7}}>
                  {result.ai_summary.summary}
                </p>
              </div>

              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:1, background:"rgba(255,255,255,0.06)"}}>
                <div style={{background:"#12100E", padding:"24px 32px"}}>
                  <p style={{fontSize:12, letterSpacing:2, color:"#2EA89C", textTransform:"uppercase", fontWeight:700, marginBottom:16}}>✅ Strengths & Positives</p>
                  <ul style={{listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:12}}>
                    {result.ai_summary.strengths.map((s,i)=>(
                      <li key={i} style={{fontSize:13.5, color:"rgba(237,232,223,0.6)", display:"flex", gap:10, lineHeight:1.5}}><span style={{color:"#2EA89C"}}>•</span> {s}</li>
                    ))}
                  </ul>
                </div>
                <div style={{background:"#12100E", padding:"24px 32px"}}>
                  <p style={{fontSize:12, letterSpacing:2, color:"#C44B2E", textTransform:"uppercase", fontWeight:700, marginBottom:16}}>⚠ Risks & Considerations</p>
                  <ul style={{listStyle:"none", padding:0, margin:0, display:"flex", flexDirection:"column", gap:12}}>
                    {result.ai_summary.risks.map((r,i)=>(
                      <li key={i} style={{fontSize:13.5, color:"rgba(237,232,223,0.6)", display:"flex", gap:10, lineHeight:1.5}}><span style={{color:"#C44B2E"}}>•</span> {r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{background:"rgba(201,146,42,0.08)", padding:"18px 32px", display:"flex", alignItems:"center", gap:14}}>
                <span style={{fontSize:10, letterSpacing:2, color:"#C9922A", textTransform:"uppercase", fontWeight:700}}>Final Verdict:</span>
                <span style={{fontSize:14, color:"#EDE8DF", fontWeight:500}}>{result.ai_summary.verdict}</span>
              </div>
            </div>
          )}

          {/* Deal Banner */}
          {result.asking_price&&(()=>{
            const isU=result.deal_status==="Undervalued",isO=result.deal_status==="Overvalued";
            const tc=isU?"#2EA89C":isO?"#C44B2E":"#D4974A";
            return(
              <div className="fade-up-1" style={{
                background:isU?"rgba(46,168,156,0.08)":isO?"rgba(196,75,46,0.08)":"rgba(212,151,74,0.08)",
                border:`1px solid ${tc}35`,borderRadius:18,padding:"20px 28px",marginBottom:20,
                display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:14,
              }}>
                <div>
                  <p style={{fontSize:16,fontWeight:700,color:"#EDE8DF",marginBottom:4}}>
                    {isU?"🟢":isO?"🔴":"🟡"} Deal Status: <span style={{color:tc}}>{result.deal_status}</span>
                  </p>
                  <p style={{fontSize:12,color:"rgba(237,232,223,0.38)"}}>
                    Asking {fmtCur(result.asking_price,inr)} · AI Estimate {fmtCur(result.predicted_price,inr)}
                  </p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{fontFamily:"'DM Serif Display',serif",fontSize:32,color:tc}}>
                    {result.price_difference>=0?"+":""}{inr?fmtINR(Math.abs(result.price_difference)):fmtUSD(Math.abs(result.price_difference))}
                  </p>
                  <p style={{fontSize:12,color:tc}}>{pct(result.price_difference_pct)} vs asking price</p>
                </div>
              </div>
            );
          })()}

          {/* Advanced API Metrics */}
          <div className="fade-up-2" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:14,marginBottom:20}} >
            {[
              ["Price / sqft",inr?`₹${(result.price_per_sqft*USD_TO_INR).toFixed(0)}`:`$${result.price_per_sqft?.toFixed(0)}`,"#2EA89C"],
              ["Live Mortgage Rate",`${result.mortgage_rate}%`,"#D4974A"],
            ].map(([label,value,color])=>(
              <div key={label} className="card" style={{padding:"18px 20px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`}}/>
                <p style={{fontSize:9,letterSpacing:2,color:"rgba(237,232,223,0.28)",textTransform:"uppercase",marginBottom:8}}>{label}</p>
                <p style={{fontSize:18,fontWeight:700,color,fontFamily:"'DM Serif Display',serif"}}>{value}</p>
              </div>
            ))}
          </div>

          {/* Financials Row */}
          <div className="fade-up-2" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14,marginBottom:20}} >
            {[
              ["Monthly Rent",fmtCur(result.monthly_rent_estimate,inr),"#2EA89C"],
              ["Est. Mortgage",fmtCur(result.monthly_mortgage,inr),"#C44B2E"],
              ["Cash Flow",fmtCur(result.monthly_cash_flow,inr),"#C9922A"],
              ["Cash-on-Cash ROI",`${result.annual_roi_estimate?.toFixed(1)}%`,"#D4974A"],
            ].map(([label,value,color])=>(
              <div key={label} className="card" style={{padding:"22px 20px",position:"relative",overflow:"hidden"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,${color},transparent)`}}/>
                <p style={{fontSize:9,letterSpacing:2,color:"rgba(237,232,223,0.28)",textTransform:"uppercase",marginBottom:10}}>{label}</p>
                <p style={{fontSize:22,fontWeight:700,color,fontFamily:"'DM Serif Display',serif"}}>{value}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="fade-up-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
            <div className="card" style={{padding:28}}>
              <p style={{fontSize:9,letterSpacing:2.5,color:"rgba(237,232,223,0.28)",textTransform:"uppercase",marginBottom:4}}>Benchmarking</p>
              <p style={{fontFamily:"'DM Serif Display',serif",fontSize:18,color:"#EDE8DF",marginBottom:20}}>Price Comparison</p>
              <ResponsiveContainer width="100%" height={185}>
                <BarChart data={chartData} margin={{top:4,right:8,left:8,bottom:4}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="name" tick={{fill:"rgba(237,232,223,0.28)",fontSize:10}} axisLine={false} tickLine={false}/>
                  <YAxis tickFormatter={v=>inr?`₹${(v*USD_TO_INR/100000).toFixed(0)}L`:`$${(v/1000).toFixed(0)}k`} tick={{fill:"rgba(237,232,223,0.28)",fontSize:10}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTip inr={inr}/>}/>
                  <Bar dataKey="value" radius={[7,7,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.color}/>)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{padding:28}}>
              <p style={{fontSize:9,letterSpacing:2.5,color:"rgba(237,232,223,0.28)",textTransform:"uppercase",marginBottom:4}}>Market Position</p>
              <p style={{fontFamily:"'DM Serif Display',serif",fontSize:18,color:"#EDE8DF",marginBottom:20}}>Relative Pricing</p>
              {chartData.map(row=>{
                const max=Math.max(...chartData.map(d=>d.value));
                const w=(row.value/max*100).toFixed(1);
                return(
                  <div key={row.name} style={{marginBottom:18}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                      <span style={{fontSize:12,color:"rgba(237,232,223,0.42)"}}>{row.name}</span>
                      <span style={{fontSize:12,fontWeight:700,color:row.color}}>{fmtCur(row.value,inr)}</span>
                    </div>
                    <div style={{height:7,background:"rgba(255,255,255,0.05)",borderRadius:5}}>
                      <div className="bar-fill" style={{width:`${w}%`,background:row.color,boxShadow:`0 0 8px ${row.color}60`}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>


          {/* Analyze another */}
          <div className="fade-up-5" style={{textAlign:"center",marginTop:32}}>
            <button className="btn-ghost" onClick={()=>{setScreen("form");setStep(0);}} style={{padding:"14px 36px",fontSize:15}}>
              ← Analyze Another Property
            </button>
          </div>
        </div>
      </div>
      {/* Floating Chatbot Widget */}
      <div style={{position:"fixed", bottom:30, right:30, zIndex:1000, display:"flex", flexDirection:"column", alignItems:"flex-end"}}>
        {/* Chat Window Modal */}
        {chatOpen && (
          <div className="card fade-up" style={{
            width:420, height:600, padding:0, marginBottom:20,
            display:"flex", flexDirection:"column", overflow:"hidden", 
            boxShadow:"0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,146,42,0.15)",
            transformOrigin:"bottom right"
          }}>
            {/* Header */}
            <div style={{background:"linear-gradient(135deg,rgba(201,146,42,0.2),rgba(46,168,156,0.05))", padding:"16px 20px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
              <div style={{display:"flex", gap:10, alignItems:"center"}}>
                <div style={{fontSize:22}}>✨</div>
                <h3 style={{fontFamily:"'DM Serif Display',serif",fontSize:20,color:"#EDE8DF"}}>EstateIQ AI Advisor</h3>
              </div>
              <button onClick={()=>setChatOpen(false)} style={{background:"none",border:"none",color:"#fff",cursor:"pointer",fontSize:26,opacity:0.6,lineHeight:1}}>×</button>
            </div>
            
            {/* Messages */}
            <div style={{flex:1, padding:"20px", display:"flex", flexDirection:"column", gap:20, overflowY:"auto", background:"#12100E"}}>
              {chatHistory.length === 0 ? (
                <div style={{textAlign:"center", padding:"40px 10px"}}>
                  <div style={{fontSize:40, marginBottom:16}}>🤖</div>
                  <h4 style={{fontFamily:"'DM Serif Display',serif",fontSize:18,color:"#EDE8DF", marginBottom:8}}>How can I help?</h4>
                  <p style={{fontSize:13, color:"rgba(237,232,223,0.5)", lineHeight:1.6}}>
                    Ask me anything about this property's ROI, condition penalties, or neighborhood market trends.
                  </p>
                </div>
              ) : (
                chatHistory.map((msg, i) => (
                  <div key={i} style={{alignSelf: msg.role === 'user' ? "flex-end" : "flex-start", maxWidth:"90%"}}>
                    <p style={{fontSize:10, color:msg.role === 'user' ? "#2EA89C" : "#C9922A", marginBottom:6, textTransform:"uppercase", letterSpacing:1.5, fontWeight:700}}>{msg.role === 'user' ? 'You' : 'AI Advisor'}</p>
                    <div style={{
                      background: msg.role === 'user' ? "rgba(46,168,156,0.15)" : "rgba(255,255,255,0.03)",
                      border: msg.role === 'user' ? "1px solid rgba(46,168,156,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      padding:"14px 18px", borderRadius:14, fontSize:13.5, color: msg.role === 'user' ? "#EDE8DF" : "rgba(237,232,223,0.9)",
                      lineHeight:1.6, boxShadow: msg.role !== 'user' ? "inset 0 0 20px rgba(0,0,0,0.5)" : "none"
                    }}>
                      {msg.role === 'user' ? (
                        msg.text
                      ) : (
                        <div className="markdown-body">
                          <ReactMarkdown>{msg.text}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
              {chatLoading && (
                <div style={{alignSelf:"flex-start"}}><p style={{fontSize:13, color:"rgba(201,146,42,0.8)", fontWeight:600, animation:"pulse 1.5s infinite"}}>Thinking...</p></div>
              )}
              <div ref={chatEndRef} />
            </div>
            
            {/* Input */}
            <div style={{padding:"14px", background:"rgba(255,255,255,0.02)", borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:8}}>
              <input type="text" value={chatInput} onChange={(e)=>setChatInput(e.target.value)} onKeyDown={(e)=>e.key==='Enter' && handleChat()} placeholder="Ask a question..." className="inp" style={{flex:1, fontSize:13, padding:"10px 14px"}} />
              <button className="btn-primary" onClick={handleChat} disabled={chatLoading || !chatInput.trim()} style={{padding:"0 16px", borderRadius:8}}>
                ➤
              </button>
            </div>
          </div>
        )}
        
        {/* FAB */}
        <button 
          onClick={()=>setChatOpen(!chatOpen)}
          className="fade-up-5"
          style={{
            width:64, height:64, borderRadius:32, background:"#2EA89C", border:"none", 
            boxShadow:"0 8px 24px rgba(46,168,156,0.5)", cursor:"pointer", 
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:28,
            transition:"all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            transform: chatOpen ? "scale(0.9) rotate(-15deg)" : "scale(1)"
          }}
        >
          {chatOpen ? "×" : "💬"}
        </button>
      </div>
    </div>
  );

  return null;
}
