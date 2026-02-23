import { useState, useRef, useEffect } from "react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { api } from "./api.js";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const FABRICS = ["Jersey 30/1","Jersey 24/1","Interlock","Frisa","Rústica","Lycra","Piqué","Denim","Gabardina","Lino"];
const STAGES = [
  { id:"comprar_tela",  label:"Comprar Tela",  short:"Tela",    color:"#a78bfa" },
  { id:"tela_en_corte", label:"Tela en Corte", short:"Corte",   color:"#60a5fa" },
  { id:"confeccion",    label:"Confección",    short:"Confec.", color:"#fbbf24" },
  { id:"estampado",     label:"Estampado",     short:"Estampa", color:"#fb923c" },
  { id:"finishing",     label:"Finishing",     short:"Finish",  color:"#f472b6" },
  { id:"terminado",     label:"Terminado",     short:"✓ Listo", color:"#34d399" },
];
const STAGE_TASKS = {
  comprar_tela:[
    {id:"ct1",text:"Calcular metraje necesario según cantidad y peso de prendas"},
    {id:"ct2",text:"Cotizar tela con proveedor"},
    {id:"ct3",text:"Pagar la tela"},
    {id:"ct4",text:"Coordinar envío / retiro de tela al taller"},
    {id:"ct5",text:"Confirmar recepción de tela en taller"},
  ],
  tela_en_corte:[
    {id:"tc1",text:"Anotar fecha de inicio de corte"},
    {id:"tc2",text:"Confirmar moldes con el cortador"},
    {id:"tc3",text:"Verificar separaciones por talle y color"},
    {id:"tc4",text:"Anotar fecha estimada de fin de corte"},
    {id:"tc5",text:"Hacer seguimiento con el taller"},
  ],
  confeccion:[
    {id:"co1",text:"Anotar fecha de inicio de confección"},
    {id:"co2",text:"Coordinar entrega de tela cortada al confeccionista"},
    {id:"co3",text:"Coordinar con estampador (si va antes de confección)"},
    {id:"co4",text:"Pagar corte y confección"},
    {id:"co5",text:"Anotar fecha estimada de fin de confección"},
  ],
  estampado:[
    {id:"es1",text:"Enviar arte finalizado al estampador"},
    {id:"es2",text:"Coordinar fecha de entrega al estampador"},
    {id:"es3",text:"Confirmar tipo de estampa (serigrafía, DTG, bordado, etc.)"},
    {id:"es4",text:"Anotar fecha estimada de fin de estampado"},
    {id:"es5",text:"Coordinar finishing post-estampa"},
    {id:"es6",text:"Pagar estampado"},
  ],
  finishing:[
    {id:"fi1",text:"Controlar calidad prenda por prenda"},
    {id:"fi2",text:"Verificar talles y colores contra orden"},
    {id:"fi3",text:"Planchar / vaporizar si corresponde"},
    {id:"fi4",text:"Colocar etiquetas y hangtags"},
    {id:"fi5",text:"Pagar finishing"},
    {id:"fi6",text:"Embalar y organizar por modelo/color/talle"},
  ],
  terminado:[
    {id:"te1",text:"Contar stock final y cruzar con orden"},
    {id:"te2",text:"Fotografía de producto"},
    {id:"te3",text:"Cargar en sistema de inventario"},
    {id:"te4",text:"Registrar costo total real de la producción"},
    {id:"te5",text:"Archivar documentación de la producción"},
  ],
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function gid(){ return Math.random().toString(36).substr(2,9); }
function stageOf(id){ return STAGES.find(s=>s.id===id)||STAGES[0]; }
function daysLeft(d){ if(!d) return null; return Math.ceil((new Date(d)-new Date())/86400000); }
function fmtDate(d){ if(!d) return "—"; return new Date(d+"T12:00:00").toLocaleDateString("es-AR",{day:"2-digit",month:"short",year:"numeric"}); }
function unitCostOf(c){ return Object.values(c).reduce((a,v)=>a+Number(v),0); }
function totalUnitsOf(models){ return models.reduce((a,m)=>a+m.variants.reduce((b,v)=>b+(+v.qty||0),0),0); }
function newVariant(){ return {id:gid(),color:"",stamp:"",size:"",qty:0}; }
function newModel(name=""){ return {id:gid(),name,variants:[newVariant()]}; }
function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  bg:"#080808", panel:"#0e0e0e", panelB:"#0b0b0b",
  border:"#1e1e1e", border2:"#272727",
  text:"#e8dfd2", textSub:"#a09080", muted:"#585858",
  gold:"#d4a843", goldL:"#f0c96a",
  green:"#34d399", red:"#f87171", amber:"#fbbf24",
};

// ─── CSS ─────────────────────────────────────────────────────────────────────
const GCS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=DM+Mono:wght@300;400;500&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{min-height:100%;background:${C.bg};}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:${C.bg}}::-webkit-scrollbar-thumb{background:#2a2a2a;border-radius:3px}
.hov{transition:border-color .2s,transform .15s;cursor:pointer;}
.hov:hover{border-color:#363636!important;transform:translateY(-1px);}
.hov-row{transition:background .15s;cursor:pointer;}
.hov-row:hover{background:#141414;}
.task-row{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid #151515;cursor:pointer;transition:background .15s;}
.task-row:last-child{border-bottom:none;}
.task-row:hover{background:#111;margin:0 -20px;padding-left:20px;padding-right:20px;}
.chk{width:17px;height:17px;border:1.5px solid #333;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.chk.done{background:${C.gold};border-color:${C.gold};}
.pbg{height:3px;background:#191919;width:100%;}
.pfill{height:3px;transition:width .5s ease;}
.inp{background:#070707;border:1px solid #232323;color:${C.text};padding:11px 13px;width:100%;font-size:13px;font-family:'DM Mono',monospace;outline:none;transition:border-color .2s;}
.inp:focus{border-color:#404040;}
.inp::placeholder{color:#252525;}
.inp-sm{background:#070707;border:1px solid #1e1e1e;color:${C.text};padding:8px 10px;font-size:12px;font-family:'DM Mono',monospace;outline:none;transition:border-color .2s;width:100%;}
.inp-sm:focus{border-color:#383838;}
.inp-sm::placeholder{color:#282828;}
select.inp option,select.inp-sm option{background:#0e0e0e;}
.btn-p{background:${C.gold};color:#080808;border:none;padding:12px 28px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;font-weight:500;cursor:pointer;transition:background .2s;}
.btn-p:hover{background:${C.goldL};}
.btn-g{background:transparent;color:${C.gold};border:1px solid #2a2a2a;padding:10px 20px;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:border-color .2s,color .2s;}
.btn-g:hover{border-color:#444;color:${C.goldL};}
.btn-d{background:#130909;color:#f87171;border:1px solid #2a1010;padding:8px 14px;font-family:'DM Mono',monospace;font-size:10px;cursor:pointer;transition:background .15s;letter-spacing:1px;}
.btn-d:hover{background:#1e0c0c;}
.btn-sm{background:transparent;border:1px solid #232323;color:#555;padding:6px 12px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;cursor:pointer;transition:all .2s;}
.btn-sm:hover{border-color:#444;color:#888;}
.stage-step{display:flex;flex-direction:column;align-items:center;flex:1;position:relative;}
.stage-step:not(:last-child)::after{content:'';position:absolute;top:14px;left:calc(50% + 15px);width:calc(100% - 30px);height:1px;background:#1c1c1c;}
.stage-dot{width:28px;height:28px;border-radius:50%;border:2px solid #1e1e1e;display:flex;align-items:center;justify-content:center;font-size:10px;transition:all .3s;}
.menu-item{display:flex;align-items:center;gap:14px;padding:15px 24px;cursor:pointer;transition:background .15s;border-left:3px solid transparent;}
.menu-item:hover{background:#0f0f0f;border-left-color:#333;}
.menu-item.active{background:#131313;border-left-color:${C.gold};}
.period-btn{background:transparent;border:1px solid #252525;color:#555;padding:8px 18px;font-family:'DM Mono',monospace;font-size:9px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;transition:all .2s;}
.period-btn:hover{border-color:#444;color:#999;}
.period-btn.active{background:${C.gold}18;border-color:${C.gold}55;color:${C.gold};}
.variant-row{display:grid;grid-template-columns:1fr 1.4fr 0.7fr 70px 36px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #141414;}
.variant-row:last-child{border-bottom:none;}
.modal-overlay{position:fixed;inset:0;background:#000000cc;z-index:500;display:flex;align-items:center;justify-content:center;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fu{animation:fadeUp .3s ease forwards;}
@keyframes modalIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
.modal-box{animation:modalIn .2s ease forwards;}
.gantt-bar{height:22px;border-radius:2px;position:absolute;top:50%;transform:translateY(-50%);opacity:.85;transition:opacity .15s;cursor:pointer;}
.gantt-bar:hover{opacity:1;}
.gantt-row{position:relative;height:48px;border-bottom:1px solid #141414;display:flex;align-items:center;}
.gantt-today{position:absolute;top:0;bottom:0;width:1px;background:${C.gold};opacity:.5;pointer-events:none;}
`;

const LBL={display:"block",fontSize:10,letterSpacing:2.5,color:C.muted,textTransform:"uppercase",marginBottom:9,fontFamily:"'DM Mono',monospace"};
const SECT={fontFamily:"'Playfair Display',serif",fontSize:18,color:C.gold,margin:"32px 0 16px",paddingBottom:12,borderBottom:`1px solid ${C.border}`};

// ─── SMALL COMPONENTS ────────────────────────────────────────────────────────
function StagePill({stageId}){
  const st=stageOf(stageId);
  return <span style={{display:"inline-flex",alignItems:"center",gap:7,padding:"5px 14px",background:st.color+"1a",color:st.color,border:`1px solid ${st.color}33`,fontSize:10,letterSpacing:2,textTransform:"uppercase",fontFamily:"'DM Mono',monospace",fontWeight:500}}>
    <span style={{width:6,height:6,borderRadius:"50%",background:st.color}}/>{st.label}
  </span>;
}
function DeadlineBadge({deadline,style={}}){
  const d=daysLeft(deadline); if(d===null) return null;
  const color=d<0?C.red:d<=5?C.amber:C.muted;
  return <span style={{fontSize:10,color,letterSpacing:1.5,fontFamily:"'DM Mono',monospace",textTransform:"uppercase",...style}}>⏱ {d<0?`Vencido ${Math.abs(d)}d`:d===0?"Vence hoy":`${d}d`}</span>;
}
function Stat({value,label,accent}){
  return <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:"26px 24px",position:"relative"}}>
    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:accent||C.gold}}/>
    <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,color:accent||C.gold,lineHeight:1,marginBottom:10}}>{value}</div>
    <div style={{fontSize:11,color:C.textSub,letterSpacing:2.5,textTransform:"uppercase"}}>{label}</div>
  </div>;
}
function Timeline({currentStage}){
  const idx=STAGES.findIndex(s=>s.id===currentStage);
  return <div style={{display:"flex",alignItems:"flex-start",marginBottom:36}}>
    {STAGES.map((st,i)=>{
      const done=i<idx,active=i===idx;
      return <div key={st.id} className="stage-step">
        <div className="stage-dot" style={{borderColor:done||active?st.color:"#1e1e1e",background:done?st.color:active?st.color+"22":"transparent",color:done?"#080808":active?st.color:C.muted}}>{done?"✓":""}</div>
        <div style={{fontSize:8,color:active?st.color:done?"#505050":"#242424",letterSpacing:1,marginTop:8,textAlign:"center",textTransform:"uppercase",maxWidth:58,lineHeight:1.4}}>{st.short}</div>
      </div>;
    })}
  </div>;
}
function Checklist({stageId,tasks,onChange}){
  const list=STAGE_TASKS[stageId]||[];
  const done=list.filter(t=>tasks[t.id]).length;
  const pct=list.length>0?(done/list.length)*100:0;
  const st=stageOf(stageId);
  return <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:26}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
      <div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.text,marginBottom:5}}>Checklist · {st.label}</div>
        <div style={{fontSize:11,color:C.textSub,letterSpacing:2}}>{done}/{list.length} completadas</div>
      </div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:pct===100?C.green:C.gold}}>{Math.round(pct)}%</div>
    </div>
    <div className="pbg" style={{marginBottom:20}}><div className="pfill" style={{width:pct+"%",background:pct===100?C.green:st.color}}/></div>
    {list.map(t=>{
      const checked=!!tasks[t.id];
      return <div key={t.id} className="task-row" onClick={()=>onChange(t.id,!checked)}>
        <div className={`chk ${checked?"done":""}`}>{checked&&<span style={{fontSize:10,color:"#080808",fontWeight:"bold"}}>✓</span>}</div>
        <span style={{fontSize:13,color:checked?C.muted:C.text,textDecoration:checked?"line-through":"none",lineHeight:1.55,fontFamily:"'DM Mono',monospace"}}>{t.text}</span>
      </div>;
    })}
  </div>;
}
function ChartTooltip({active,payload,label}){
  if(!active||!payload?.length) return null;
  return <div style={{background:"#111",border:`1px solid ${C.border2}`,padding:"12px 16px",fontFamily:"'DM Mono',monospace"}}>
    <div style={{fontSize:10,color:C.muted,letterSpacing:2,marginBottom:8}}>{label}</div>
    {payload.map((p,i)=><div key={i} style={{fontSize:12,color:p.color,marginBottom:3}}>{p.name}: <span style={{color:C.text}}>{p.name==="Inversión"?"$":""}{Number(p.value).toLocaleString("es-AR")}</span></div>)}
  </div>;
}

// ─── DELETE CONFIRM MODAL ─────────────────────────────────────────────────────
function DeleteModal({name,onConfirm,onCancel}){
  return <div className="modal-overlay" onClick={onCancel}>
    <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:"#0e0e0e",border:`1px solid #2a1010`,padding:"40px 44px",maxWidth:480,width:"90%"}}>
      <div style={{fontSize:28,color:C.red,marginBottom:8,fontFamily:"'Playfair Display',serif"}}>¿Eliminar producción?</div>
      <div style={{fontSize:13,color:C.textSub,marginBottom:6,lineHeight:1.6}}>Estás por eliminar</div>
      <div style={{fontSize:16,color:C.text,fontFamily:"'Playfair Display',serif",marginBottom:28,padding:"12px 16px",background:"#111",border:`1px solid ${C.border}`}}>"{name}"</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:32}}>Esta acción no se puede deshacer.</div>
      <div style={{display:"flex",gap:14}}>
        <button className="btn-d" style={{flex:1,padding:"13px",fontSize:11,letterSpacing:2}} onClick={onConfirm}>Sí, eliminar</button>
        <button className="btn-g" style={{flex:1}} onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  </div>;
}

// ─── VARIANT TABLE ────────────────────────────────────────────────────────────
function VariantTable({model,modelIdx,onUpdateVariant,onAddVariant,onRemoveVariant}){
  const total=model.variants.reduce((a,v)=>a+(+v.qty||0),0);
  return <div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1.4fr 0.7fr 70px 36px",gap:8,padding:"0 0 8px",borderBottom:`1px solid ${C.border}`}}>
      {["Color","Estampa","Talle","Cant.",""].map((h,i)=><div key={i} style={{fontSize:9,color:C.muted,letterSpacing:2,textTransform:"uppercase"}}>{h}</div>)}
    </div>
    {model.variants.map((v,vi)=>(
      <div key={v.id} className="variant-row">
        <input className="inp-sm" value={v.color} onChange={e=>onUpdateVariant(modelIdx,vi,"color",e.target.value)} placeholder="Ej: Negro…"/>
        <input className="inp-sm" value={v.stamp} onChange={e=>onUpdateVariant(modelIdx,vi,"stamp",e.target.value)} placeholder="Ej: Logo pecho…"/>
        <input className="inp-sm" value={v.size}  onChange={e=>onUpdateVariant(modelIdx,vi,"size", e.target.value)} placeholder="M, XL…"/>
        <input className="inp-sm" type="number" min={0} value={v.qty||""} onChange={e=>onUpdateVariant(modelIdx,vi,"qty",e.target.value)} placeholder="0" style={{textAlign:"center"}}/>
        <button className="btn-d" style={{padding:"6px 8px",border:"none",background:"transparent",color:"#5a2020",cursor:"pointer",fontSize:14}} onClick={()=>onRemoveVariant(modelIdx,vi)}>✕</button>
      </div>
    ))}
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12}}>
      <button className="btn-sm" onClick={()=>onAddVariant(modelIdx)}>+ Agregar fila</button>
      <span style={{fontSize:11,color:C.muted}}>Subtotal: <span style={{color:C.gold,fontFamily:"'Playfair Display',serif",fontSize:15}}>{total}</span> u.</span>
    </div>
  </div>;
}

// ─── VARIANT DETAIL TABLE (read-only) ─────────────────────────────────────────
function VariantDetailTable({models}){
  const allVariants=models.flatMap(m=>m.variants.map(v=>({...v,modelName:m.name})));
  const byColor={};
  allVariants.forEach(v=>{
    if(!byColor[v.color]) byColor[v.color]={};
    if(!byColor[v.color][v.stamp]) byColor[v.color][v.stamp]=[];
    byColor[v.color][v.stamp].push(v);
  });
  return <div>
    {Object.entries(byColor).map(([color,stamps])=>(
      <div key={color} style={{marginBottom:16,background:C.panelB,border:`1px solid ${C.border}`,overflow:"hidden"}}>
        <div style={{padding:"11px 18px",background:"#0a0a0a",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:C.gold}}/>
          <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:C.text}}>{color||"—"}</span>
          <span style={{fontSize:10,color:C.muted,marginLeft:"auto"}}>{Object.values(stamps).flat().reduce((a,v)=>a+(+v.qty||0),0)} u.</span>
        </div>
        {Object.entries(stamps).map(([stamp,variants])=>(
          <div key={stamp} style={{padding:"12px 18px",borderBottom:`1px solid ${C.border}`}}>
            <div style={{fontSize:10,color:C.textSub,letterSpacing:1.5,textTransform:"uppercase",marginBottom:10}}>{stamp||"Sin estampa"}</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
              {variants.map(v=>(
                <div key={v.id} style={{background:"#0f0f0f",border:`1px solid ${C.border2}`,padding:"7px 13px",display:"flex",gap:10,alignItems:"center"}}>
                  <span style={{fontSize:12,color:C.textSub}}>{v.size||"—"}</span>
                  <span style={{width:1,height:12,background:C.border2}}/>
                  <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.gold}}>{v.qty}</span>
                  <span style={{fontSize:10,color:C.muted}}>u.</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>;
}

// ─── PRODUCTION FORM ─────────────────────────────────────────────────────────
function ProductionForm({title,subtitle,data,setData,onSave,onCancel,saveLabel="Guardar",disabled=false}){
  const uc=unitCostOf(data.costs);
  const totalU=totalUnitsOf(data.models);
  function addModel_(){ setData(p=>({...p,models:[...p.models,newModel(`Modelo ${p.models.length+1}`)]})); }
  function removeModel_(mi){ setData(p=>({...p,models:p.models.filter((_,i)=>i!==mi)})); }
  function updateModelName_(mi,name){ setData(p=>{const ms=[...p.models];ms[mi]={...ms[mi],name};return{...p,models:ms};}); }
  function addVariant_(mi){ setData(p=>{const ms=[...p.models];ms[mi]={...ms[mi],variants:[...ms[mi].variants,newVariant()]};return{...p,models:ms};}); }
  function removeVariant_(mi,vi){ setData(p=>{const ms=[...p.models];ms[mi]={...ms[mi],variants:ms[mi].variants.filter((_,i)=>i!==vi)};return{...p,models:ms};}); }
  function updateVariant_(mi,vi,field,val){
    setData(p=>{const ms=[...p.models];const vs=[...ms[mi].variants];vs[vi]={...vs[vi],[field]:field==="qty"?+val:val};ms[mi]={...ms[mi],variants:vs};return{...p,models:ms};});
  }
  return <div style={{maxWidth:980,margin:"0 auto",padding:"44px 36px"}} className="fu">
    <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:38,color:C.text,marginBottom:6}}>{title}</h1>
    <p style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:36}}>{subtitle}</p>
    <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:38}}>
      <div style={SECT}>Datos generales</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18}}>
        <div>
          <label style={LBL}>Nombre del producto *</label>
          <input className="inp" value={data.name} onChange={e=>setData(p=>({...p,name:e.target.value}))} placeholder="Ej: Remera Verano 2025"/>
        </div>
        <div>
          <label style={LBL}>Estado</label>
          <select className="inp" value={data.stage} onChange={e=>setData(p=>({...p,stage:e.target.value}))}>
            {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18,marginTop:16}}>
        <div>
          <label style={LBL}>Fecha de creación</label>
          <input className="inp" type="date" value={data.createdAt} onChange={e=>setData(p=>({...p,createdAt:e.target.value}))}/>
        </div>
        <div>
          <label style={LBL}>Fecha límite de entrega</label>
          <input className="inp" type="date" value={data.deadline} onChange={e=>setData(p=>({...p,deadline:e.target.value}))}/>
        </div>
        <div>
          <label style={LBL}>Tipo de tela</label>
          <select className="inp" value={data.fabric} onChange={e=>setData(p=>({...p,fabric:e.target.value}))}>
            {FABRICS.map(f=><option key={f}>{f}</option>)}
          </select>
        </div>
      </div>
      <div style={{marginTop:16,maxWidth:240}}>
        <label style={LBL}>Peso por prenda (g)</label>
        <input className="inp" type="number" value={data.weightPerUnit||""} onChange={e=>setData(p=>({...p,weightPerUnit:+e.target.value}))} placeholder="180"/>
      </div>
      <div style={SECT}>Costeo unitario</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:14}}>
        {[["tela","Tela"],["estampa","Estampa"],["corte","Corte & Conf."],["avios","Avíos"]].map(([k,l])=>(
          <div key={k}>
            <label style={LBL}>{l} ($)</label>
            <input className="inp" type="number" value={data.costs[k]||""} onChange={e=>setData(p=>({...p,costs:{...p.costs,[k]:+e.target.value}}))}/>
          </div>
        ))}
      </div>
      {uc>0&&<div style={{marginTop:18,background:"#060606",border:`1px solid ${C.gold}20`,padding:"16px 22px",display:"inline-flex",gap:40,alignItems:"center"}}>
        <div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Costo unitario</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:C.gold}}>${uc.toLocaleString("es-AR")}</div>
        </div>
        {totalU>0&&<div>
          <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Total ({totalU} unidades)</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:C.text}}>${(uc*totalU).toLocaleString("es-AR")}</div>
        </div>}
      </div>}
      <div style={SECT}>Modelos · Color / Estampa / Talle</div>
      <div style={{fontSize:12,color:C.muted,marginBottom:20,lineHeight:1.7}}>Cada modelo es una variante del producto. Agregá filas con la combinación exacta de color, estampa, talle y cantidad.</div>
      {data.models.map((m,mi)=>{
        const mTotal=m.variants.reduce((a,v)=>a+(+v.qty||0),0);
        return <div key={m.id} style={{background:"#0a0a0a",border:`1px solid ${C.border}`,padding:24,marginBottom:16}}>
          <div style={{display:"flex",gap:14,alignItems:"center",marginBottom:20}}>
            <div style={{flex:1}}>
              <label style={LBL}>Nombre del modelo</label>
              <input className="inp" value={m.name} onChange={e=>updateModelName_(mi,e.target.value)} placeholder="Ej: Regular Fit, Oversize…"/>
            </div>
            <div style={{textAlign:"right",paddingTop:26}}>
              <div style={{fontSize:10,color:C.muted,letterSpacing:1.5,marginBottom:2}}>SUBTOTAL</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:C.gold}}>{mTotal} u.</div>
            </div>
            {data.models.length>1&&<button className="btn-d" style={{marginTop:22}} onClick={()=>removeModel_(mi)}>✕ Eliminar</button>}
          </div>
          <VariantTable model={m} modelIdx={mi} onUpdateVariant={updateVariant_} onAddVariant={addVariant_} onRemoveVariant={removeVariant_}/>
        </div>;
      })}
      <button className="btn-g" style={{marginBottom:36}} onClick={addModel_}>+ Agregar modelo</button>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:28,display:"flex",gap:14,alignItems:"center"}}>
        <button className="btn-p" onClick={onSave} disabled={disabled} style={{opacity:disabled?0.6:1}}>{saveLabel}</button>
        <button className="btn-g" onClick={onCancel}>Cancelar</button>
        {totalU>0&&<span style={{marginLeft:"auto",fontSize:12,color:C.muted}}>
          Total: <span style={{color:C.gold,fontFamily:"'Playfair Display',serif",fontSize:16}}>{totalU} unidades</span>
          {uc>0&&<span style={{color:C.textSub}}> · ${(uc*totalU).toLocaleString("es-AR")}</span>}
        </span>}
      </div>
    </div>
  </div>;
}

// ─── MONTHLY CALENDAR ─────────────────────────────────────────────────────────
const MONTH_NAMES_ES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DAY_NAMES_ES=["Lu","Ma","Mi","Ju","Vi","Sá","Do"];

function MonthlyCalendar({prods,onClickProd,year,month,onPrev,onNext}){
  const today=new Date(); today.setHours(0,0,0,0);
  const daysInMonth=new Date(year,month+1,0).getDate();
  const firstDow=new Date(year,month,1).getDay();
  const adjustedFirst=(firstDow===0?6:firstDow-1);
  const monthStart=new Date(year,month,1);
  const monthEnd=new Date(year,month,daysInMonth,23,59,59);
  const activeProds=prods.filter(p=>{
    if(!p.createdAt) return false;
    const s=new Date(p.createdAt+"T00:00:00");
    const e=p.deadline?new Date(p.deadline+"T00:00:00"):new Date(today.getTime()+60*86400000);
    return s<=monthEnd && e>=monthStart;
  });
  function prodsForDay(d){
    const dt=new Date(year,month,d); dt.setHours(0,0,0,0);
    return activeProds.filter(p=>{
      const s=new Date(p.createdAt+"T00:00:00");
      const e=p.deadline?new Date(p.deadline+"T00:00:00"):new Date(today.getTime()+60*86400000);
      return s<=dt && e>=dt;
    });
  }
  function isToday(d){ return today.getFullYear()===year&&today.getMonth()===month&&today.getDate()===d; }
  function isStart(p,d){ const s=new Date(p.createdAt+"T00:00:00"); return s.getFullYear()===year&&s.getMonth()===month&&s.getDate()===d; }
  function isEnd(p,d){
    if(!p.deadline) return false;
    const e=new Date(p.deadline+"T00:00:00");
    return e.getFullYear()===year&&e.getMonth()===month&&e.getDate()===d;
  }
  const cells=[];
  for(let i=0;i<adjustedFirst;i++) cells.push(null);
  for(let d=1;d<=daysInMonth;d++) cells.push(d);
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
      <button className="btn-sm" onClick={onPrev}>← Anterior</button>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:C.text,letterSpacing:3,textAlign:"center"}}>
        {MONTH_NAMES_ES[month]}<span style={{color:C.gold,marginLeft:12}}>{year}</span>
      </div>
      <button className="btn-sm" onClick={onNext}>Siguiente →</button>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3,marginBottom:3}}>
      {DAY_NAMES_ES.map(d=>(<div key={d} style={{textAlign:"center",fontSize:9,color:C.muted,letterSpacing:2.5,padding:"8px 0",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`}}>{d}</div>))}
    </div>
    <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:3}}>
      {cells.map((day,i)=>{
        if(!day) return <div key={`e${i}`} style={{minHeight:96}}/>;
        const dayProds=prodsForDay(day);
        const todayF=isToday(day);
        return <div key={day} style={{minHeight:96,background:todayF?"#141000":"#0b0b0b",border:`1px solid ${todayF?C.gold+"55":C.border}`,padding:"7px 8px"}}>
          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:7}}>
            <span style={{fontSize:12,fontFamily:"'DM Mono',monospace",color:todayF?C.gold:"#444",fontWeight:todayF?"600":"normal"}}>{day}</span>
            {todayF&&<span style={{fontSize:7,color:C.gold,letterSpacing:1.5,textTransform:"uppercase",marginTop:1}}>hoy</span>}
          </div>
          {dayProds.slice(0,3).map(p=>{
            const sc=stageOf(p.stage).color;
            const starting=isStart(p,day);
            const ending=isEnd(p,day);
            return <div key={p.id} onClick={()=>onClickProd(p.id)} title={p.name} style={{
              height:18,marginBottom:3,cursor:"pointer",background:sc+"28",
              borderTop:`2px solid ${sc}`,borderBottom:`1px solid ${sc}22`,
              borderLeft:starting?`2px solid ${sc}`:"2px solid transparent",
              borderRight:ending?`2px solid ${sc}`:"2px solid transparent",
              borderRadius:starting&&ending?"3px":starting?"3px 0 0 3px":ending?"0 3px 3px 0":"0",
              display:"flex",alignItems:"center",paddingLeft:starting?6:2,overflow:"hidden",
            }}
            onMouseEnter={e=>e.currentTarget.style.background=sc+"44"}
            onMouseLeave={e=>e.currentTarget.style.background=sc+"28"}
            >
              {starting&&<span style={{fontSize:8,color:sc,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",fontWeight:"500",letterSpacing:.3}}>
                {p.name.length>10?p.name.slice(0,9)+"…":p.name}
              </span>}
            </div>;
          })}
          {dayProds.length>3&&<div style={{fontSize:8,color:C.muted}}>+{dayProds.length-3}</div>}
        </div>;
      })}
    </div>
    {activeProds.length>0&&(
      <div style={{marginTop:24,paddingTop:18,borderTop:`1px solid ${C.border}`}}>
        <div style={{fontSize:9,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:12}}>Producciones en este mes</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {activeProds.map(p=>{
            const sc=stageOf(p.stage).color;
            return <div key={p.id} onClick={()=>onClickProd(p.id)} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",padding:"7px 14px",background:"#0c0c0c",border:`1px solid ${C.border}`,transition:"border-color .15s"}}
            onMouseEnter={e=>e.currentTarget.style.borderColor="#333"}
            onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}
            >
              <div style={{width:10,height:10,borderRadius:2,background:sc,opacity:.85}}/>
              <span style={{fontSize:11,color:C.text,fontFamily:"'DM Mono',monospace"}}>{p.name}</span>
              <span style={{fontSize:9,color:sc,letterSpacing:1.5,textTransform:"uppercase"}}>{stageOf(p.stage).short}</span>
              <span style={{fontSize:9,color:C.muted}}>{fmtDate(p.createdAt)}{p.deadline?` → ${fmtDate(p.deadline)}`:" → en curso"}</span>
            </div>;
          })}
        </div>
      </div>
    )}
    {activeProds.length===0&&(
      <div style={{marginTop:20,paddingTop:16,borderTop:`1px solid ${C.border}`,fontSize:13,color:C.muted,textAlign:"center"}}>Sin producciones activas este mes.</div>
    )}
  </div>;
}

// ─── ANNUAL GANTT ─────────────────────────────────────────────────────────────
function AnnualGantt({prods,onClickProd,year,onPrev,onNext}){
  const today=new Date(); today.setHours(0,0,0,0);
  const yearStart=new Date(year,0,1);
  const yearEnd=new Date(year,11,31,23,59,59);
  const isLeap=(year%4===0&&year%100!==0)||(year%400===0);
  const totalDays=isLeap?366:365;
  const MONTHS_SHORT=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const monthCols=MONTHS_SHORT.map((label,m)=>{
    const days=new Date(year,m+1,0).getDate();
    const startDay=Math.round((new Date(year,m,1)-yearStart)/86400000);
    return {label,days,startDay,pct:(startDay/totalDays)*100,widthPct:(days/totalDays)*100};
  });
  function datePct(ds){
    if(!ds) return null;
    const d=new Date(ds+"T00:00:00");
    if(d<yearStart) return 0;
    if(d>yearEnd) return 100;
    return (Math.round((d-yearStart)/86400000)/totalDays)*100;
  }
  const todayPct=today.getFullYear()===year?datePct(today.toISOString().split("T")[0]):null;
  const visible=[...prods].filter(p=>{
    if(!p.createdAt) return false;
    const s=new Date(p.createdAt+"T00:00:00");
    const e=p.deadline?new Date(p.deadline+"T00:00:00"):new Date(today.getTime()+60*86400000);
    return s<=yearEnd && e>=yearStart;
  }).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  const LW=220;
  return <div>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:28}}>
      <button className="btn-sm" onClick={onPrev}>← {year-1}</button>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,color:C.text,letterSpacing:3}}>{year}</div>
      <button className="btn-sm" onClick={onNext}>{year+1} →</button>
    </div>
    <div style={{display:"flex",marginBottom:0}}>
      <div style={{width:LW,flexShrink:0,borderBottom:`1px solid ${C.border}`,padding:"0 16px 10px 0"}}>
        <span style={{fontSize:9,color:C.muted,letterSpacing:2,textTransform:"uppercase"}}>Producción</span>
      </div>
      <div style={{flex:1,display:"flex",borderBottom:`1px solid ${C.border}`}}>
        {monthCols.map((m,i)=>(
          <div key={i} style={{flex:`0 0 ${m.widthPct}%`,borderLeft:`1px solid ${C.border}`,padding:"0 4px 10px 6px"}}>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>{m.label}</div>
            <div style={{fontSize:8,color:"#2e2e2e"}}>{m.days}d</div>
          </div>
        ))}
      </div>
    </div>
    {visible.length===0&&(<div style={{padding:"60px 0",textAlign:"center",color:C.muted,fontSize:14}}>No hay producciones en {year}.</div>)}
    {visible.map((prod,ri)=>{
      const sc=stageOf(prod.stage).color;
      const isActive=prod.stage!=="terminado";
      const sp=Math.max(0,datePct(prod.createdAt));
      const rawEp=prod.deadline?datePct(prod.deadline):Math.min(100,datePct(new Date(today.getTime()+60*86400000).toISOString().split("T")[0]));
      const ep=Math.min(100,rawEp??100);
      const wp=Math.max(ep-sp,0.5);
      return <div key={prod.id} style={{display:"flex",alignItems:"center",borderBottom:`1px solid ${C.border}`,minHeight:62,background:ri%2===0?"#0b0b0b":"#0d0d0d",transition:"background .15s"}}
      onMouseEnter={e=>e.currentTarget.style.background="#111"}
      onMouseLeave={e=>e.currentTarget.style.background=ri%2===0?"#0b0b0b":"#0d0d0d"}
      >
        <div style={{width:LW,flexShrink:0,padding:"14px 20px 14px 0",cursor:"pointer"}} onClick={()=>onClickProd(prod.id)}>
          <div style={{fontSize:13,color:C.text,fontFamily:"'Playfair Display',serif",lineHeight:1.3,marginBottom:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:LW-24}}>{prod.name}</div>
          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
            <span style={{width:6,height:6,borderRadius:"50%",background:sc,flexShrink:0}}/>
            <span style={{fontSize:9,color:sc,letterSpacing:1.5,textTransform:"uppercase"}}>{stageOf(prod.stage).short}</span>
            <span style={{fontSize:9,color:C.muted,letterSpacing:.5}}>{fmtDate(prod.createdAt)}</span>
          </div>
        </div>
        <div style={{flex:1,position:"relative",height:62}}>
          {monthCols.map((m,i)=>(<div key={i} style={{position:"absolute",left:`${m.pct}%`,top:0,bottom:0,width:1,background:i%2===0?"#141414":"#101010",pointerEvents:"none"}}/>))}
          {todayPct!==null&&(<div style={{position:"absolute",left:`${todayPct}%`,top:0,bottom:0,width:1,background:C.gold,opacity:.4,pointerEvents:"none",zIndex:3}}/>)}
          <div onClick={()=>onClickProd(prod.id)} title={`${prod.name} · ${fmtDate(prod.createdAt)} → ${prod.deadline?fmtDate(prod.deadline):"en curso"}`}
            style={{position:"absolute",left:`${sp}%`,width:`${wp}%`,height:24,top:"50%",transform:"translateY(-50%)",background:isActive?sc+"2a":sc+"14",border:`1px solid ${isActive?sc+"bb":sc+"44"}`,borderRadius:3,cursor:"pointer",display:"flex",alignItems:"center",paddingLeft:8,overflow:"hidden",transition:"background .15s",zIndex:2}}
            onMouseEnter={e=>e.currentTarget.style.background=sc+"44"}
            onMouseLeave={e=>e.currentTarget.style.background=isActive?sc+"2a":sc+"14"}
          >
            <span style={{fontSize:9,color:sc,fontFamily:"'DM Mono',monospace",whiteSpace:"nowrap",letterSpacing:.5,fontWeight:"500"}}>
              {prod.name.length>22?prod.name.slice(0,21)+"…":prod.name}
            </span>
          </div>
          {prod.deadline&&ep<99&&ep>sp+2&&(
            <div style={{position:"absolute",left:`${ep}%`,top:"50%",transform:"translateY(-50%) translateX(5px)",fontSize:8,color:C.muted,whiteSpace:"nowrap",pointerEvents:"none",zIndex:4,letterSpacing:.3}}>{fmtDate(prod.deadline)}</div>
          )}
        </div>
      </div>;
    })}
    <div style={{display:"flex",alignItems:"center",gap:16,marginTop:18,paddingTop:14,borderTop:`1px solid ${C.border}`,flexWrap:"wrap"}}>
      {todayPct!==null&&(<div style={{display:"flex",alignItems:"center",gap:8}}>
        <div style={{width:20,height:1,background:C.gold,opacity:.5}}/>
        <span style={{fontSize:10,color:C.muted,letterSpacing:1.5}}>Hoy · {today.toLocaleDateString("es-AR",{day:"2-digit",month:"long"})}</span>
      </div>)}
      <div style={{display:"flex",gap:14,marginLeft:"auto",flexWrap:"wrap"}}>
        {STAGES.map(st=>(<div key={st.id} style={{display:"flex",alignItems:"center",gap:5}}>
          <div style={{width:14,height:8,borderRadius:1,background:st.color,opacity:.7}}/>
          <span style={{fontSize:9,color:C.muted,letterSpacing:1,textTransform:"uppercase"}}>{st.label}</span>
        </div>))}
      </div>
    </div>
  </div>;
}

// ─── HAMBURGER MENU ───────────────────────────────────────────────────────────
const NAV_ITEMS=[
  {id:"dashboard",label:"Dashboard",  icon:"◈"},
  {id:"history",  label:"Historial",  icon:"◎"},
  {id:"calendar", label:"Calendario", icon:"▦"},
  {id:"charts",   label:"Gráficos",   icon:"◉"},
  {id:"simulator",label:"Simulador",  icon:"◇"},
];
function HamburgerMenu({view,setView,onNew}){
  const [open,setOpen]=useState(false);
  const ref=useRef(null);
  useEffect(()=>{
    const h=e=>{if(ref.current&&!ref.current.contains(e.target))setOpen(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);
  function go(v){setView(v);setOpen(false);}
  return <>
    {open&&<div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,background:"#000000b0",zIndex:150}}/>}
    <div ref={ref} style={{position:"fixed",top:0,left:open?0:-310,width:290,height:"100vh",background:"#090909",borderRight:`1px solid ${C.border}`,zIndex:200,transition:"left .26s cubic-bezier(.4,0,.2,1)",display:"flex",flexDirection:"column"}}>
      <div style={{padding:"28px 24px 20px",borderBottom:`1px solid ${C.border}`}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:21,letterSpacing:5,color:C.gold,textTransform:"uppercase",marginBottom:4}}>Studio Pro</div>
        <div style={{fontSize:10,color:C.muted,letterSpacing:2}}>GESTIÓN DE PRODUCCIÓN</div>
      </div>
      <div style={{flex:1,paddingTop:10,overflowY:"auto"}}>
        {NAV_ITEMS.map(item=><div key={item.id} className={`menu-item ${view===item.id?"active":""}`} onClick={()=>go(item.id)}>
          <span style={{fontSize:16,color:view===item.id?C.gold:C.muted}}>{item.icon}</span>
          <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,letterSpacing:2,color:view===item.id?C.text:"#606060",textTransform:"uppercase"}}>{item.label}</span>
        </div>)}
      </div>
      <div style={{padding:"20px 24px",borderTop:`1px solid ${C.border}`}}>
        <button className="btn-p" style={{width:"100%"}} onClick={()=>{onNew();setOpen(false);}}>+ Nueva producción</button>
      </div>
    </div>
    <button onClick={()=>setOpen(o=>!o)} style={{background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",gap:5,padding:8}}>
      <span style={{width:24,height:2,background:open?C.gold:C.text,transition:"all .22s",transform:open?"rotate(45deg) translate(5px,5px)":"none",display:"block"}}/>
      <span style={{width:24,height:2,background:open?C.gold:C.text,transition:"all .22s",opacity:open?0:1,display:"block"}}/>
      <span style={{width:24,height:2,background:open?C.gold:C.text,transition:"all .22s",transform:open?"rotate(-45deg) translate(5px,-5px)":"none",display:"block"}}/>
    </button>
  </>;
}

// ─── CHART DATA ───────────────────────────────────────────────────────────────
function buildChartData(prods,period){
  const sorted=[...prods].sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
  if(!sorted.length) return [];
  const getKey=ds=>{
    const d=new Date(ds+"T12:00:00"),y=d.getFullYear(),m=d.getMonth();
    if(period==="mes") return `${String(m+1).padStart(2,"0")}/${y}`;
    if(period==="cuatri") return `C${Math.floor(m/4)+1} ${y}`;
    if(period==="semestre") return `S${Math.floor(m/6)+1} ${y}`;
    return `${y}`;
  };
  const map={};
  sorted.forEach(p=>{
    const k=getKey(p.createdAt);
    if(!map[k]) map[k]={period:k,unidades:0,inversion:0};
    const u=totalUnitsOf(p.models);
    map[k].unidades+=u;
    map[k].inversion+=unitCostOf(p.costs)*u;
  });
  return Object.values(map);
}

// ─── LAYOUT — defined OUTSIDE App so React never recreates it ─────────────────
// BUG FIX: was previously inside App(), causing full remount on every keystroke
function Layout({children,right,view,setView,onNew,deleteTarget,deleteTargetName,onDeleteConfirm,onDeleteCancel}){
  return <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Mono',monospace",color:C.text}}>
    <style>{GCS}</style>
    {deleteTarget&&<DeleteModal name={deleteTargetName||""} onConfirm={onDeleteConfirm} onCancel={onDeleteCancel}/>}
    <header style={{borderBottom:`1px solid ${C.border}`,padding:"0 32px",height:68,display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,background:C.bg+"ee",backdropFilter:"blur(10px)",zIndex:100}}>
      <div style={{display:"flex",alignItems:"center",gap:20}}>
        <HamburgerMenu view={view} setView={setView} onNew={onNew}/>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,letterSpacing:6,color:C.gold,textTransform:"uppercase"}}>Studio Pro</div>
      </div>
      {right}
    </header>
    {children}
  </div>;
}

// ─── MAIN APP ────────────────────────────────────────────────────────────────
export default function App(){
  const [prods,setProds]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);
  const [saving,setSaving]=useState(false);
  const [view,setView]=useState("dashboard");
  const [selId,setSelId]=useState(null);
  const [prevView,setPrevView]=useState("dashboard");
  const [np,setNp]=useState(null);
  const [editData,setEditData]=useState(null);
  const [deleteTarget,setDeleteTarget]=useState(null);
  const [chartPeriod,setChartPeriod]=useState("mes");
  const [sim,setSim]=useState({qty:50,tela:850,estampa:300,corte:250,avios:120,fabric:"Jersey 30/1",weight:180});
  const todayRef=new Date();
  const [calMode,setCalMode]=useState("mensual");
  const [calYear,setCalYear]=useState(todayRef.getFullYear());
  const [calMonth,setCalMonth]=useState(todayRef.getMonth());

  const sel=prods.find(p=>p.id===selId);
  const deleteTargetName=prods.find(p=>p.id===deleteTarget)?.name||"";

  // ── Shared Layout props ───────────────────────────────────────────────────
  const layoutBase={
    view, setView, onNew:startNew,
    deleteTarget, deleteTargetName,
    onDeleteConfirm:doDelete,
    onDeleteCancel:()=>setDeleteTarget(null),
  };

  // ── Load all productions on mount ─────────────────────────────────────────
  useEffect(()=>{loadProds();},[]);

  async function loadProds(){
    setLoading(true);
    setError(null);
    try{
      const data=await api.productions.list();
      setProds(data);
    }catch(e){
      setError("No se pudo conectar con el servidor. Verificá la conexión.");
      console.error("API error:",e);
    }finally{
      setLoading(false);
    }
  }

  function goDetail(id,from){setPrevView(from||view);setSelId(id);setView("detail");}
  function goBack(){setView(prevView||"dashboard");}

  // ── Toggle task ───────────────────────────────────────────────────────────
  async function toggleTask(pid,tid,val){
    const prod=prods.find(p=>p.id===pid);
    if(!prod) return;
    const newTasks={...prod.tasks,[tid]:val};
    setProds(ps=>ps.map(p=>p.id!==pid?p:{...p,tasks:newTasks}));
    try{
      await api.productions.updateTasks(pid,newTasks);
    }catch(e){
      setProds(ps=>ps.map(p=>p.id!==pid?p:{...p,tasks:prod.tasks}));
      alert("Error al guardar tarea: "+e.message);
    }
  }

  // ── Change stage ──────────────────────────────────────────────────────────
  async function changeStage(pid,stage){
    const prev=prods.find(p=>p.id===pid)?.stage;
    setProds(ps=>ps.map(p=>p.id!==pid?p:{...p,stage}));
    try{
      await api.productions.updateStage(pid,stage);
    }catch(e){
      setProds(ps=>ps.map(p=>p.id!==pid?p:{...p,stage:prev}));
      alert("Error al cambiar estado: "+e.message);
    }
  }

  // ── New production ────────────────────────────────────────────────────────
  function startNew(){
    setNp({id:gid(),name:"",fabric:FABRICS[0],weightPerUnit:0,stage:"comprar_tela",deadline:"",createdAt:new Date().toISOString().split("T")[0],models:[newModel("Modelo 1")],costs:{tela:0,estampa:0,corte:0,avios:0},tasks:{}});
    setView("new");
  }
  async function saveNew(){
    if(!np.name.trim()) return;
    setSaving(true);
    try{
      const created=await api.productions.create(np);
      setProds(p=>[created,...p]);
      setView("dashboard");
    }catch(e){
      alert("Error al guardar: "+e.message);
    }finally{
      setSaving(false);
    }
  }

  // ── Edit production ───────────────────────────────────────────────────────
  function startEdit(prod){setEditData(deepClone(prod));setView("edit");}
  async function saveEdit(){
    if(!editData.name.trim()) return;
    setSaving(true);
    try{
      const updated=await api.productions.update(editData.id,editData);
      setProds(ps=>ps.map(p=>p.id===updated.id?updated:p));
      setSelId(updated.id);
      setView("detail");
    }catch(e){
      alert("Error al actualizar: "+e.message);
    }finally{
      setSaving(false);
    }
  }

  // ── Delete production ─────────────────────────────────────────────────────
  function confirmDelete(id){setDeleteTarget(id);}
  async function doDelete(){
    const id=deleteTarget;
    setDeleteTarget(null);
    try{
      await api.productions.delete(id);
      setProds(ps=>ps.filter(p=>p.id!==id));
      if(selId===id){setSelId(null);setView(prevView||"dashboard");}
    }catch(e){
      alert("Error al eliminar: "+e.message);
    }
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if(loading){
    return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20}}>
      <style>{GCS}</style>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:32,color:C.gold,letterSpacing:4}}>Studio Pro</div>
      <div style={{fontSize:11,color:C.muted,letterSpacing:3,textTransform:"uppercase"}}>Cargando producciones…</div>
    </div>;
  }

  if(error){
    return <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:20,padding:32}}>
      <style>{GCS}</style>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:C.red}}>Error de conexión</div>
      <div style={{fontSize:13,color:C.textSub,textAlign:"center",maxWidth:400,lineHeight:1.7}}>{error}</div>
      <button className="btn-p" onClick={loadProds}>Reintentar</button>
    </div>;
  }

  // ── DETAIL ────────────────────────────────────────────────────────────────
  if(view==="detail"&&sel){
    const uc=unitCostOf(sel.costs);
    const totalU=totalUnitsOf(sel.models);
    const tot=uc*totalU;
    const kg=(sel.weightPerUnit*totalU)/1000;
    return <Layout {...layoutBase} right={
      <div style={{display:"flex",gap:10}}>
        <button className="btn-g" onClick={()=>startEdit(sel)}>✏ Editar</button>
        <button className="btn-d" onClick={()=>confirmDelete(sel.id)}>✕ Eliminar</button>
        <button className="btn-g" onClick={goBack}>← Volver</button>
      </div>
    }>
      <div style={{maxWidth:1160,margin:"0 auto",padding:"44px 36px"}} className="fu">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:36,flexWrap:"wrap",gap:20}}>
          <div>
            <StagePill stageId={sel.stage}/>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:40,color:C.text,margin:"12px 0 10px",lineHeight:1.1}}>{sel.name}</h1>
            <div style={{display:"flex",gap:20,alignItems:"center",flexWrap:"wrap"}}>
              <span style={{fontSize:13,color:C.textSub}}>{sel.fabric} · {sel.weightPerUnit}g/prenda · {totalU} unidades</span>
              <span style={{fontSize:13,color:C.muted}}>Creada: {fmtDate(sel.createdAt)}</span>
              {sel.deadline&&<DeadlineBadge deadline={sel.deadline}/>}
              {sel.deadline&&<span style={{fontSize:13,color:C.muted}}>Entrega: {fmtDate(sel.deadline)}</span>}
            </div>
          </div>
          <div>
            <div style={{fontSize:10,color:C.muted,letterSpacing:2.5,marginBottom:10,textTransform:"uppercase"}}>Cambiar estado</div>
            <select className="inp" style={{width:230}} value={sel.stage} onChange={e=>changeStage(sel.id,e.target.value)}>
              {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        </div>
        <Timeline currentStage={sel.stage}/>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:32}}>
          <Stat value={totalU} label="Unidades"/>
          <Stat value={"$"+uc.toLocaleString("es-AR")} label="Costo unitario"/>
          <Stat value={"$"+tot.toLocaleString("es-AR")} label="Inversión total" accent={C.textSub}/>
          <Stat value={kg.toFixed(1)+" kg"} label="Tela estimada" accent="#60a5fa"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:22,marginBottom:28}}>
          <Checklist stageId={sel.stage} tasks={sel.tasks} onChange={(tid,val)=>toggleTask(sel.id,tid,val)}/>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:26}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.text,marginBottom:20}}>Desglose de costos</div>
            {[["tela","Tela"],["estampa","Estampa"],["corte","Corte & Conf."],["avios","Avíos"]].map(([k,l])=>{
              const pct=uc>0?(Number(sel.costs[k])/uc)*100:0;
              return <div key={k} style={{marginBottom:16}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
                  <span style={{color:C.textSub}}>{l}</span>
                  <span style={{color:C.gold}}>${Number(sel.costs[k]).toLocaleString("es-AR")} <span style={{color:C.muted}}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="pbg"><div className="pfill" style={{width:pct+"%",background:C.gold}}/></div>
              </div>;
            })}
          </div>
        </div>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:28}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:C.text,marginBottom:6}}>Clasificación de modelos</div>
          <div style={{fontSize:11,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginBottom:24}}>
            {sel.models.length} modelo{sel.models.length!==1?"s":""} · desglose por color / estampa / talle
          </div>
          {sel.models.map(m=>{
            const mTotal=m.variants.reduce((a,v)=>a+(+v.qty||0),0);
            return <div key={m.id} style={{marginBottom:28}}>
              <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:14}}>
                <div style={{width:3,height:24,background:C.gold}}/>
                <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:C.text}}>{m.name}</span>
                <span style={{fontSize:12,color:C.muted,marginLeft:"auto"}}>{mTotal} unidades</span>
              </div>
              <VariantDetailTable models={[m]}/>
            </div>;
          })}
        </div>
      </div>
    </Layout>;
  }

  // ── NEW ───────────────────────────────────────────────────────────────────
  if(view==="new"&&np){
    return <Layout {...layoutBase} right={<button className="btn-g" onClick={()=>setView("dashboard")}>← Cancelar</button>}>
      <ProductionForm title="Nueva Producción" subtitle="Completá los datos de la orden" data={np} setData={setNp} onSave={saveNew} onCancel={()=>setView("dashboard")} saveLabel={saving?"Guardando…":"Guardar producción"} disabled={saving}/>
    </Layout>;
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  if(view==="edit"&&editData){
    return <Layout {...layoutBase} right={
      <div style={{display:"flex",gap:10}}>
        <button className="btn-d" onClick={()=>confirmDelete(editData.id)}>✕ Eliminar</button>
        <button className="btn-g" onClick={()=>{setSelId(editData.id);setView("detail");}}>← Cancelar</button>
      </div>
    }>
      <ProductionForm title="Editar Producción" subtitle="Modificá los datos de la orden" data={editData} setData={setEditData} onSave={saveEdit} onCancel={()=>{setSelId(editData.id);setView("detail");}} saveLabel={saving?"Guardando…":"Guardar cambios"} disabled={saving}/>
    </Layout>;
  }

  // ── HISTORY ───────────────────────────────────────────────────────────────
  if(view==="history"){
    const sorted=[...prods].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    return <Layout {...layoutBase}>
      <div style={{maxWidth:1140,margin:"0 auto",padding:"44px 36px"}} className="fu">
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:40,color:C.text,marginBottom:6}}>Historial</h1>
        <p style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:36}}>Todas las producciones · {prods.length} registros</p>
        <div style={{background:C.panel,border:`1px solid ${C.border}`}}>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 120px",gap:0,padding:"13px 24px",borderBottom:`1px solid ${C.border}`,background:"#0a0a0a"}}>
            {["Producción","Estado","Unidades","Costo unit.","Inversión","Acciones"].map((h,i)=>(<div key={i} style={{fontSize:9,color:C.muted,letterSpacing:2.5,textTransform:"uppercase"}}>{h}</div>))}
          </div>
          {sorted.length===0&&<div style={{padding:"48px 24px",textAlign:"center",color:C.muted,fontSize:14}}>No hay producciones todavía. Creá la primera.</div>}
          {sorted.map((prod,idx)=>{
            const uc=unitCostOf(prod.costs);
            const totalU=totalUnitsOf(prod.models);
            const st=stageOf(prod.stage);
            return <div key={prod.id} style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr 1fr 120px",gap:0,padding:"16px 24px",borderBottom:idx<sorted.length-1?`1px solid ${C.border}`:"none",alignItems:"center"}}>
              <div className="hov-row" onClick={()=>goDetail(prod.id,"history")} style={{cursor:"pointer",padding:"4px 0"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:C.text,marginBottom:3}}>{prod.name}</div>
                <div style={{fontSize:11,color:C.muted}}>{prod.fabric} · Creada: {fmtDate(prod.createdAt)}</div>
                {prod.deadline&&<DeadlineBadge deadline={prod.deadline} style={{fontSize:9,marginTop:3}}/>}
              </div>
              <div><span style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:10,color:st.color,letterSpacing:1.5,textTransform:"uppercase"}}>
                <span style={{width:5,height:5,borderRadius:"50%",background:st.color}}/>{st.short}
              </span></div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.text}}>{totalU}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.gold}}>${uc.toLocaleString("es-AR")}</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:17,color:C.text}}>${(uc*totalU).toLocaleString("es-AR")}</div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-sm" onClick={()=>goDetail(prod.id,"history")}>Ver</button>
                <button className="btn-sm" style={{color:C.gold,borderColor:"#2a2a2a"}} onClick={()=>{setPrevView("history");startEdit(prod);}}>✏</button>
                <button className="btn-sm" style={{color:C.red,borderColor:"#2a1010"}} onClick={()=>confirmDelete(prod.id)}>✕</button>
              </div>
            </div>;
          })}
        </div>
      </div>
    </Layout>;
  }

  // ── CALENDAR ──────────────────────────────────────────────────────────────
  if(view==="calendar"){
    function prevMonth(){ if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); }
    function nextMonth(){ if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); }
    return <Layout {...layoutBase}>
      <div style={{maxWidth:1340,margin:"0 auto",padding:"44px 36px"}} className="fu">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:32,flexWrap:"wrap",gap:16}}>
          <div>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:40,color:C.text,marginBottom:6}}>Calendario</h1>
            <p style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase"}}>Timeline de producciones · click en cualquier barra para ver detalles</p>
          </div>
          <div style={{display:"flex",gap:0,border:`1px solid ${C.border}`,overflow:"hidden"}}>
            {[{id:"mensual",label:"Mensual"},{id:"anual",label:"Anual"}].map(m=>(
              <button key={m.id} onClick={()=>setCalMode(m.id)} style={{padding:"10px 24px",fontFamily:"'DM Mono',monospace",fontSize:10,letterSpacing:2,textTransform:"uppercase",cursor:"pointer",border:"none",background:calMode===m.id?C.gold:"#0c0c0c",color:calMode===m.id?"#080808":C.muted,transition:"all .2s"}}>{m.label}</button>
            ))}
          </div>
        </div>
        <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:32}}>
          {calMode==="mensual"
            ? <MonthlyCalendar prods={prods} onClickProd={id=>goDetail(id,"calendar")} year={calYear} month={calMonth} onPrev={prevMonth} onNext={nextMonth}/>
            : <AnnualGantt prods={prods} onClickProd={id=>goDetail(id,"calendar")} year={calYear} onPrev={()=>setCalYear(y=>y-1)} onNext={()=>setCalYear(y=>y+1)}/>
          }
        </div>
      </div>
    </Layout>;
  }

  // ── CHARTS ────────────────────────────────────────────────────────────────
  if(view==="charts"){
    const chartData=buildChartData(prods,chartPeriod);
    const periods=[{id:"mes",label:"Mes"},{id:"cuatri",label:"Cuatrimestre"},{id:"semestre",label:"Semestre"},{id:"año",label:"Año"}];
    return <Layout {...layoutBase}>
      <div style={{maxWidth:1160,margin:"0 auto",padding:"44px 36px"}} className="fu">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginBottom:36,flexWrap:"wrap",gap:16}}>
          <div>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:40,color:C.text,marginBottom:6}}>Gráficos</h1>
            <p style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase"}}>Evolución de producción e inversión</p>
          </div>
          <div style={{display:"flex",gap:6}}>{periods.map(p=><button key={p.id} className={`period-btn ${chartPeriod===p.id?"active":""}`} onClick={()=>setChartPeriod(p.id)}>{p.label}</button>)}</div>
        </div>
        {chartData.length===0
          ?<div style={{textAlign:"center",padding:"60px 0",border:`1px dashed ${C.border}`,color:C.muted,fontSize:14}}>Cargá producciones para ver los gráficos.</div>
          :<>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:32,marginBottom:20}}>
              <div style={{marginBottom:22}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:C.text,marginBottom:4}}>Prendas producidas</div>
                <div style={{fontSize:11,color:C.muted,letterSpacing:2}}>UNIDADES TOTALES POR PERÍODO</div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{top:0,right:0,bottom:0,left:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#171717" vertical={false}/>
                  <XAxis dataKey="period" tick={{fill:C.muted,fontSize:10,fontFamily:"DM Mono"}} axisLine={{stroke:C.border}} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"DM Mono"}} axisLine={false} tickLine={false}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Bar dataKey="unidades" name="Unidades" fill={C.gold} radius={[2,2,0,0]} maxBarSize={60}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:32,marginBottom:20}}>
              <div style={{marginBottom:22}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:C.text,marginBottom:4}}>Inversión acumulada</div>
                <div style={{fontSize:11,color:C.muted,letterSpacing:2}}>PESOS INVERTIDOS POR PERÍODO</div>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{top:0,right:0,bottom:0,left:10}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#171717" vertical={false}/>
                  <XAxis dataKey="period" tick={{fill:C.muted,fontSize:10,fontFamily:"DM Mono"}} axisLine={{stroke:C.border}} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"DM Mono"}} axisLine={false} tickLine={false} tickFormatter={v=>"$"+v.toLocaleString("es-AR")}/>
                  <Tooltip content={<ChartTooltip/>}/>
                  <Line type="monotone" dataKey="inversion" name="Inversión" stroke={C.gold} strokeWidth={2.5} dot={{fill:C.gold,r:4,strokeWidth:0}} activeDot={{r:6,fill:C.goldL}}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`}}>
              <div style={{padding:"16px 24px",borderBottom:`1px solid ${C.border}`,background:"#0a0a0a"}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.text}}>Resumen por período</div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"13px 24px",borderBottom:`1px solid ${C.border}`,background:"#090909"}}>
                {["Período","Unidades","Inversión"].map((h,i)=><div key={i} style={{fontSize:9,color:C.muted,letterSpacing:2.5,textTransform:"uppercase"}}>{h}</div>)}
              </div>
              {chartData.map((row,i)=><div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"16px 24px",borderBottom:i<chartData.length-1?`1px solid ${C.border}`:"none"}}>
                <div style={{fontSize:13,color:C.textSub}}>{row.period}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.text}}>{row.unidades}</div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.gold}}>${row.inversion.toLocaleString("es-AR")}</div>
              </div>)}
            </div>
          </>
        }
      </div>
    </Layout>;
  }

  // ── SIMULATOR ─────────────────────────────────────────────────────────────
  if(view==="simulator"){
    const su=Object.values({tela:sim.tela,estampa:sim.estampa,corte:sim.corte,avios:sim.avios}).reduce((a,v)=>a+Number(v),0);
    const sT=su*sim.qty;
    const sK=(sim.weight*sim.qty)/1000;
    return <Layout {...layoutBase}>
      <div style={{maxWidth:1060,margin:"0 auto",padding:"44px 36px"}} className="fu">
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:40,color:C.text,marginBottom:6}}>Simulador de costos</h1>
        <p style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:36}}>Calculá cuánto te sale producir cualquier cantidad</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:28}}>
          <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:34}}>
            {[["Tipo de tela",<select key="f" className="inp" value={sim.fabric} onChange={e=>setSim(s=>({...s,fabric:e.target.value}))}>{FABRICS.map(f=><option key={f}>{f}</option>)}</select>],
              ["Peso por prenda (g)",<input key="w" className="inp" type="number" value={sim.weight} onChange={e=>setSim(s=>({...s,weight:+e.target.value}))}/>],
              ["Cantidad a producir",<input key="q" className="inp" style={{fontSize:30,fontFamily:"'Playfair Display',serif",color:C.gold}} type="number" value={sim.qty} onChange={e=>setSim(s=>({...s,qty:+e.target.value}))}/>],
            ].map(([l,el],i)=><div key={i} style={{marginBottom:20}}><label style={LBL}>{l}</label>{el}</div>)}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:24}}>
              <div style={{...SECT,marginTop:0}}>Costos unitarios ($)</div>
              {[["tela","Tela"],["estampa","Estampa"],["corte","Corte & Conf."],["avios","Avíos"]].map(([k,l])=>(
                <div key={k} style={{marginBottom:16}}><label style={LBL}>{l}</label><input className="inp" type="number" value={sim[k]} onChange={e=>setSim(s=>({...s,[k]:+e.target.value}))}/></div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div style={{background:C.panel,border:`1px solid ${C.gold}28`,padding:"32px 28px",position:"relative"}}>
              <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:C.gold}}/>
              <div style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:12}}>Costo unitario</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:54,color:C.gold,lineHeight:1}}>${su.toLocaleString("es-AR")}</div>
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:"32px 28px",position:"relative"}}>
              <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:C.textSub}}/>
              <div style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:12}}>Total — {sim.qty} unidades</div>
              <div style={{fontFamily:"'Playfair Display',serif",fontSize:44,color:C.text,lineHeight:1}}>${sT.toLocaleString("es-AR")}</div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {[{v:sK.toFixed(1)+" kg",l:"Tela estimada"},{v:sim.fabric.split(" ")[0],l:"Tipo de tela"}].map((k,i)=>(
                <div key={i} style={{background:C.panel,border:`1px solid ${C.border}`,padding:"20px 18px",position:"relative"}}>
                  <div style={{position:"absolute",top:0,left:0,width:2,height:"100%",background:C.gold+"66"}}/>
                  <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:C.gold}}>{k.v}</div>
                  <div style={{fontSize:10,color:C.muted,letterSpacing:2,textTransform:"uppercase",marginTop:5}}>{k.l}</div>
                </div>
              ))}
            </div>
            <div style={{background:C.panel,border:`1px solid ${C.border}`,padding:24}}>
              <div style={{fontSize:11,color:C.muted,letterSpacing:2.5,textTransform:"uppercase",marginBottom:16}}>Composición del costo</div>
              {[["tela","Tela"],["estampa","Estampa"],["corte","Corte & Conf."],["avios","Avíos"]].map(([k,l])=>{
                const pct=su>0?(Number(sim[k])/su)*100:0;
                return <div key={k} style={{marginBottom:14}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:5}}><span style={{color:C.textSub}}>{l}</span><span style={{color:C.gold}}>{pct.toFixed(1)}%</span></div>
                  <div className="pbg"><div className="pfill" style={{width:pct+"%",background:C.gold}}/></div>
                </div>;
              })}
            </div>
          </div>
        </div>
      </div>
    </Layout>;
  }

  // ── DASHBOARD ─────────────────────────────────────────────────────────────
  const totalAllU=prods.reduce((a,p)=>a+totalUnitsOf(p.models),0);
  const totalAllI=prods.reduce((a,p)=>a+unitCostOf(p.costs)*totalUnitsOf(p.models),0);
  const inProc=prods.filter(p=>p.stage!=="terminado").length;
  const urgentCount=prods.filter(p=>{const d=daysLeft(p.deadline);return d!==null&&d<=5&&p.stage!=="terminado";}).length;

  return <Layout {...layoutBase} right={<button className="btn-p" onClick={startNew}>+ Nueva producción</button>}>
    <div style={{maxWidth:1340,margin:"0 auto",padding:"44px 36px"}} className="fu">
      <div style={{marginBottom:44}}>
        <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:48,color:C.text,lineHeight:1,marginBottom:10}}>Dashboard</h1>
        <p style={{fontSize:12,color:C.muted,letterSpacing:3,textTransform:"uppercase"}}>{new Date().toLocaleDateString("es-AR",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</p>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:18,marginBottom:48}}>
        <Stat value={prods.length} label="Producciones"/>
        <Stat value={inProc} label="En proceso" accent={C.amber}/>
        <Stat value={totalAllU.toLocaleString("es-AR")} label="Unidades totales" accent="#60a5fa"/>
        <Stat value={"$"+Math.round(totalAllI/1000)+"K"} label="Inversión total" accent={C.green}/>
      </div>
      {urgentCount>0&&<div style={{background:"#120a00",border:`1px solid ${C.amber}28`,padding:"14px 22px",marginBottom:28,display:"flex",alignItems:"center",gap:14}}>
        <span style={{fontSize:18,color:C.amber}}>⚠</span>
        <span style={{fontSize:13,color:C.amber,letterSpacing:1}}>{urgentCount} producción{urgentCount>1?"es":""} con fecha límite en ≤5 días</span>
      </div>}
      {prods.length===0
        ?<div style={{textAlign:"center",padding:"80px 0",border:`1px dashed ${C.border}`}}>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:30,color:"#1e1e1e",marginBottom:16}}>Sin producciones</div>
          <div style={{fontSize:13,color:C.muted,marginBottom:28}}>La base de datos está vacía. Creá tu primera producción.</div>
          <button className="btn-p" onClick={startNew}>+ Nueva producción</button>
        </div>
        :<div style={{display:"flex",flexDirection:"column",gap:6}}>
          {STAGES.map(st=>{
            const stagProds=prods.filter(p=>p.stage===st.id);
            return <div key={st.id} style={{display:"flex",alignItems:"stretch",border:`1px solid ${C.border}`,background:C.panel,overflow:"hidden",minHeight:78}}>
              <div style={{width:185,background:"#090909",borderRight:`1px solid ${C.border}`,padding:"18px 22px",display:"flex",flexDirection:"column",justifyContent:"center",flexShrink:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:st.color}}/>
                  <span style={{fontSize:10,color:st.color,letterSpacing:2,textTransform:"uppercase",fontWeight:500}}>{st.short}</span>
                </div>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:stagProds.length>0?C.text:"#222"}}>
                  {stagProds.length}<span style={{fontSize:14,color:C.muted,marginLeft:5}}>{stagProds.length===1?"orden":"órdenes"}</span>
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:12,padding:14,flex:1,alignItems:"center"}}>
                {stagProds.length===0&&<span style={{color:"#202020",fontSize:13,padding:"0 8px"}}>—</span>}
                {stagProds.map(prod=>{
                  const uc2=unitCostOf(prod.costs);
                  const totalU2=totalUnitsOf(prod.models);
                  const tasks=STAGE_TASKS[prod.stage]||[];
                  const doneT=tasks.filter(t=>prod.tasks[t.id]).length;
                  const pct2=tasks.length>0?Math.round((doneT/tasks.length)*100):0;
                  const days=daysLeft(prod.deadline);
                  const urgent=days!==null&&days<=5&&prod.stage!=="terminado";
                  return <div key={prod.id} className="hov" onClick={()=>goDetail(prod.id,"dashboard")}
                    style={{background:"#0c0c0c",border:`1px solid ${urgent?"#f59e0b35":C.border2}`,padding:"16px 18px",minWidth:220,maxWidth:280}}>
                    <div style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:C.text,marginBottom:5,lineHeight:1.3}}>{prod.name}</div>
                    <div style={{fontSize:11,color:C.textSub,marginBottom:11}}>{prod.fabric} · {totalU2}u. · {prod.models.length}mod.</div>
                    {tasks.length>0&&<div style={{marginBottom:11}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:C.muted,marginBottom:5,letterSpacing:1.5}}>
                        <span>TAREAS</span><span style={{color:pct2===100?C.green:st.color}}>{doneT}/{tasks.length}</span>
                      </div>
                      <div className="pbg"><div className="pfill" style={{width:pct2+"%",background:pct2===100?C.green:st.color}}/></div>
                    </div>}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <span style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:C.gold}}>${uc2.toLocaleString("es-AR")}</span>
                      {prod.deadline&&<span style={{fontSize:10,color:days<0?C.red:days<=5?C.amber:C.muted,letterSpacing:1,textTransform:"uppercase"}}>{days<0?"VENCIDO":days===0?"HOY":days+"d"}</span>}
                    </div>
                  </div>;
                })}
              </div>
            </div>;
          })}
          <div className="hov" onClick={startNew} style={{marginTop:10,border:`1px dashed ${C.border}`,padding:22,textAlign:"center",background:"transparent"}}>
            <div style={{fontSize:11,color:"#2a2a2a",letterSpacing:3,textTransform:"uppercase"}}>+ Nueva producción</div>
          </div>
        </div>
      }
    </div>
  </Layout>;
}
