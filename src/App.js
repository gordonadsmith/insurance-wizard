import React, { useState, useCallback, useEffect } from 'react';
import ReactFlow, { 
  addEdge, Background, Controls, useNodesState, useEdgesState, Handle, Position 
} from 'reactflow';
import 'reactflow/dist/style.css';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';   
import 'react-quill-new/dist/quill.bubble.css'; 
import { Plus, RefreshCw, ChevronRight, Trash2, Save, Building2, X, DollarSign, Settings, CheckSquare, Copy, Layers, Lock, Unlock, Flag, BookOpen, Link as LinkIcon, FileText, Edit, FolderOpen, ClipboardCheck } from 'lucide-react';
import './App.css';

// --- ASSETS ---
import jerryLogo from './jerry_logo.png'; 

// --- CONFIG ---
const API_URL = "/api"; 

// --- THEME CONSTANTS ---
const JERRY_PINK = "#E9406A";
const JERRY_BG = "#FDF2F4"; 
const SLATE = "#475569";
const BORDER = "#E5E7EB";
const COMPLIANCE_ORANGE = "#F59E0B"; 

// --- HELPER: ROBUST LINE BREAKER ---
const FormatText = ({ text }) => {
  if (!text) return null;
  const htmlContent = text.replace(/\r?\n/g, '<br />');
  return (
    <div 
      style={{ lineHeight: '1.6', wordBreak: 'break-word', cursor: 'text' }}
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

// --- DEFAULTS ---
const DEFAULT_CARRIERS = {
  "1": { id: "1", name: "Progressive", script: "<p>Verify garaging address matches license.</p><p><strong>Phone:</strong> 1-800-776-4737</p>" },
};

const DEFAULT_RESOURCES = [
  { id: '1', title: 'Callback Script', type: 'text', content: '<p>Hi, this is [Name] from Jerry.</p><p>I was working on your quote...</p>' },
  { id: '2', title: 'Carrier Matrix', type: 'link', content: 'https://google.com' }
];

const DEFAULT_QUOTE_SETTINGS = {
  coverages: [
    { id: 'bi_pd', label: 'Bodily Injury Liability', hasInput: true, placeholder: 'e.g. 100/300', isPolicyLevel: true, format: "<b>{label}</b> at {value}" },
    { id: 'uim', label: 'Uninsured Motorist', hasInput: true, placeholder: 'e.g. 30/60', isPolicyLevel: true, format: "<b>{label}</b> at {value}" },
    { id: 'pip', label: 'PIP', hasInput: false, isPolicyLevel: true, format: "standard <b>{label}</b>" },
    { id: 'towing', label: 'Roadside', hasInput: false, isPolicyLevel: true, format: "<b>{label}</b>" },
    { id: 'comp', label: 'Comprehensive', hasInput: true, placeholder: 'e.g. $500 Ded', isPolicyLevel: false, format: "<b>{label}</b> with a {value}" },
    { id: 'coll', label: 'Collision', hasInput: true, placeholder: 'e.g. $500 Ded', isPolicyLevel: false, format: "<b>{label}</b> with a {value}" },
    { id: 'rental', label: 'Rental', hasInput: true, placeholder: 'e.g. $1200', isPolicyLevel: false, format: "{value} for <b>{label}</b>" },
  ],
  coverageFormat: "<b>{label}</b> with {value}", 
  vehicleTemplate: "for {name}, we have {coverages}",
  template: "<p>Excellent news, I found a great rate with <strong>{carrier}</strong>.</p><p>{policy}</p><p>Then {vehicles}.</p><p>I will get this started today for <strong>{down} down</strong> and <strong>{monthly} a month</strong>.</p><p>{closing}</p>"
};

// --- COMPONENT: Quote Builder ---
const QuoteBuilderForm = ({ closingQuestion, settings = DEFAULT_QUOTE_SETTINGS, carriers = {} }) => {
  const [downPayment, setDownPayment] = useState("");
  const [monthly, setMonthly] = useState("");
  const [term, setTerm] = useState("6-month");
  const [selectedCarrier, setSelectedCarrier] = useState("");
  const [policyValues, setPolicyValues] = useState({}); 
  const [policyChecks, setPolicyChecks] = useState([]); 
  const [vehicles, setVehicles] = useState([{ id: 1, name: "", coverages: [], values: {} }]);

  const togglePolicyCov = (cId) => {
    setPolicyChecks(prev => {
      const has = prev.includes(cId);
      if (has) { const n = { ...policyValues }; delete n[cId]; setPolicyValues(n); return prev.filter(c => c !== cId); }
      return [...prev, cId];
    });
  };
  const updatePolicyVal = (cId, val) => setPolicyValues(prev => ({ ...prev, [cId]: val }));
  const addVehicle = () => setVehicles([...vehicles, { id: Date.now(), name: "", coverages: [], values: {} }]);
  const removeVehicle = (id) => { if(vehicles.length > 1) setVehicles(vehicles.filter(v => v.id !== id)); };
  const updateName = (id, name) => setVehicles(vehicles.map(v => v.id === id ? { ...v, name } : v));
  const toggleVehCov = (vId, cId) => setVehicles(vehicles.map(v => v.id === vId ? { ...v, coverages: v.coverages.includes(cId) ? v.coverages.filter(c => c !== cId) : [...v.coverages, cId] } : v));
  const updateVehVal = (vId, cId, val) => setVehicles(vehicles.map(v => v.id === vId ? { ...v, values: { ...v.values, [cId]: val } } : v));
  const matchVehicleOne = (targetId) => { const v1 = vehicles[0]; setVehicles(vehicles.map(v => v.id === targetId ? { ...v, coverages: [...v1.coverages], values: { ...v1.values } } : v)); };

  const generateScript = () => {
    if (!downPayment || !monthly) return "<p><i>Enter pricing to generate script.</i></p>";
    const joinList = (l) => l.length === 0 ? "" : l.length === 1 ? l[0] : l.length === 2 ? `${l[0]} and ${l[1]}` : `${l.slice(0, -1).join(", ")}, and ${l.slice(-1)}`;
    const formatItem = (cId, val) => {
      const conf = settings.coverages.find(s => s.id === cId);
      if (!conf) return "";
      const fmt = conf.format || settings.coverageFormat || "{label} with {value}";
      if (fmt.includes("{value}") && (!val || val.trim() === "")) return `<b>${conf.label}</b>`;
      return fmt.replace("{label}", conf.label).replace("{value}", val || "");
    };

    const policyItems = policyChecks.map(cId => formatItem(cId, policyValues[cId]));
    let policyString = policyItems.length > 0 ? `On the policy level, we have included ${joinList(policyItems)}` : "This includes basic state minimums";

    const vehiclesString = vehicles.map(v => {
        const covItems = v.coverages.map(cId => formatItem(cId, v.values[cId]));
        const covList = covItems.length > 0 ? joinList(covItems) : "state minimums";
        return (settings.vehicleTemplate || "for {name}, we have {coverages}").replace("{name}", `<b>${v.name || "Vehicle"}</b>`).replace("{coverages}", covList);
    }).join(". ");

    const carrierName = carriers[selectedCarrier]?.name || "our partner";
    const dSym = downPayment.includes('$') ? '' : '$'; const mSym = monthly.includes('$') ? '' : '$';
    let script = settings.template;
    script = script.replace("{carrier}", carrierName).replace("{policy}", policyString).replace("{vehicles}", vehiclesString);
    script = script.replace("{down}", `${dSym}${downPayment}`).replace("{monthly}", `${mSym}${monthly}`).replace("{term}", term);
    script = script.replace("{closing}", closingQuestion || "Did you want this policy to start effective today?");
    return script;
  };

  const policyFields = settings.coverages.filter(c => c.isPolicyLevel);
  const vehicleFields = settings.coverages.filter(c => !c.isPolicyLevel);

  return (
    <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
      <div style={{display:'flex', gap:'8px'}}>
        <div style={{flexGrow:1}}><label style={{fontSize:'11px', fontWeight:'bold', color: SLATE}}>CARRIER</label><select style={{width:'100%', padding:'8px', borderRadius:'6px', border:`1px solid ${BORDER}`, background:'white'}} value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)}><option value="">-- Select --</option>{Object.values(carriers).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div style={{width:'90px'}}><label style={{fontSize:'11px', fontWeight:'bold', color: SLATE}}>DOWN</label><input style={{width:'100%', padding:'8px', borderRadius:'6px', border:`1px solid ${BORDER}`}} placeholder="$0.00" value={downPayment} onChange={e => setDownPayment(e.target.value)}/></div>
        <div style={{width:'90px'}}><label style={{fontSize:'11px', fontWeight:'bold', color: SLATE}}>MONTHLY</label><input style={{width:'100%', padding:'8px', borderRadius:'6px', border:`1px solid ${BORDER}`}} placeholder="$0.00" value={monthly} onChange={e => setMonthly(e.target.value)}/></div>
      </div>
      {policyFields.length > 0 && (
        <div style={{background: JERRY_BG, border:`1px solid #FBCFE8`, borderRadius:'8px', padding:'10px'}}>
          <div style={{fontSize:'11px', fontWeight:'bold', color: JERRY_PINK, marginBottom:'6px', display:'flex', alignItems:'center', gap:'4px'}}><Layers size={12}/> POLICY LEVEL</div>
          <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>{policyFields.map(c => { const isChecked = policyChecks.includes(c.id); return (<div key={c.id} style={{display:'flex', alignItems:'center', gap:'8px'}}><button onClick={() => togglePolicyCov(c.id)} style={{flexGrow: 1, textAlign: 'left', fontSize:'12px', padding:'6px 8px', borderRadius:'6px', cursor:'pointer', border:'1px solid', backgroundColor: 'white', borderColor: isChecked ? JERRY_PINK : BORDER, color: isChecked ? JERRY_PINK : SLATE, display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width:'12px', height:'12px', borderRadius:'12px', border: `1px solid ${isChecked ? JERRY_PINK : '#ccc'}`, background: isChecked ? JERRY_PINK : 'transparent'}}></div>{c.label}</button>{isChecked && c.hasInput && (<input className="nodrag" placeholder={c.placeholder || "Val"} value={policyValues[c.id] || ""} onChange={(e) => updatePolicyVal(c.id, e.target.value)} style={{width:'80px', fontSize:'12px', padding:'6px', border:`1px solid ${BORDER}`, borderRadius:'6px'}} />)}</div>); })}</div>
        </div>
      )}
      <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
        {vehicles.map((v, idx) => (
          <div key={v.id} style={{background:'#f9fafb', border:`1px solid ${BORDER}`, borderRadius:'8px', padding:'10px'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', alignItems:'center'}}>
              <input placeholder={`Vehicle ${idx + 1} Name`} style={{border:`1px solid ${BORDER}`, padding:'4px 8px', borderRadius:'4px', width:'60%', fontSize:'13px', fontWeight:'bold'}} value={v.name} onChange={e => updateName(v.id, e.target.value)}/>
              <div style={{display:'flex', gap:'4px'}}>
                {idx > 0 && <button onClick={() => matchVehicleOne(v.id)} title="Copy V1" style={{border:`1px solid ${BORDER}`, background:'white', color: SLATE, cursor:'pointer', padding:'4px', borderRadius:'4px'}}><Copy size={14}/></button>}
                {vehicles.length > 1 && <button onClick={() => removeVehicle(v.id)} style={{border:'none', background:'none', color:'#ff4444', cursor:'pointer'}}><X size={14}/></button>}
              </div>
            </div>
            <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>{vehicleFields.map(c => { const isChecked = v.coverages.includes(c.id); return (<div key={c.id} style={{display:'flex', alignItems:'center', gap:'8px'}}><button onClick={() => toggleVehCov(v.id, c.id)} style={{flexGrow: 1, textAlign: 'left', fontSize:'12px', padding:'6px 8px', borderRadius:'6px', cursor:'pointer', border:'1px solid', backgroundColor: 'white', borderColor: isChecked ? JERRY_PINK : BORDER, color: isChecked ? JERRY_PINK : SLATE, display: 'flex', alignItems: 'center', gap: '6px'}}><div style={{width:'12px', height:'12px', borderRadius:'12px', border: `1px solid ${isChecked ? JERRY_PINK : '#ccc'}`, background: isChecked ? JERRY_PINK : 'transparent'}}></div>{c.label}</button>{isChecked && c.hasInput && (<input className="nodrag" placeholder={c.placeholder || "Val"} value={v.values[c.id] || ""} onChange={(e) => updateVehVal(v.id, c.id, e.target.value)} style={{width:'80px', fontSize:'12px', padding:'6px', border:`1px solid ${BORDER}`, borderRadius:'6px'}} />)}</div>); })}</div>
          </div>
        ))}
        <button onClick={addVehicle} style={{fontSize:'12px', color: JERRY_PINK, background:'none', border:'none', cursor:'pointer', textAlign:'left', padding:0, fontWeight:'bold'}}>+ Add another vehicle</button>
      </div>
      <div style={{marginTop:'4px'}}>
        <label style={{fontSize:'11px', fontWeight:'bold', color: JERRY_PINK}}>WORD TRACK:</label>
        <div style={{background:'white', border:`2px solid ${JERRY_PINK}`, borderRadius:'8px', padding:'12px', fontSize:'15px', lineHeight:'1.6'}} dangerouslySetInnerHTML={{__html: generateScript()}}></div>
      </div>
    </div>
  );
};

// --- COMPONENT: Settings Manager ---
const SettingsManager = ({ isOpen, onClose, settings, setSettings }) => {
  const [localSettings, setLocalSettings] = useState(settings);
  useEffect(() => { setLocalSettings(settings); }, [settings]);
  if (!isOpen) return null;
  const handleSave = () => { setSettings(localSettings); onClose(); };
  const addCoverage = () => { const id = Date.now().toString(); setLocalSettings(prev => ({ ...prev, coverages: [...prev.coverages, { id, label: "New Field", hasInput: false, isPolicyLevel: false, format: "{label} with {value}" }] })); };
  const removeCoverage = (id) => setLocalSettings(prev => ({ ...prev, coverages: prev.coverages.filter(c => c.id !== id) }));
  const updateCoverage = (id, field, value) => setLocalSettings(prev => ({ ...prev, coverages: prev.coverages.map(c => c.id === id ? { ...c, [field]: value } : c) }));

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', width:'700px', borderRadius:'16px', display:'flex', flexDirection:'column', boxShadow:'0 20px 50px rgba(0,0,0,0.2)', maxHeight:'85vh', overflow:'hidden'}}>
        <div style={{padding:'20px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}><h2 style={{margin:0, fontSize:'18px', display:'flex', gap:'8px'}}><Settings color={JERRY_PINK}/> Quote Configuration</h2><button onClick={onClose} style={{background:'none', border:'none'}}><X size={24}/></button></div>
        <div style={{padding:'20px', overflowY:'auto'}}>
          <div style={{marginBottom:'20px'}}><label style={{fontSize:'12px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'8px'}}>MAIN TEMPLATE (HTML Supported)</label>
          <ReactQuill theme="snow" value={localSettings.template} onChange={(val) => setLocalSettings(prev => ({ ...prev, template: val }))} />
          </div>
          <div style={{marginBottom:'20px'}}><label style={{fontSize:'12px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'8px'}}>VEHICLE PHRASE FORMAT</label><input value={localSettings.vehicleTemplate} onChange={(e) => setLocalSettings(prev => ({ ...prev, vehicleTemplate: e.target.value }))} style={{width:'100%', padding:'8px', border:`1px solid ${BORDER}`, borderRadius:'4px', fontFamily:'monospace', fontSize:'13px'}}/></div>
          <div><label style={{fontSize:'12px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'8px'}}>QUOTE FIELDS</label><div style={{display:'flex', flexDirection:'column', gap:'8px'}}>{localSettings.coverages.map(c => (<div key={c.id} style={{display:'flex', gap:'8px', alignItems:'center', background:'#f9fafb', padding:'8px', borderRadius:'6px', flexWrap:'wrap'}}><div style={{flexGrow:1, minWidth:'150px'}}><input value={c.label} onChange={(e) => updateCoverage(c.id, 'label', e.target.value)} style={{width:'100%', padding:'6px', border:`1px solid ${BORDER}`, borderRadius:'4px'}} placeholder="Label"/></div><div style={{flexGrow:2, minWidth:'200px'}}><input value={c.format || ""} onChange={(e) => updateCoverage(c.id, 'format', e.target.value)} style={{width:'100%', padding:'6px', border:`1px solid ${BORDER}`, borderRadius:'4px'}} placeholder="{label} with {value}"/></div><div style={{display:'flex', gap:'8px', marginTop:'0px'}}><div title="Policy Level?" onClick={() => updateCoverage(c.id, 'isPolicyLevel', !c.isPolicyLevel)} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', cursor:'pointer', padding:'4px 8px', borderRadius:'4px', background:'white', border: c.isPolicyLevel ? `1px solid ${SLATE}` : `1px solid ${BORDER}`, color: c.isPolicyLevel ? SLATE : '#999'}}><Layers size={14} /> {c.isPolicyLevel ? "Policy" : "Veh"}</div><div title="Allow inputs?" onClick={() => updateCoverage(c.id, 'hasInput', !c.hasInput)} style={{display:'flex', alignItems:'center', gap:'4px', fontSize:'11px', cursor:'pointer', padding:'4px 8px', borderRadius:'4px', background:'white', border: c.hasInput ? `1px solid ${JERRY_PINK}` : `1px solid ${BORDER}`, color: c.hasInput ? JERRY_PINK : '#999'}}><CheckSquare size={14} /> {c.hasInput ? "Input" : "Fixed"}</div><button onClick={() => removeCoverage(c.id)} style={{color:'#ff4444', background:'none', border:'none'}}><Trash2 size={16}/></button></div></div>))} <button onClick={addCoverage} style={{padding:'8px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', width:'100%'}}>+ Add New Field</button></div></div></div>
        <div style={{padding:'20px', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'flex-end'}}><button className="btn-primary" onClick={handleSave} style={{background: JERRY_PINK, border:'none'}}>Save Configuration</button></div>
      </div>
    </div>
  );
};

// --- COMPONENT: Resource Sidebar ---
const ResourceManager = ({ isOpen, onClose, resources, setResources }) => {
  const [localRes, setLocalRes] = useState(resources);
  useEffect(() => { setLocalRes(resources); }, [resources]);
  if (!isOpen) return null;
  const handleSave = () => { setResources(localRes); onClose(); };
  const add = () => setLocalRes([...localRes, { id: Date.now(), title: 'New Resource', type: 'text', content: '' }]);
  const remove = (id) => setLocalRes(localRes.filter(r => r.id !== id));
  const update = (id, f, v) => setLocalRes(localRes.map(r => r.id === id ? { ...r, [f]: v } : r));

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', width:'600px', borderRadius:'16px', display:'flex', flexDirection:'column', maxHeight:'85vh', overflow:'hidden'}}>
        <div style={{padding:'20px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between'}}><h2 style={{margin:0, fontSize:'18px'}}>Manage Resources</h2><button onClick={onClose} style={{border:'none', background:'none'}}><X size={24}/></button></div>
        <div style={{padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'10px'}}>
          {localRes.map(r => (
            <div key={r.id} style={{border:`1px solid ${BORDER}`, padding:'10px', borderRadius:'8px', background:'#f9fafb'}}>
              <div style={{display:'flex', gap:'8px', marginBottom:'8px'}}>
                <input value={r.title} onChange={e => update(r.id, 'title', e.target.value)} style={{flexGrow:1, padding:'6px', border:`1px solid ${BORDER}`, borderRadius:'4px'}} placeholder="Title"/>
                <select value={r.type} onChange={e => update(r.id, 'type', e.target.value)} style={{padding:'6px', border:`1px solid ${BORDER}`, borderRadius:'4px'}}><option value="text">Text Popup</option><option value="link">Web Link</option></select>
                <button onClick={() => remove(r.id)} style={{color:'red', border:'none', background:'none'}}><Trash2 size={16}/></button>
              </div>
              <ReactQuill theme="snow" value={r.content} onChange={val => update(r.id, 'content', val)} />
            </div>
          ))}
          <button onClick={add} className="btn-secondary" style={{width:'100%'}}>+ Add Resource</button>
        </div>
        <div style={{padding:'20px', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'flex-end'}}><button className="btn-primary" onClick={handleSave} style={{background: JERRY_PINK, border:'none'}}>Save Changes</button></div>
      </div>
    </div>
  );
};

const ResourceSidebar = ({ resources, setResources }) => {
  const [expanded, setExpanded] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [activeResource, setActiveResource] = useState(null);

  return (
    <>
      <div onMouseEnter={() => setExpanded(true)} onMouseLeave={() => setExpanded(false)}
        style={{ width: expanded ? '240px' : '50px', height: '100%', backgroundColor: 'white', borderRight: `1px solid ${BORDER}`, transition: 'width 0.3s ease', display: 'flex', flexDirection: 'column', zIndex: 100, flexShrink: 0, boxShadow: '2px 0 5px rgba(0,0,0,0.05)' }}>
        <div style={{height: '60px', display: 'flex', alignItems: 'center', justifyContent: expanded ? 'flex-start' : 'center', padding: expanded ? '0 20px' : '0', color: JERRY_PINK, borderBottom: `1px solid ${BORDER}`}}>
          <BookOpen size={24}/>{expanded && <span style={{marginLeft: '12px', fontWeight: 'bold', whiteSpace: 'nowrap'}}>Quick Links</span>}
        </div>
        <div style={{flexGrow: 1, padding: '10px 0', overflowY: 'auto'}}>
          {resources.map(r => (
            <div key={r.id} onClick={() => r.type === 'link' ? window.open(r.content, '_blank') : setActiveResource(r)}
              style={{display: 'flex', alignItems: 'center', padding: '12px 0', paddingLeft: expanded ? '20px' : '0', justifyContent: expanded ? 'flex-start' : 'center', color: SLATE, cursor: 'pointer'}}
              onMouseOver={(e) => {e.currentTarget.style.color = JERRY_PINK; e.currentTarget.style.background = JERRY_BG}}
              onMouseOut={(e) => {e.currentTarget.style.color = SLATE; e.currentTarget.style.background = 'transparent'}}
            >
              {r.type === 'link' ? <LinkIcon size={20}/> : <FileText size={20}/>}
              {expanded && <span style={{marginLeft: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize:'14px'}}>{r.title}</span>}
            </div>
          ))}
        </div>
        <div style={{padding: '10px', borderTop: `1px solid ${BORDER}`}}>
          <button onClick={() => setManagerOpen(true)} style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: expanded ? 'flex-start' : 'center', background: 'transparent', border: 'none', borderRadius: '6px', color: SLATE, padding: '8px', cursor: 'pointer'}} onMouseOver={e=>e.currentTarget.style.color=JERRY_PINK} onMouseOut={e=>e.currentTarget.style.color=SLATE}>
            <Edit size={16}/>{expanded && <span style={{marginLeft: '10px'}}>Edit Resources</span>}
          </button>
        </div>
      </div>
      <ResourceManager isOpen={managerOpen} onClose={() => setManagerOpen(false)} resources={resources} setResources={setResources} />
      {activeResource && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)'}} onClick={() => setActiveResource(null)}></div>
          <div style={{width: '500px', maxHeight: '70vh', background: 'white', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '20px', pointerEvents: 'auto', display: 'flex', flexDirection: 'column', overflow: 'hidden'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '10px'}}>
              <h3 style={{margin: 0, fontSize: '18px', color: JERRY_PINK}}>{activeResource.title}</h3><button onClick={() => setActiveResource(null)} style={{background: 'none', border: 'none', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <div style={{flexGrow: 1, overflowY: 'auto', fontSize: '14px', lineHeight: '1.6'}} dangerouslySetInnerHTML={{__html: activeResource.content}}></div>
          </div>
        </div>
      )}
    </>
  );
};

// --- COMPONENT: Carrier Manager ---
const CarrierManager = ({ isOpen, onClose, carriers, setCarriers }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  if (!isOpen) return null;
  const handleSelect = (id) => { setSelectedId(id); setEditForm({ ...carriers[id] }); };
  const handleSave = () => { setCarriers(prev => ({ ...prev, [editForm.id]: editForm })); setSelectedId(null); };
  const handleDelete = () => { if(window.confirm("Delete?")) { const n = { ...carriers }; delete n[selectedId]; setCarriers(n); setSelectedId(null); }};
  const handleAdd = () => { const id = Date.now().toString(); const n = { id, name: "New Carrier", script: "" }; setCarriers(prev => ({ ...prev, [id]: n })); setSelectedId(id); setEditForm(n); };

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', width:'600px', height:'600px', borderRadius:'16px', display:'flex', flexDirection:'column', boxShadow:'0 20px 50px rgba(0,0,0,0.2)'}}>
        <div style={{padding:'20px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between'}}><h2 style={{margin:0, fontSize:'18px'}}>Manage Carriers</h2><button onClick={onClose} style={{border:'none', background:'none'}}><X size={24}/></button></div>
        <div style={{flexGrow:1, display:'flex', overflow:'hidden'}}>
          <div style={{width:'200px', borderRight:`1px solid ${BORDER}`, padding:'10px', background:'#f9fafb', overflowY:'auto'}}><button onClick={handleAdd} className="btn-primary" style={{width:'100%', marginBottom:'10px', background: JERRY_PINK, border:'none'}}>+ Add New</button>{Object.values(carriers).map(c => <div key={c.id} onClick={() => handleSelect(c.id)} style={{padding:'10px', cursor:'pointer', fontWeight: selectedId === c.id ? 'bold' : 'normal', color: selectedId === c.id ? JERRY_PINK : SLATE}}>{c.name}</div>)}</div>
          <div style={{flexGrow:1, padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column'}}>
            {selectedId && editForm ? (
                <div style={{display:'flex', flexDirection:'column', gap:'15px', height:'100%'}}>
                    <input className="node-input-text" style={{background:'white', border:`1px solid ${BORDER}`, width:'100%'}} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Carrier Name"/>
                    <div style={{flexGrow:1}}>
                        <ReactQuill theme="snow" value={editForm.script} onChange={(val) => setEditForm({...editForm, script: val})} style={{height:'300px'}}/>
                    </div>
                    <div style={{display:'flex', gap:'10px', marginTop:'60px'}}>
                        <button className="btn-primary" onClick={handleSave} style={{background:JERRY_PINK, border:'none'}}>Save</button>
                        <button className="btn-secondary" style={{color:'red', borderColor:'red'}} onClick={handleDelete}>Delete</button>
                    </div>
                </div>
            ) : <div style={{color:'#999'}}>Select a carrier</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- NODES ---
const ScriptNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : `1px solid ${BORDER}`}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{fontSize: '10px', color: data.isStart ? JERRY_PINK : '#999', fontWeight: data.isStart ? 'bold' : 'normal', textTransform:'uppercase'}}>{data.isStart ? 'START STEP' : 'Script Step'}</div>
        <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <div className="nodrag" style={{background:'white'}}>
        <ReactQuill theme="bubble" value={data.text} onChange={(val) => data.onChange(id, { ...data, text: val })} placeholder="Type script..." />
    </div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const CarrierNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : '1px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.1)'}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}><Building2 size={14} color="#8b5cf6"/><span style={{fontSize:'11px', color:'#8b5cf6', fontWeight:'800'}}>CARRIER LOOKUP</span></div>
        <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <div style={{fontSize:'12px', color:'#666', fontStyle:'italic', padding:'4px', background:'#f5f3ff', borderRadius:'4px'}}>Shows carrier dropdown.</div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const QuoteNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : `1px solid ${JERRY_PINK}`, boxShadow: `0 4px 6px -1px ${JERRY_PINK}20`}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}><DollarSign size={14} color={JERRY_PINK}/><span style={{fontSize:'11px', color:JERRY_PINK, fontWeight:'800'}}>QUOTE BUILDER</span></div>
        <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <textarea className="nodrag node-input-text" value={data.closingQuestion} onChange={(evt) => data.onChange(id, { ...data, closingQuestion: evt.target.value })} placeholder="Closing Question (Optional)..." rows={2}/>
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const ChecklistNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : `1px solid ${COMPLIANCE_ORANGE}`, boxShadow: `0 4px 6px -1px ${COMPLIANCE_ORANGE}20`}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}><ClipboardCheck size={14} color={COMPLIANCE_ORANGE}/><span style={{fontSize:'11px', color:COMPLIANCE_ORANGE, fontWeight:'800'}}>COMPLIANCE CHECK</span></div>
        <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <textarea className="nodrag node-input-text" style={{minHeight: '80px', fontFamily: 'monospace'}} value={data.items} onChange={(evt) => data.onChange(id, { ...data, items: evt.target.value })} placeholder="Enter one question per line... End with (yes/no) for radio buttons" />
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const nodeTypes = { scriptNode: ScriptNode, carrierNode: CarrierNode, quoteNode: QuoteNode, checklistNode: ChecklistNode };

// --- MAIN APP ---
export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [carriers, setCarriers] = useState(DEFAULT_CARRIERS);
  const [quoteSettings, setQuoteSettings] = useState(DEFAULT_QUOTE_SETTINGS);
  
  // UI State
  const [isCarrierModalOpen, setCarrierModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [resources, setResources] = useState(DEFAULT_RESOURCES);

  // Playbook State (Multiple Flows)
  const [availableFlows, setAvailableFlows] = useState([]);
  const [currentFlowName, setCurrentFlowName] = useState("default_flow.json");

  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState(null);
  
  // Checklist State Tracking - CHANGED to store Key:Value pairs instead of Array
  // Structure: { nodeId: { "Question 1": "checked", "Question 2": "yes", "Question 3": "no" } }
  const [activeChecklistState, setActiveChecklistState] = useState({});

  const updateNodeData = useCallback((id, newData) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...newData, onChange: updateNodeData, setAsStartNode: setAsStartNode } } : node));
  }, [setNodes]);

  const setAsStartNode = useCallback((id) => {
    setNodes((nds) => nds.map((node) => ({
      ...node,
      data: { ...node.data, isStart: node.id === id }
    })));
  }, [setNodes]);

  // Load list of flows AND current flow
  useEffect(() => {
    fetch(`${API_URL}/flows`).then(res => res.json()).then(files => {
        if(files.length === 0) setAvailableFlows(["default_flow.json"]);
        else setAvailableFlows(files);
    }).catch(() => setAvailableFlows(["default_flow.json"]));
    loadFlowData(currentFlowName);
  }, []);

  const loadFlowData = (filename) => {
    fetch(`${API_URL}/load?filename=${filename}`)
      .then(res => res.json())
      .then(data => {
        if (!data.nodes || data.nodes.length === 0) {
            setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Welcome to the Insurance Wizard', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true}}]);
            setEdges([]);
            setCarriers(DEFAULT_CARRIERS);
            setResources(DEFAULT_RESOURCES);
            setQuoteSettings(DEFAULT_QUOTE_SETTINGS);
            setHistory([]);
            return;
        }
        const nodesWithHandler = data.nodes.map(n => ({ ...n, data: { ...n.data, onChange: updateNodeData, setAsStartNode: setAsStartNode } }));
        setNodes(nodesWithHandler);
        setEdges(data.edges || []);
        setCarriers(data.carriers || DEFAULT_CARRIERS);
        setResources(data.resources || DEFAULT_RESOURCES);
        setQuoteSettings(data.quoteSettings || DEFAULT_QUOTE_SETTINGS);
        setHistory([]);
        setActiveChecklistState({}); // Reset checklists
        const start = nodesWithHandler.find(n => n.data.isStart) || nodesWithHandler.find(n => n.id === '1') || nodesWithHandler[0];
        if(start) setCurrentNodeId(start.id);
      }).catch(err => {
          setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Error loading file. Resetting...', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true}}]);
          setEdges([]);
          setHistory([]);
      });
  }

  const handleSwitchFlow = (e) => {
      const newFile = e.target.value;
      if (newFile === "NEW") {
          const name = prompt("Enter name for new Playbook (e.g., 'Home Insurance'):");
          if (name) {
              const safeName = name.toLowerCase().replace(/ /g, '_') + ".json";
              setAvailableFlows(prev => [...prev, safeName]);
              setCurrentFlowName(safeName);
              setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true}}]);
              setEdges([]);
              setCarriers(DEFAULT_CARRIERS);
              setResources(DEFAULT_RESOURCES);
              setQuoteSettings(DEFAULT_QUOTE_SETTINGS);
              setHistory([]);
              setCurrentNodeId('1');
          }
      } else {
          setCurrentFlowName(newFile);
          loadFlowData(newFile);
      }
  };

  const saveToServer = () => {
    const cleanNodes = nodes.map(n => { const { onChange, setAsStartNode, ...rest } = n.data; return { ...n, data: rest }; });
    fetch(`${API_URL}/save`, { 
      method: 'POST', 
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({ 
          filename: currentFlowName, 
          nodes: cleanNodes, edges, carriers, quoteSettings, resources 
        }) 
    }).then(res => res.json()).then(d => alert(d.message));
  };

  const onConnect = useCallback((params) => { const label = window.prompt("Choice label?", "Next"); setEdges((eds) => addEdge({ ...params, label: label || "Next" }, eds)); }, [setEdges]);
  const addNewNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'scriptNode', position: {x:250, y:150}, data: {label:'Step', text:'', onChange: updateNodeData, setAsStartNode: setAsStartNode}}]);
  const addCarrierNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'carrierNode', position: {x:250, y:150}, data: {label:'Select Carrier', onChange: updateNodeData, setAsStartNode: setAsStartNode}}]);
  const addQuoteNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'quoteNode', position: {x:250, y:150}, data: {label:'Present Quote', closingQuestion:'How does that price sound?', onChange: updateNodeData, setAsStartNode: setAsStartNode}}]);
  const addChecklistNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'checklistNode', position: {x:250, y:150}, data: {label:'Compliance Check', items:'Did you disclose the TCPA? (yes/no)\nDid you verify date of birth?', onChange: updateNodeData, setAsStartNode: setAsStartNode}}]);
  
  const deleteSelected = useCallback(() => { setNodes((nds) => nds.filter((n) => !n.selected)); setEdges((eds) => eds.filter((e) => !e.selected)); }, [setNodes, setEdges]);
  const getCurrentNode = () => nodes.find(n => n.id === currentNodeId);
  const getOptions = () => edges.filter(e => e.source === currentNodeId).map(e => ({ label: e.label || "Next", targetId: e.target }));

  const handleOptionClick = (targetId, label) => {
    const current = getCurrentNode();
    let historyData = { ...current, selectedOption: label };
    
    // Capture specific data based on node type
    if (current.type === 'carrierNode' && selectedCarrierId) {
        historyData.carrierInfo = carriers[selectedCarrierId];
    }
    if (current.type === 'checklistNode') {
        // Save the map of { question: answer }
        historyData.checklistAnswers = activeChecklistState[current.id] || {};
    }

    setHistory(prev => [...prev, historyData]);
    setCurrentNodeId(targetId);
    setSelectedCarrierId(null);
  };

  const resetWizard = () => { 
      const start = nodes.find(n => n.data.isStart) || nodes.find(n => n.id === '1') || nodes[0]; 
      if(start) setCurrentNodeId(start.id); 
      setHistory([]); 
      setSelectedCarrierId(null); 
      setActiveChecklistState({});
  };

  // NEW Helper: Update answer state (Supports "checked", "Yes", "No")
  const updateChecklistAnswer = (nodeId, itemText, value) => {
      setActiveChecklistState(prev => {
          const nodeState = prev[nodeId] || {};
          // If value is null, remove the key (uncheck)
          if (value === null) {
              const newState = { ...nodeState };
              delete newState[itemText];
              return { ...prev, [nodeId]: newState };
          }
          // Otherwise set the value ("checked", "Yes", "No")
          return { ...prev, [nodeId]: { ...nodeState, [itemText]: value } };
      });
  };

  const generateComplianceReport = () => {
      let report = `COMPLIANCE LOG - ${new Date().toLocaleString()}\n`;
      const complianceSteps = history.filter(h => h.type === 'checklistNode');
      if (complianceSteps.length === 0) return null;

      complianceSteps.forEach(step => {
          report += `\n[${step.data.label}]\n`;
          const allItems = (step.data.items || "").split('\n').filter(i => i.trim() !== "");
          const answers = step.checklistAnswers || {};
          
          allItems.forEach(rawItem => {
              const isYesNo = rawItem.toLowerCase().includes('(yes/no)');
              const cleanItem = rawItem.replace(/\(yes\/no\)/i, '').trim();
              const val = answers[cleanItem];

              if (isYesNo) {
                  // CHANGED: Answer on LEFT side in brackets [YES]
                  const displayVal = val ? val.toUpperCase() : ' ';
                  report += `[${displayVal}] ${cleanItem}\n`;
              } else {
                  // Checkbox also on LEFT side [X]
                  report += `[${val ? 'X' : ' '}] ${cleanItem}\n`;
              }
          });
      });
      return report;
  };

  const copyCompliance = () => {
      const text = generateComplianceReport();
      if(text) {
          navigator.clipboard.writeText(text);
          alert("Compliance Log copied to clipboard!");
      } else {
          alert("No compliance steps recorded.");
      }
  };

  // Helper to render checklist items in history/active view
  const renderChecklistItems = (itemsText, answers, nodeId, isInteractive) => {
      return (itemsText || "").split('\n').map((rawItem, i) => {
          if (!rawItem.trim()) return null;
          const isYesNo = rawItem.toLowerCase().includes('(yes/no)');
          const cleanItem = rawItem.replace(/\(yes\/no\)/i, '').trim();
          const currentVal = answers ? answers[cleanItem] : null;

          if (isYesNo) {
             return (
                 <div key={i} style={{margin:'8px 0', padding:'8px', background:'white', border:`1px solid ${BORDER}`, borderRadius:'6px'}}>
                     <div style={{fontSize:'14px', color:SLATE, marginBottom:'6px', fontWeight:'500'}}>{cleanItem}</div>
                     <div style={{display:'flex', gap:'12px'}}>
                         <label style={{display:'flex', alignItems:'center', gap:'4px', cursor: isInteractive ? 'pointer' : 'default'}}>
                             <input type="radio" 
                                disabled={!isInteractive}
                                checked={currentVal === 'Yes'} 
                                onChange={() => isInteractive && updateChecklistAnswer(nodeId, cleanItem, 'Yes')}
                                style={{accentColor: COMPLIANCE_ORANGE}}
                             />
                             <span style={{fontSize:'13px'}}>Yes</span>
                         </label>
                         <label style={{display:'flex', alignItems:'center', gap:'4px', cursor: isInteractive ? 'pointer' : 'default'}}>
                             <input type="radio" 
                                disabled={!isInteractive}
                                checked={currentVal === 'No'} 
                                onChange={() => isInteractive && updateChecklistAnswer(nodeId, cleanItem, 'No')}
                                style={{accentColor: COMPLIANCE_ORANGE}}
                             />
                             <span style={{fontSize:'13px'}}>No</span>
                         </label>
                     </div>
                 </div>
             );
          } else {
              return (
                  <label key={i} style={{display:'flex', gap:'10px', alignItems:'center', cursor: isInteractive ? 'pointer' : 'default', padding:'8px', background: isInteractive ? 'white' : 'transparent', borderRadius:'6px', border: isInteractive ? `1px solid ${BORDER}` : 'none'}}>
                      <input type="checkbox" 
                        disabled={!isInteractive}
                        checked={!!currentVal}
                        onChange={() => isInteractive && updateChecklistAnswer(nodeId, cleanItem, currentVal ? null : 'checked')}
                        style={{width:'16px', height:'16px', accentColor: COMPLIANCE_ORANGE}}
                      />
                      <span style={{fontSize:'14px', color:SLATE}}>{cleanItem}</span>
                  </label>
              );
          }
      });
  };

  return (
    <div className="app-container" style={{display:'flex', width:'100vw', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif'}}>
      <CarrierManager isOpen={isCarrierModalOpen} onClose={() => setCarrierModalOpen(false)} carriers={carriers} setCarriers={setCarriers} />
      <SettingsManager isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} settings={quoteSettings} setSettings={setQuoteSettings} />

      <ResourceSidebar resources={resources} setResources={setResources} />

      <div className="wizard-pane" style={{
          flex: showAdmin ? '0 0 30%' : '1', 
          maxWidth: showAdmin ? '30%' : '100%',
          borderRight: showAdmin ? `1px solid ${BORDER}` : 'none', 
          display:'flex', flexDirection:'column', background: 'white'
        }}>
        <div className="wizard-header" style={{borderBottom:`1px solid ${BORDER}`, padding:'15px 20px', display:'flex', alignItems:'center'}}>
          <img src={jerryLogo} alt="Jerry" style={{height:'30px', marginRight:'10px'}} />
          <div style={{ fontWeight: '700', fontSize: '18px', color: SLATE }}>Insurance Wizard</div>
          <div style={{ flexGrow: 1 }}></div>
          
          <div style={{display:'flex', alignItems:'center', gap:'4px', marginRight:'12px'}}>
              <FolderOpen size={16} color={SLATE} />
              <select value={currentFlowName} onChange={(e) => { setCurrentFlowName(e.target.value); loadFlowData(e.target.value); }} style={{fontSize:'12px', padding:'4px', borderRadius:'4px', maxWidth:'120px', border:`1px solid ${BORDER}`}}>
                  {availableFlows.map(f => <option key={f} value={f}>{f.replace('.json','')}</option>)}
              </select>
          </div>

          <button className="btn btn-secondary" onClick={() => setShowAdmin(!showAdmin)} style={{marginRight:'10px', color: showAdmin ? JERRY_PINK : '#999', borderColor: 'transparent'}}>
             {showAdmin ? <Unlock size={16}/> : <Lock size={16}/>}
          </button>
          <button className="btn btn-secondary" onClick={resetWizard} style={{color: SLATE}}><RefreshCw size={16} /></button>
        </div>
        
        <div className="wizard-content" style={{background: 'white'}}>
          {history.map((step, idx) => (
            <div key={idx} style={{opacity:0.6, marginBottom:'20px'}}>
              <div className="bubble" style={{background: '#F3F4F6'}}>
                <div className="bubble-label" style={{color: SLATE}}>{step.data.label}</div>
                {step.type === 'scriptNode' && <div className="bubble-text" style={{color: SLATE}} dangerouslySetInnerHTML={{__html: step.data.text}}></div>}
                {step.type === 'carrierNode' && step.carrierInfo && <div><div style={{fontWeight:'bold', color:JERRY_PINK}}>{step.carrierInfo.name} Selected</div><div style={{fontSize:'12px'}} dangerouslySetInnerHTML={{__html: step.carrierInfo.script}}></div></div>}
                {step.type === 'checklistNode' && (
                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                        {renderChecklistItems(step.data.items, step.checklistAnswers, step.id, false)}
                    </div>
                )}
                {step.type === 'quoteNode' && <div style={{fontStyle:'italic', color:'#666'}}>Quote presented.</div>}
              </div>
            </div>
          ))}
          
          {getCurrentNode() && (
            <div className="bubble" style={{ borderLeft: `4px solid ${getCurrentNode().type === 'carrierNode' ? '#8b5cf6' : getCurrentNode().type === 'quoteNode' ? JERRY_PINK : getCurrentNode().type === 'checklistNode' ? COMPLIANCE_ORANGE : '#E5090E'}`, background: JERRY_BG }}>
              <div className="bubble-label" style={{color: JERRY_PINK}}>{getCurrentNode().data.label}</div>
              
              {getCurrentNode().type === 'scriptNode' && <div className="bubble-text" style={{color: SLATE}} dangerouslySetInnerHTML={{__html: getCurrentNode().data.text}}></div>}
              
              {getCurrentNode().type === 'carrierNode' && (
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                  <div className="bubble-text" style={{color: SLATE}}>Select carrier for instructions:</div>
                  <select style={{padding:'8px', borderRadius:'8px', border:`1px solid ${BORDER}`, fontSize:'14px'}} onChange={(e) => setSelectedCarrierId(e.target.value)} value={selectedCarrierId || ""}><option value="" disabled>-- Choose Carrier --</option>{Object.values(carriers).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                  {selectedCarrierId && carriers[selectedCarrierId] && <div style={{background:'white', padding:'10px', borderRadius:'8px', border:`1px solid ${BORDER}`}}><div style={{fontWeight:'bold', color:JERRY_PINK, marginBottom:'6px'}}>{carriers[selectedCarrierId].name}</div><div style={{fontSize:'13px', color:SLATE}} dangerouslySetInnerHTML={{__html: carriers[selectedCarrierId].script}}></div></div>}
                </div>
              )}

              {getCurrentNode().type === 'checklistNode' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                      {renderChecklistItems(getCurrentNode().data.items, activeChecklistState[getCurrentNode().id], getCurrentNode().id, true)}
                  </div>
              )}

              {getCurrentNode().type === 'quoteNode' && (<QuoteBuilderForm closingQuestion={getCurrentNode().data.closingQuestion} settings={quoteSettings} carriers={carriers} />)}
            </div>
          )}
        </div>
        
        <div className="wizard-actions">
          {getCurrentNode() && getOptions().map((opt, idx) => (
            <button key={idx} className="btn-option" disabled={getCurrentNode().type === 'carrierNode' && !selectedCarrierId} style={{opacity: (getCurrentNode().type === 'carrierNode' && !selectedCarrierId) ? 0.5 : 1, borderColor: BORDER, color: SLATE}} onClick={() => handleOptionClick(opt.targetId, opt.label)}><span>{opt.label}</span><ChevronRight size={16} color={JERRY_PINK} /></button>
          ))}
          {getCurrentNode() && getOptions().length === 0 && (
             <div style={{display:'flex', flexDirection:'column', gap:'10px', width:'100%'}}>
                 {/* Only show "Copy Compliance Log" if checklists exist in history */}
                 {history.some(h => h.type === 'checklistNode') && (
                      <button onClick={copyCompliance} className="btn-secondary" style={{borderColor: COMPLIANCE_ORANGE, color: '#9a3412', background:'#fff7ed', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px'}}>
                         <ClipboardCheck size={16}/> Copy Compliance Log
                      </button>
                 )}
                 <button className="btn btn-primary" onClick={resetWizard} style={{background: JERRY_PINK, border:'none', width: '100%'}}>Complete Call</button>
             </div>
          )}
        </div>
      </div>

      {showAdmin && (
        <div className="editor-pane" style={{width: '70%', minWidth: '350px', display:'flex', flexDirection:'column', background:'#f0f2f5', borderLeft:`1px solid ${BORDER}`}}>
          <div className="editor-toolbar" style={{display:'flex', gap:'8px', padding:'10px', background:'#fff', borderBottom:`1px solid ${BORDER}`}}>
            <button className="btn btn-primary" onClick={saveToServer} style={{background: JERRY_PINK, border:'none'}}><Save size={16}/></button>
            <div style={{width:'1px', height:'20px', background: BORDER, margin:'0 4px'}}></div>
            
            <div style={{display:'flex', alignItems:'center', gap:'4px', marginRight:'8px'}}>
                <FolderOpen size={16} color={SLATE} />
                <select value={currentFlowName} onChange={handleSwitchFlow} style={{fontSize:'12px', padding:'4px', borderRadius:'4px', maxWidth:'120px'}}>
                    {availableFlows.map(f => <option key={f} value={f}>{f.replace('.json','')}</option>)}
                    <option value="NEW">+ New Playbook...</option>
                </select>
            </div>

            <div style={{width:'1px', height:'20px', background: BORDER, margin:'0 4px'}}></div>
            <button className="btn btn-secondary" onClick={() => setSettingsModalOpen(true)} title="Config"><Settings size={16}/></button>
            <button className="btn btn-secondary" onClick={() => setCarrierModalOpen(true)} title="Carriers"><Building2 size={16}/></button>
            <div style={{width:'1px', height:'20px', background: BORDER, margin:'0 4px'}}></div>
            <button className="btn btn-secondary" onClick={addNewNode} title="Add Script"><Plus size={16}/></button>
            <button className="btn btn-secondary" onClick={addChecklistNode} style={{color: COMPLIANCE_ORANGE}} title="Add Checklist"><ClipboardCheck size={16}/></button>
            <button className="btn btn-secondary" onClick={addCarrierNode} style={{color:'#8b5cf6'}} title="Add Carrier"><Building2 size={16}/></button>
            <button className="btn btn-secondary" onClick={addQuoteNode} style={{color: JERRY_PINK}} title="Add Quote"><DollarSign size={16}/></button>
            <div style={{flexGrow:1}}></div>
            <button className="btn btn-secondary" onClick={deleteSelected} style={{color:'red'}}><Trash2 size={16}/></button>
          </div>
          <div style={{flexGrow:1, position:'relative'}}>
            <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView>
              <Background color="#ccc" gap={20} />
              <Controls />
            </ReactFlow>
          </div>
        </div>
      )}
    </div>
  );
}