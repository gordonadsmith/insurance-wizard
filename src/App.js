import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  addEdge, Background, Controls, useNodesState, useEdgesState, Handle, Position 
} from 'reactflow';
import 'reactflow/dist/style.css';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';   
import 'react-quill-new/dist/quill.bubble.css'; 
import { Plus, RefreshCw, ChevronRight, Trash2, Save, Building2, X, DollarSign, Settings, CheckSquare, Copy, Layers, Lock, Unlock, Flag, BookOpen, Link as LinkIcon, FileText, Edit, FolderOpen, ClipboardCheck, FolderCog, Pencil, Upload, Download, GitBranch } from 'lucide-react';
import './App.css';

import jerryLogo from './jerry_logo.png'; 

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = "/api"; 
const USE_LOCAL_STORAGE = true;

const JERRY_PINK = "#E9406A";
const JERRY_BG = "#FDF2F4"; 
const SLATE = "#475569";
const BORDER = "#E5E7EB";
const COMPLIANCE_ORANGE = "#F59E0B"; 

// ============================================================================
// UTILITIES
// ============================================================================

const FormatText = ({ text }) => {
  if (!text) return null;
  const htmlContent = text.replace(/\r?\n/g, '<br />');
  return (
    <div 
      className="formatted-text-content"
      style={{ 
        lineHeight: '1.6', 
        wordWrap: 'break-word',
        whiteSpace: 'normal',
        cursor: 'text',
        width: '100%' 
      }}
      dangerouslySetInnerHTML={{ __html: htmlContent }} 
    />
  );
};

const cleanHTML = (html) => {
  if (!html) return '';
  return html.replace(/&nbsp;/g, ' ');
};

// ============================================================================
// DEFAULTS
// ============================================================================
const DEFAULT_CARRIERS = {
  "1": { 
    id: "1", 
    name: "Progressive", 
    scripts: {
      "Quote": "<p><strong>Quote Process:</strong></p><p>Verify garaging address matches license.</p><p><strong>Phone:</strong> 1-800-776-4737</p>",
      "Sale": "<p><strong>Sale Process:</strong></p><p>Confirm down payment and start date.</p><p><strong>Phone:</strong> 1-800-776-4737</p>",
      "Billing": "<p><strong>Billing Support:</strong></p><p>Verify payment method on file.</p><p><strong>Phone:</strong> 1-800-776-4737</p>"
    }
  },
};

const DEFAULT_CALL_TYPES = ["Quote", "Sale", "Billing", "Service", "Claims", "Other"];

const DEFAULT_RESOURCES = [
  { id: '1', title: 'Callback Script', type: 'text', content: '<p>Hi, this is [Name] from Jerry.</p><p>I was working on your quote...</p>' },
  { id: '2', title: 'Carrier Matrix', type: 'link', content: 'https://google.com' }
];

const DEFAULT_ISSUES = [
  { id: '1', title: 'Customer refuses quote', category: 'Sales', keywords: 'refuse reject decline no thanks', solution: '<p><strong>Best Practice:</strong></p><ul><li>Ask what concerns they have</li><li>Address specific objections</li><li>Offer to email quote for review</li><li>Schedule callback time</li></ul>' },
  { id: '2', title: 'Payment processing fails', category: 'Service', keywords: 'payment declined card error processing', solution: '<p><strong>Steps:</strong></p><ol><li>Verify card number and expiration</li><li>Try a different payment method</li><li>Contact carrier billing: [Number]</li><li>Offer to call back after they check with bank</li></ol>' },
  { id: '3', title: 'Customer claims better price elsewhere', category: 'Sales', keywords: 'cheaper price better rate competition', solution: '<p><strong>Response:</strong></p><p>Ask what the other quote includes to ensure apples-to-apples comparison. Often our coverage is more comprehensive.</p><p>Highlight our service advantages and claim support.</p>' },
];

const ISSUE_CATEGORIES = ['Sales', 'Service', 'Technical', 'Billing', 'Claims', 'Policy Changes', 'Other'];

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

// QuoteBuilderForm
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
      <div style={{display:'flex', gap:'8px', flexWrap:'wrap'}}>
        <div style={{flexGrow:1, minWidth:'150px'}}><label style={{fontSize:'11px', fontWeight:'bold', color: SLATE}}>CARRIER</label><select style={{width:'100%', padding:'8px', borderRadius:'6px', border:`1px solid ${BORDER}`, background:'white'}} value={selectedCarrier} onChange={e => setSelectedCarrier(e.target.value)}><option value="">-- Select --</option>{Object.values(carriers).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
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
        <div style={{background:'white', border:`2px solid ${JERRY_PINK}`, borderRadius:'8px', padding:'12px', fontSize:'15px', lineHeight:'1.6', wordWrap: 'break-word', whiteSpace: 'normal', wordBreak: 'normal', overflowWrap: 'break-word'}} dangerouslySetInnerHTML={{__html: cleanHTML(generateScript())}}></div>
      </div>
    </div>
  );
};

// SettingsManager
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

// IssuesManager
const IssuesManager = ({ isOpen, onClose, issues, setIssues }) => {
  const [localIssues, setLocalIssues] = useState(issues);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  
  useEffect(() => { 
    if (isOpen) {
      setLocalIssues(issues);
      if (issues.length > 0) {
        const firstCategory = issues[0].category || 'Other';
        setExpandedCategories({ [firstCategory]: true });
      }
    }
  }, [issues, isOpen]);
  
  if (!isOpen) return null;
  
  const handleSave = () => { setIssues(localIssues); onClose(); };
  const add = () => {
    const newIssue = { id: Date.now(), title: 'New Issue', category: 'Other', keywords: '', solution: '' };
    setLocalIssues([...localIssues, newIssue]);
    setExpandedId(newIssue.id);
    setExpandedCategories(prev => ({ ...prev, 'Other': true }));
  };
  const remove = (id) => {
    if (window.confirm('Delete this issue?')) {
      setLocalIssues(localIssues.filter(i => i.id !== id));
      if (expandedId === id) setExpandedId(null);
    }
  };
  const update = (id, f, v) => {
    setLocalIssues(prevIssues => prevIssues.map(i => i.id === id ? { ...i, [f]: v } : i));
  };

  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const groupedIssues = localIssues.reduce((acc, issue) => {
    const cat = issue.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {});

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', width:'800px', borderRadius:'16px', display:'flex', flexDirection:'column', maxHeight:'90vh', overflow:'hidden'}}>
        <div style={{padding:'20px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between'}}>
          <h2 style={{margin:0, fontSize:'18px', display:'flex', alignItems:'center', gap:'8px'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Manage Common Issues
          </h2>
          <button onClick={onClose} style={{border:'none', background:'none', cursor:'pointer'}}><X size={24}/></button>
        </div>
        
        <div style={{padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'10px'}}>
          {ISSUE_CATEGORIES.map(category => {
            const categoryIssues = groupedIssues[category] || [];
            if (categoryIssues.length === 0) return null;
            
            return (
              <div key={category} style={{border:`1px solid ${BORDER}`, borderRadius:'8px', background:'#f9fafb'}}>
                {/* Category Header */}
                <div 
                  onClick={() => toggleCategory(category)}
                  style={{
                    padding:'12px 15px',
                    display:'flex',
                    justifyContent:'space-between',
                    alignItems:'center',
                    cursor:'pointer',
                    background: expandedCategories[category] ? '#f3f4f6' : 'white',
                    borderRadius:'8px',
                    transition:'background 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.background = '#e5e7eb'}
                  onMouseOut={e => e.currentTarget.style.background = expandedCategories[category] ? '#f3f4f6' : 'white'}
                >
                  <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                    <ChevronRight 
                      size={18} 
                      style={{
                        transform: expandedCategories[category] ? 'rotate(90deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s'
                      }}
                    />
                    <span style={{fontWeight:'bold', fontSize:'15px', color:SLATE}}>{category}</span>
                    <span style={{fontSize:'12px', color:'#999', background:'#e5e7eb', padding:'2px 8px', borderRadius:'10px'}}>
                      {categoryIssues.length}
                    </span>
                  </div>
                </div>

                {/* Issues in Category */}
                {expandedCategories[category] && (
                  <div style={{padding:'10px', display:'flex', flexDirection:'column', gap:'8px'}}>
                    {categoryIssues.map(issue => (
                      <div key={issue.id} style={{border:`1px solid ${BORDER}`, borderRadius:'6px', background:'white'}}>
                        {/* Issue Header - Collapsed View */}
                        <div 
                          onClick={() => setExpandedId(expandedId === issue.id ? null : issue.id)}
                          style={{
                            padding:'10px 12px',
                            display:'flex',
                            justifyContent:'space-between',
                            alignItems:'center',
                            cursor:'pointer',
                            background: expandedId === issue.id ? '#fef3c7' : 'white',
                            borderRadius:'6px'
                          }}
                        >
                          <div style={{display:'flex', alignItems:'center', gap:'8px', flexGrow:1}}>
                            <ChevronRight 
                              size={14} 
                              style={{
                                transform: expandedId === issue.id ? 'rotate(90deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s',
                                color:'#92400e'
                              }}
                            />
                            <span style={{fontSize:'14px', fontWeight:'500'}}>{issue.title}</span>
                          </div>
                          <button 
                            onClick={(e) => { e.stopPropagation(); remove(issue.id); }}
                            style={{color:'red', border:'none', background:'none', cursor:'pointer', padding:'4px'}}
                            title="Delete"
                          >
                            <Trash2 size={14}/>
                          </button>
                        </div>

                        {/* Issue Details - Expanded View */}
                        {expandedId === issue.id && (
                          <div style={{padding:'15px', borderTop:`1px solid ${BORDER}`}}>
                            <div style={{display:'flex', gap:'10px', marginBottom:'12px'}}>
                              <div style={{flexGrow:1}}>
                                <label style={{fontSize:'11px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'4px'}}>
                                  TITLE
                                </label>
                                <input 
                                  value={issue.title || ''} 
                                  onChange={e => update(issue.id, 'title', e.target.value)} 
                                  style={{width:'100%', padding:'8px', border:`1px solid ${BORDER}`, borderRadius:'4px', fontSize:'14px'}} 
                                  placeholder="Issue Title"
                                />
                              </div>
                              <div style={{width:'200px'}}>
                                <label style={{fontSize:'11px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'4px'}}>
                                  CATEGORY
                                </label>
                                <select
                                  value={issue.category || 'Other'}
                                  onChange={e => update(issue.id, 'category', e.target.value)}
                                  style={{width:'100%', padding:'8px', border:`1px solid ${BORDER}`, borderRadius:'4px', fontSize:'14px'}}
                                >
                                  {ISSUE_CATEGORIES.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            
                            <div style={{marginBottom:'12px'}}>
                              <label style={{fontSize:'11px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'4px'}}>
                                SEARCH KEYWORDS (space-separated)
                              </label>
                              <input 
                                value={issue.keywords || ''} 
                                onChange={e => update(issue.id, 'keywords', e.target.value)} 
                                style={{width:'100%', padding:'8px', border:`1px solid ${BORDER}`, borderRadius:'4px', fontSize:'13px'}} 
                                placeholder="e.g., payment decline card error"
                              />
                            </div>
                            
                            <div>
                              <label style={{fontSize:'11px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'4px'}}>
                                SOLUTION (HTML supported)
                              </label>
                              <div style={{minHeight: '200px'}}>
                                <ReactQuill 
                                  theme="snow" 
                                  value={issue.solution || ''} 
                                  onChange={(content, delta, source, editor) => {
                                    if (source === 'user') {
                                      update(issue.id, 'solution', content);
                                    }
                                  }}
                                  style={{background:'white', minHeight:'150px'}}
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          <button onClick={add} className="btn-secondary" style={{width:'100%', padding:'12px', marginTop:'10px'}}>
            + Add New Issue
          </button>
        </div>
        
        <div style={{padding:'20px', borderTop:`1px solid ${BORDER}`, display:'flex', justifyContent:'flex-end'}}>
          <button className="btn-primary" onClick={handleSave} style={{background: JERRY_PINK, border:'none'}}>Save Changes</button>
        </div>
      </div>
    </div>
  );
};

// ResourceManager
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

// ResourceSidebar
const ResourceSidebar = ({ resources, setResources, issues, setIssues }) => {
  const [expanded, setExpanded] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [issuesManagerOpen, setIssuesManagerOpen] = useState(false);
  const [activeResource, setActiveResource] = useState(null);
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeIssue, setActiveIssue] = useState(null);
  const [expandedIssueCategories, setExpandedIssueCategories] = useState({});

  const filteredIssues = issues.filter(issue => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      issue.title.toLowerCase().includes(query) ||
      issue.keywords.toLowerCase().includes(query) ||
      (issue.category && issue.category.toLowerCase().includes(query))
    );
  });

  const groupedIssues = filteredIssues.reduce((acc, issue) => {
    const cat = issue.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(issue);
    return acc;
  }, {});

  const toggleIssueCategory = (category) => {
    setExpandedIssueCategories(prev => ({ ...prev, [category]: !prev[category] }));
  };

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

        {/* Common Issues Section */}
        <div style={{borderTop: `2px solid ${BORDER}`, background: '#fef3c7'}}>
          <div 
            onClick={() => setIssuesExpanded(!issuesExpanded)}
            style={{
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: expanded ? 'space-between' : 'center',
              padding: expanded ? '12px 20px' : '12px 0',
              cursor: 'pointer',
              color: '#92400e'
            }}
          >
            {expanded ? (
              <>
                <div style={{display:'flex', alignItems:'center', gap:'8px', fontWeight:'bold', fontSize:'13px'}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Common Issues
                </div>
                <ChevronRight size={16} style={{transform: issuesExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s'}}/>
              </>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            )}
          </div>

          {issuesExpanded && expanded && (
            <div style={{padding: '0 15px 15px', maxHeight: '300px', overflowY: 'auto'}}>
              <input 
                type="text"
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: `1px solid #fbbf24`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  marginBottom: '8px'
                }}
              />
              <div style={{display: 'flex', flexDirection: 'column', gap: '4px'}}>
                {Object.keys(groupedIssues).length > 0 ? (
                  Object.entries(groupedIssues).map(([category, categoryIssues]) => (
                    <div key={category} style={{marginBottom: '4px'}}>
                      {/* Category Header */}
                      <div 
                        onClick={() => toggleIssueCategory(category)}
                        style={{
                          padding: '6px 8px',
                          background: '#fbbf24',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#78350f',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{category} ({categoryIssues.length})</span>
                        <ChevronRight 
                          size={12} 
                          style={{
                            transform: expandedIssueCategories[category] ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s'
                          }}
                        />
                      </div>
                      
                      {/* Issues in Category */}
                      {expandedIssueCategories[category] && (
                        <div style={{display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', marginLeft: '8px'}}>
                          {categoryIssues.map(issue => (
                            <div 
                              key={issue.id}
                              onClick={() => setActiveIssue(issue)}
                              style={{
                                padding: '6px 8px',
                                background: 'white',
                                borderRadius: '4px',
                                border: '1px solid #fbbf24',
                                cursor: 'pointer',
                                fontSize: '11px',
                                color: '#92400e',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = '#fffbeb'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                            >
                              {issue.title}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{fontSize: '11px', color: '#92400e', fontStyle: 'italic', textAlign: 'center', padding: '10px'}}>
                    No issues found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{padding: '10px', borderTop: `1px solid ${BORDER}`}}>
          <button onClick={() => setManagerOpen(true)} style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: expanded ? 'flex-start' : 'center', background: 'transparent', border: 'none', borderRadius: '6px', color: SLATE, padding: '8px', cursor: 'pointer', marginBottom: '4px'}} onMouseOver={e=>e.currentTarget.style.color=JERRY_PINK} onMouseOut={e=>e.currentTarget.style.color=SLATE}>
            <Edit size={16}/>{expanded && <span style={{marginLeft: '10px', fontSize:'13px'}}>Edit Resources</span>}
          </button>
          <button onClick={() => setIssuesManagerOpen(true)} style={{width: '100%', display: 'flex', alignItems: 'center', justifyContent: expanded ? 'flex-start' : 'center', background: 'transparent', border: 'none', borderRadius: '6px', color: '#92400e', padding: '8px', cursor: 'pointer'}} onMouseOver={e=>e.currentTarget.style.color='#78350f'} onMouseOut={e=>e.currentTarget.style.color='#92400e'}>
            <Edit size={16}/>{expanded && <span style={{marginLeft: '10px', fontSize:'13px'}}>Edit Issues</span>}
          </button>
        </div>
      </div>
      <ResourceManager isOpen={managerOpen} onClose={() => setManagerOpen(false)} resources={resources} setResources={setResources} />
      <IssuesManager isOpen={issuesManagerOpen} onClose={() => setIssuesManagerOpen(false)} issues={issues} setIssues={setIssues} />
      
      {/* Resource Popup */}
      {activeResource && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)'}} onClick={() => setActiveResource(null)}></div>
          <div style={{position: 'relative', width: '500px', maxHeight: '70vh', background: 'white', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 2001}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '10px'}}>
              <h3 style={{margin: 0, fontSize: '18px', color: JERRY_PINK}}>{activeResource.title}</h3><button onClick={() => setActiveResource(null)} style={{background: 'none', border: 'none', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <div style={{flexGrow: 1, overflowY: 'auto', fontSize: '14px', lineHeight: '1.6'}} dangerouslySetInnerHTML={{__html: activeResource.content}}></div>
          </div>
        </div>
      )}

      {/* Issue Popup */}
      {activeIssue && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)'}} onClick={() => setActiveIssue(null)}></div>
          <div style={{position: 'relative', width: '500px', maxHeight: '70vh', background: 'white', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '2px solid #fbbf24', zIndex: 2001}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: `2px solid #fbbf24`, paddingBottom: '10px'}}>
              <h3 style={{margin: 0, fontSize: '18px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px'}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {activeIssue.title}
              </h3>
              <button onClick={() => setActiveIssue(null)} style={{background: 'none', border: 'none', cursor: 'pointer'}}><X size={20}/></button>
            </div>
            <div style={{flexGrow: 1, overflowY: 'auto', fontSize: '14px', lineHeight: '1.6'}} dangerouslySetInnerHTML={{__html: activeIssue.solution}}></div>
          </div>
        </div>
      )}
    </>
  );
};

// PlaybookManager
const PlaybookManager = ({ isOpen, onClose, availableFlows, refreshList, currentFlowName, setCurrentFlowName, loadFlowData }) => {
    const [renamingId, setRenamingId] = useState(null);
    const [newName, setNewName] = useState("");

    if (!isOpen) return null;

    const handleRename = (oldName) => {
        let safeNewName = newName.trim();
        if(!safeNewName) return;
        
        if (!safeNewName.endsWith('.json')) {
            safeNewName = safeNewName + '.json';
        }
        
        if (USE_LOCAL_STORAGE) {
          const oldData = localStorage.getItem(`insurance-wizard-${oldName}`);
          
          if (oldData) {
              localStorage.setItem(`insurance-wizard-${safeNewName}`, oldData);
              localStorage.removeItem(`insurance-wizard-${oldName}`);
          }
          
          const flows = JSON.parse(localStorage.getItem('insurance-wizard-flows') || '[]');
          const updatedFlows = flows.map(f => f === oldName ? safeNewName : f);
          localStorage.setItem('insurance-wizard-flows', JSON.stringify(updatedFlows));
          
          refreshList();
          if(currentFlowName === oldName) {
              setCurrentFlowName(safeNewName);
          }
          setRenamingId(null);
          setNewName("");
        } else {
          fetch(`${API_URL}/rename_flow`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ oldFilename: oldName, newFilename: safeNewName })
          }).then(res => res.json()).then(data => {
              if(data.message.includes("success")) {
                  refreshList();
                  if(currentFlowName === oldName) {
                      setCurrentFlowName(data.newFilename);
                  }
                  setRenamingId(null);
                  setNewName("");
              } else {
                  alert(data.message);
              }
          });
        }
    };

    const handleDelete = (filename) => {
        if(!window.confirm(`Are you sure you want to delete "${filename}"? This cannot be undone.`)) return;
        
        if (USE_LOCAL_STORAGE) {
          localStorage.removeItem(`insurance-wizard-${filename}`);
          
          const flows = JSON.parse(localStorage.getItem('insurance-wizard-flows') || '[]');
          const updatedFlows = flows.filter(f => f !== filename);
          localStorage.setItem('insurance-wizard-flows', JSON.stringify(updatedFlows));
          
          refreshList();
          if(currentFlowName === filename) {
              window.location.reload(); 
          }
        } else {
          fetch(`${API_URL}/delete_flow`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({ filename })
          }).then(res => res.json()).then(data => {
              if(data.message.includes("success")) {
                  refreshList();
                  if(currentFlowName === filename) {
                      window.location.reload(); 
                  }
              } else {
                  alert(data.message);
              }
          });
        }
    };

    const handleCopy = (filename) => {
        const baseName = filename.replace('.json', '');
        const copyName = prompt(`Enter name for the copy of "${baseName}":`, `${baseName} (Copy)`);
        
        if (!copyName || copyName.trim() === '') return;
        
        let safeCopyName = copyName.trim();
        if (!safeCopyName.endsWith('.json')) {
            safeCopyName = safeCopyName + '.json';
        }
        
        if (USE_LOCAL_STORAGE) {
            const originalData = localStorage.getItem(`insurance-wizard-${filename}`);
            
            if (originalData) {
                localStorage.setItem(`insurance-wizard-${safeCopyName}`, originalData);
                
                const flows = JSON.parse(localStorage.getItem('insurance-wizard-flows') || '[]');
                if (!flows.includes(safeCopyName)) {
                    flows.push(safeCopyName);
                    localStorage.setItem('insurance-wizard-flows', JSON.stringify(flows));
                }
                
                refreshList();
                setCurrentFlowName(safeCopyName);
                loadFlowData(safeCopyName);
                onClose();
            } else {
                alert('Could not find the original playbook to copy.');
            }
        } else {
            fetch(`${API_URL}/copy_flow`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ sourceFilename: filename, newFilename: safeCopyName })
            }).then(res => res.json()).then(data => {
                if(data.message && data.message.includes("success")) {
                    refreshList();
                    setCurrentFlowName(safeCopyName);
                    loadFlowData(safeCopyName);
                    onClose();
                } else {
                    alert(data.message || 'Error copying playbook');
                }
            }).catch(err => {
                alert('Error copying playbook');
            });
        }
    };

    const handleExport = (filename) => {
        if (USE_LOCAL_STORAGE) {
            const data = localStorage.getItem(`insurance-wizard-${filename}`);
            if (!data) {
                alert('Playbook not found');
                return;
            }
            
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            fetch(`${API_URL}/load?filename=${filename}`)
                .then(res => res.json())
                .then(data => {
                    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                })
                .catch(err => alert('Error exporting playbook'));
        }
    };

    const handleImport = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    
                    if (!data.nodes || !data.edges) {
                        alert('Invalid playbook file - missing required data');
                        return;
                    }
                    
                    let importName = file.name;
                    if (!importName.endsWith('.json')) {
                        importName = importName + '.json';
                    }
                    
                    if (availableFlows.includes(importName)) {
                        const overwrite = window.confirm(`Playbook "${importName}" already exists. Overwrite?`);
                        if (!overwrite) {
                            const newName = prompt('Enter a new name for this playbook:', importName.replace('.json', '') + ' (Imported)');
                            if (!newName) return;
                            importName = newName.endsWith('.json') ? newName : newName + '.json';
                        }
                    }
                    
                    if (USE_LOCAL_STORAGE) {
                        localStorage.setItem(`insurance-wizard-${importName}`, JSON.stringify(data));
                        
                        const flows = JSON.parse(localStorage.getItem('insurance-wizard-flows') || '[]');
                        if (!flows.includes(importName)) {
                            flows.push(importName);
                            localStorage.setItem('insurance-wizard-flows', JSON.stringify(flows));
                        }
                        
                        refreshList();
                        alert(`Successfully imported "${importName}"`);
                        
                        if (window.confirm('Switch to imported playbook now?')) {
                            setCurrentFlowName(importName);
                            loadFlowData(importName);
                            onClose();
                        }
                    } else {
                        fetch(`${API_URL}/save`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ ...data, filename: importName })
                        }).then(res => res.json()).then(result => {
                            refreshList();
                            alert(`Successfully imported "${importName}"`);
                            if (window.confirm('Switch to imported playbook now?')) {
                                setCurrentFlowName(importName);
                                loadFlowData(importName);
                                onClose();
                            }
                        }).catch(err => alert('Error importing playbook'));
                    }
                } catch (err) {
                    alert('Error reading file - invalid JSON format');
                    console.error(err);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };

    return (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1300, display:'flex', alignItems:'center', justifyContent:'center'}}>
            <div style={{background:'white', width:'500px', borderRadius:'16px', padding:'20px', boxShadow:'0 20px 50px rgba(0,0,0,0.2)'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', borderBottom:`1px solid ${BORDER}`, paddingBottom:'10px'}}>
                    <h3 style={{margin:0, display:'flex', alignItems:'center', gap:'8px'}}><FolderCog size={20} color={SLATE}/> Manage Playbooks</h3>
                    <button onClick={onClose} style={{border:'none', background:'none', cursor:'pointer'}}><X size={20}/></button>
                </div>
                
                {/* Import Button */}
                <div style={{marginBottom:'15px'}}>
                    <button 
                        onClick={handleImport} 
                        className="btn-primary"
                        style={{
                            width:'100%', 
                            background:'#10b981', 
                            border:'none',
                            padding:'10px',
                            display:'flex',
                            alignItems:'center',
                            justifyContent:'center',
                            gap:'8px'
                        }}
                    >
                        <Upload size={16}/>
                        Import Playbook from File
                    </button>
                </div>
                
                <div style={{display:'flex', flexDirection:'column', gap:'10px', maxHeight:'400px', overflowY:'auto'}}>
                    {availableFlows.map(flow => (
                        <div key={flow} style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px', background:'#f9fafb', borderRadius:'8px', border:`1px solid ${BORDER}`}}>
                            {renamingId === flow ? (
                                <div style={{display:'flex', gap:'8px', flexGrow:1}}>
                                    <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} style={{flexGrow:1, padding:'4px', borderRadius:'4px', border:`1px solid ${JERRY_PINK}`}} placeholder="New Name"/>
                                    <button onClick={() => handleRename(flow)} style={{background:JERRY_PINK, color:'white', border:'none', borderRadius:'4px', padding:'4px 8px', fontSize:'12px', cursor:'pointer'}}>Save</button>
                                    <button onClick={() => setRenamingId(null)} style={{background:'#ccc', color:'white', border:'none', borderRadius:'4px', padding:'4px 8px', fontSize:'12px', cursor:'pointer'}}>Cancel</button>
                                </div>
                            ) : (
                                <>
                                    <div style={{fontWeight: currentFlowName === flow ? 'bold' : 'normal', color: currentFlowName === flow ? JERRY_PINK : SLATE}}>{flow.replace('.json','')}</div>
                                    <div style={{display:'flex', gap:'8px'}}>
                                        <button onClick={() => handleExport(flow)} title="Export/Download" style={{border:'none', background:'white', cursor:'pointer', padding:'4px', borderRadius:'4px', border:`1px solid ${BORDER}`}}><Download size={14} color="#10b981"/></button>
                                        <button onClick={() => handleCopy(flow)} title="Copy/Duplicate" style={{border:'none', background:'white', cursor:'pointer', padding:'4px', borderRadius:'4px', border:`1px solid ${BORDER}`}}><Copy size={14} color={SLATE}/></button>
                                        <button onClick={() => { setRenamingId(flow); setNewName(flow.replace('.json','')); }} title="Rename" style={{border:'none', background:'white', cursor:'pointer', padding:'4px', borderRadius:'4px', border:`1px solid ${BORDER}`}}><Pencil size={14} color={SLATE}/></button>
                                        <button onClick={() => handleDelete(flow)} title="Delete" style={{border:'none', background:'white', cursor:'pointer', padding:'4px', borderRadius:'4px', border:`1px solid ${BORDER}`}}><Trash2 size={14} color="red"/></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// CallTypesManager
const CallTypesManager = ({ isOpen, onClose, callTypes, setCallTypes }) => {
  const [localCallTypes, setLocalCallTypes] = useState(callTypes);
  const [newTypeName, setNewTypeName] = useState("");
  
  useEffect(() => { setLocalCallTypes(callTypes); }, [callTypes]);
  
  if (!isOpen) return null;

  const handleAdd = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) {
      alert("Please enter a call type name");
      return;
    }
    if (localCallTypes.includes(trimmed)) {
      alert("This call type already exists");
      return;
    }
    setLocalCallTypes([...localCallTypes, trimmed]);
    setNewTypeName("");
  };

  const handleRemove = (type) => {
    if (localCallTypes.length <= 1) {
      alert("You must have at least one call type");
      return;
    }
    if (window.confirm(`Remove "${type}"? This will delete all carrier scripts for this call type.`)) {
      setLocalCallTypes(localCallTypes.filter(t => t !== type));
    }
  };

  const handleSave = () => {
    setCallTypes(localCallTypes);
    alert("Call types saved! Note: Carriers will need scripts updated for new types.");
    onClose();
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const newList = [...localCallTypes];
    [newList[index - 1], newList[index]] = [newList[index], newList[index - 1]];
    setLocalCallTypes(newList);
  };

  const moveDown = (index) => {
    if (index === localCallTypes.length - 1) return;
    const newList = [...localCallTypes];
    [newList[index], newList[index + 1]] = [newList[index + 1], newList[index]];
    setLocalCallTypes(newList);
  };

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1100, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', width:'500px', borderRadius:'16px', padding:'20px', boxShadow:'0 20px 50px rgba(0,0,0,0.2)', maxHeight:'80vh', display:'flex', flexDirection:'column'}}>
        <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', borderBottom:`1px solid ${BORDER}`, paddingBottom:'10px'}}>
          <h3 style={{margin:0, display:'flex', alignItems:'center', gap:'8px'}}><Settings size={20} color={SLATE}/> Manage Call Types</h3>
          <button onClick={onClose} style={{border:'none', background:'none', cursor:'pointer'}}><X size={20}/></button>
        </div>

        <div style={{fontSize:'13px', color:'#666', marginBottom:'15px', padding:'10px', background:'#f9fafb', borderRadius:'6px'}}>
          Call types determine what scripts show for each carrier. Add types relevant to your business (e.g., "Renewal", "Cancellation", "Policy Change").
        </div>

        <div style={{marginBottom:'15px'}}>
          <label style={{fontSize:'12px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'8px'}}>ADD NEW CALL TYPE</label>
          <div style={{display:'flex', gap:'8px'}}>
            <input 
              value={newTypeName} 
              onChange={e => setNewTypeName(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleAdd()}
              placeholder="e.g., Renewal, Cancellation..."
              style={{flexGrow:1, padding:'8px', border:`1px solid ${BORDER}`, borderRadius:'6px'}}
            />
            <button onClick={handleAdd} className="btn-primary" style={{background:JERRY_PINK, border:'none'}}>+ Add</button>
          </div>
        </div>

        <div style={{flexGrow:1, overflowY:'auto', marginBottom:'15px'}}>
          <label style={{fontSize:'12px', fontWeight:'bold', color:'#999', display:'block', marginBottom:'8px'}}>CURRENT CALL TYPES</label>
          <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
            {localCallTypes.map((type, index) => (
              <div key={type} style={{display:'flex', alignItems:'center', gap:'8px', padding:'10px', background:'#f9fafb', borderRadius:'6px', border:`1px solid ${BORDER}`}}>
                <div style={{flexGrow:1, fontWeight:'500'}}>{type}</div>
                <button onClick={() => moveUp(index)} disabled={index === 0} title="Move Up" style={{border:'none', background:'white', cursor:index === 0 ? 'not-allowed' : 'pointer', padding:'4px', borderRadius:'4px', opacity: index === 0 ? 0.3 : 1}}>↑</button>
                <button onClick={() => moveDown(index)} disabled={index === localCallTypes.length - 1} title="Move Down" style={{border:'none', background:'white', cursor:index === localCallTypes.length - 1 ? 'not-allowed' : 'pointer', padding:'4px', borderRadius:'4px', opacity: index === localCallTypes.length - 1 ? 0.3 : 1}}>↓</button>
                <button onClick={() => handleRemove(type)} title="Delete" style={{border:'none', background:'white', cursor:'pointer', padding:'4px', borderRadius:'4px', color:'red'}}><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        </div>

        <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', paddingTop:'15px', borderTop:`1px solid ${BORDER}`}}>
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary" style={{background:JERRY_PINK, border:'none'}}>Save Call Types</button>
        </div>
      </div>
    </div>
  );
};

// CarrierManager
const CarrierManager = ({ isOpen, onClose, carriers, setCarriers, callTypes }) => {
  const [selectedId, setSelectedId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [activeCallType, setActiveCallType] = useState("Quote");
  
  if (!isOpen) return null;
  
  const handleSelect = (id) => {
    setSelectedId(id);
    
    // Load carrier data immediately when selected
    if (carriers && carriers[id]) {
      const carrier = { ...carriers[id] };
      
      // Initialize scripts object if needed
      if (!carrier.scripts) {
        carrier.scripts = {};
        if (callTypes && Array.isArray(callTypes)) {
          callTypes.forEach(type => {
            carrier.scripts[type] = carrier.script || "";
          });
        }
      }
      
      setEditForm(carrier);
    }
  };
  
  const handleSave = () => { 
    setCarriers(prev => ({ ...prev, [editForm.id]: editForm })); 
    setSelectedId(null); 
    setEditForm(null);
  };
  
  const handleDelete = () => { 
    if(window.confirm("Delete?")) { 
      const n = { ...carriers }; 
      delete n[selectedId]; 
      setCarriers(n); 
      setSelectedId(null);
      setEditForm(null);
    }
  };
  
  const handleAdd = () => { 
    const id = Date.now().toString(); 
    const scripts = {};
    callTypes.forEach(type => { scripts[type] = ""; });
    const n = { id, name: "New Carrier", scripts }; 
    setCarriers(prev => ({ ...prev, [id]: n })); 
    setSelectedId(id); 
    setEditForm(n); 
  };
  
  const updateScriptForCallType = (callType, value) => {
    setEditForm(prev => ({
      ...prev,
      scripts: {
        ...prev.scripts,
        [callType]: value
      }
    }));
  };

  return (
    <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', width:'700px', height:'650px', borderRadius:'16px', display:'flex', flexDirection:'column', boxShadow:'0 20px 50px rgba(0,0,0,0.2)'}}>
        <div style={{padding:'20px', borderBottom:`1px solid ${BORDER}`, display:'flex', justifyContent:'space-between'}}><h2 style={{margin:0, fontSize:'18px'}}>Manage Carriers</h2><button onClick={onClose} style={{border:'none', background:'none'}}><X size={24}/></button></div>
        <div style={{flexGrow:1, display:'flex', overflow:'hidden'}}>
          <div style={{width:'200px', borderRight:`1px solid ${BORDER}`, padding:'10px', background:'#f9fafb', overflowY:'auto'}}><button onClick={handleAdd} className="btn-primary" style={{width:'100%', marginBottom:'10px', background: JERRY_PINK, border:'none'}}>+ Add New</button>{Object.values(carriers).map(c => <div key={c.id} onClick={() => handleSelect(c.id)} style={{padding:'10px', cursor:'pointer', fontWeight: selectedId === c.id ? 'bold' : 'normal', color: selectedId === c.id ? JERRY_PINK : SLATE}}>{c.name}</div>)}</div>
          <div style={{flexGrow:1, padding:'20px', overflowY:'auto', display:'flex', flexDirection:'column'}}>
            {selectedId && editForm ? (
                <div style={{display:'flex', flexDirection:'column', gap:'15px', height:'100%'}}>
                    <input className="node-input-text" style={{background:'white', border:`1px solid ${BORDER}`, width:'100%', fontSize:'14px', fontWeight:'bold'}} value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Carrier Name"/>
                    
                    <div style={{fontSize:'12px', fontWeight:'bold', color:'#999', marginTop:'10px'}}>CALL TYPE SCRIPTS:</div>
                    
                    {/* Call Type Tabs */}
                    <div style={{display:'flex', gap:'4px', borderBottom:`2px solid ${BORDER}`, paddingBottom:'0', flexWrap:'wrap'}}>
                      {callTypes.map(type => (
                        <button 
                          key={type}
                          onClick={() => setActiveCallType(type)}
                          style={{
                            padding:'8px 12px',
                            border:'none',
                            background: activeCallType === type ? JERRY_PINK : 'transparent',
                            color: activeCallType === type ? 'white' : SLATE,
                            borderRadius:'6px 6px 0 0',
                            cursor:'pointer',
                            fontSize:'12px',
                            fontWeight: activeCallType === type ? 'bold' : 'normal',
                            transition:'all 0.2s'
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    
                    {/* Script Editor for Active Call Type */}
                    <div style={{flexGrow:1, display:'flex', flexDirection:'column'}}>
                      <div style={{fontSize:'11px', color:'#999', marginBottom:'8px'}}>Script for <strong>{activeCallType}</strong> calls:</div>
                      <div style={{flexGrow:1, minHeight:'250px'}}>
                        <ReactQuill 
                          key={`${selectedId}-${activeCallType}`}
                          theme="snow" 
                          value={editForm.scripts?.[activeCallType] || ""} 
                          onChange={(val) => updateScriptForCallType(activeCallType, val)} 
                          style={{height:'250px'}}
                        />
                      </div>
                    </div>
                    
                    <div style={{display:'flex', gap:'10px', marginTop:'70px'}}>
                        <button className="btn-primary" onClick={handleSave} style={{background:JERRY_PINK, border:'none'}}>Save Carrier</button>
                        <button className="btn-secondary" style={{color:'red', borderColor:'red'}} onClick={handleDelete}>Delete</button>
                    </div>
                </div>
            ) : <div style={{color:'#999'}}>Select a carrier to edit call type scripts</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

// NODES
const ScriptNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : `1px solid ${BORDER}`}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{fontSize: '10px', color: data.isStart ? JERRY_PINK : '#999', fontWeight: data.isStart ? 'bold' : 'normal', textTransform:'uppercase'}}>{data.isStart ? 'START STEP' : 'Script Step'}</div>
        <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
          <Copy size={12} style={{cursor:'pointer', color: '#666'}} onClick={() => data.duplicateNode(id)} title="Duplicate Node"/>
          <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
        </div>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <div className="nodrag" style={{background:'white'}}>
        <ReactQuill theme="bubble" value={data.text} onChange={(val) => data.onChange(id, { ...data, text: val })} placeholder="Type script..." />
    </div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const CarrierNode = ({ id, data }) => {
  const availableCallTypes = data.callTypes || DEFAULT_CALL_TYPES;
  return (
    <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : '1px solid #8b5cf6', boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.1)'}}>
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
          <div style={{display:'flex', alignItems:'center', gap:'6px'}}><Building2 size={14} color="#8b5cf6"/><span style={{fontSize:'11px', color:'#8b5cf6', fontWeight:'800'}}>CARRIER LOOKUP</span></div>
          <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
            <Copy size={12} style={{cursor:'pointer', color: '#666'}} onClick={() => data.duplicateNode(id)} title="Duplicate Node"/>
            <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
          </div>
      </div>
      <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
      <select 
        className="nodrag" 
        value={data.defaultCallType || availableCallTypes[0] || "Quote"} 
        onChange={(evt) => data.onChange(id, { ...data, defaultCallType: evt.target.value })}
        style={{width:'100%', padding:'6px', fontSize:'11px', border:`1px solid ${BORDER}`, borderRadius:'4px', marginTop:'6px', background:'white'}}
      >
        {availableCallTypes.map(type => <option key={type} value={type}>{type}</option>)}
      </select>
      <div style={{fontSize:'10px', color:'#666', fontStyle:'italic', padding:'4px', marginTop:'4px'}}>Default call type (can be changed during call)</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

const QuoteNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : `1px solid ${JERRY_PINK}`, boxShadow: `0 4px 6px -1px ${JERRY_PINK}20`}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}><DollarSign size={14} color={JERRY_PINK}/><span style={{fontSize:'11px', color:JERRY_PINK, fontWeight:'800'}}>QUOTE BUILDER</span></div>
        <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
          <Copy size={12} style={{cursor:'pointer', color: '#666'}} onClick={() => data.duplicateNode(id)} title="Duplicate Node"/>
          <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
        </div>
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
        <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
          <Copy size={12} style={{cursor:'pointer', color: '#666'}} onClick={() => data.duplicateNode(id)} title="Duplicate Node"/>
          <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
        </div>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <textarea className="nodrag node-input-text" style={{minHeight: '80px', fontFamily: 'monospace'}} value={data.items} onChange={(evt) => data.onChange(id, { ...data, items: evt.target.value })} placeholder="Enter one question per line... End with (yes/no) for radio buttons" />
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const MadLibsNode = ({ id, data }) => (
  <div className="node-card" style={{border: data.isStart ? `2px solid ${JERRY_PINK}` : '1px solid #10b981', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.1)'}}>
    <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'4px'}}>
        <div style={{display:'flex', alignItems:'center', gap:'6px'}}><Edit size={14} color="#10b981"/><span style={{fontSize:'11px', color:'#10b981', fontWeight:'800'}}>WORD TRACK</span></div>
        <div style={{display: 'flex', gap: '4px', alignItems: 'center'}}>
          <Copy size={12} style={{cursor:'pointer', color: '#666'}} onClick={() => data.duplicateNode(id)} title="Duplicate Node"/>
          <Flag size={12} style={{cursor:'pointer', fill: data.isStart ? JERRY_PINK : 'none', color: data.isStart ? JERRY_PINK : '#ccc'}} onClick={() => data.setAsStartNode(id)} title="Set as Start Node"/>
        </div>
    </div>
    <input className="nodrag node-input-label" value={data.label} onChange={(evt) => data.onChange(id, { ...data, label: evt.target.value })} placeholder="STEP NAME"/>
    <textarea 
      className="nodrag node-input-text" 
      style={{minHeight: '80px', fontFamily: 'monospace', fontSize: '11px'}} 
      value={data.template} 
      onChange={(evt) => data.onChange(id, { ...data, template: evt.target.value })} 
      placeholder="Type word track with variables like: Hi {name}, your rate is ${rate}/month."
    />
    <div style={{fontSize:'9px', color:'#10b981', fontStyle:'italic', padding:'4px', background:'#f0fdf4', borderRadius:'4px', marginTop:'4px'}}>
      Use {`{variable_name}`} for fill-in-the-blanks
    </div>
    <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
  </div>
);

const nodeTypes = { scriptNode: ScriptNode, carrierNode: CarrierNode, quoteNode: QuoteNode, checklistNode: ChecklistNode, madLibsNode: MadLibsNode };

// MAIN APP
export default function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [carriers, setCarriers] = useState(DEFAULT_CARRIERS);
  const [quoteSettings, setQuoteSettings] = useState(DEFAULT_QUOTE_SETTINGS);
  const [callTypes, setCallTypes] = useState(DEFAULT_CALL_TYPES);
  
  const [isCarrierModalOpen, setCarrierModalOpen] = useState(false);
  const [isSettingsModalOpen, setSettingsModalOpen] = useState(false);
  const [isPlaybookManagerOpen, setPlaybookManagerOpen] = useState(false);
  const [isCallTypesModalOpen, setCallTypesModalOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [resources, setResources] = useState(DEFAULT_RESOURCES);
  const [issues, setIssues] = useState(DEFAULT_ISSUES);

  const [availableFlows, setAvailableFlows] = useState([]);
  const [currentFlowName, setCurrentFlowName] = useState(() => {
    if (USE_LOCAL_STORAGE) {
      const lastFlow = localStorage.getItem('insurance-wizard-last-flow');
      return lastFlow || "default_flow.json";
    }
    return "default_flow.json";
  });

  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState(null);
  const [selectedCallType, setSelectedCallType] = useState("Quote");
  const [madLibsValues, setMadLibsValues] = useState({});
  
  const [activeChecklistState, setActiveChecklistState] = useState({});
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef(null);

  // Initialize selectedCallType when landing on a carrier node
  useEffect(() => {
    const currentNode = nodes.find(n => n.id === currentNodeId);
    if (currentNode && currentNode.type === 'carrierNode') {
      // Set to node's default call type or first available call type
      const defaultType = currentNode.data.defaultCallType || callTypes[0] || "Quote";
      setSelectedCallType(defaultType);
    }
  }, [currentNodeId, nodes, callTypes]);

  const updateNodeData = useCallback((id, newData) => {
    setNodes((nds) => nds.map((node) => {
      if (node.id === id) {
        return {
          ...node,
          data: {
            ...newData,
            onChange: updateNodeData,
            setAsStartNode: setAsStartNode,
            callTypes
          }
        };
      }
      return node;
    }));
  }, [setNodes, callTypes]);
  
  // Duplicate node function
  const duplicateNodeFunc = (nodeId) => {
    setNodes((nds) => {
      const nodeToDuplicate = nds.find(n => n.id === nodeId);
      if (!nodeToDuplicate) return nds;
      
      const newId = (Math.random()*10000).toFixed(0);
      const newNode = {
        ...nodeToDuplicate,
        id: newId,
        position: {
          x: nodeToDuplicate.position.x + 50,
          y: nodeToDuplicate.position.y + 50
        },
        data: {
          ...nodeToDuplicate.data,
          label: nodeToDuplicate.data.label + ' (Copy)',
          isStart: false,
          onChange: updateNodeData,
          setAsStartNode: setAsStartNode,
          duplicateNode: duplicateNodeFunc,
          callTypes: nodeToDuplicate.data.callTypes
        },
        selected: false
      };
      
      return [...nds, newNode];
    });
  };
  
  // Update all existing nodes with the duplicate function when nodes load
  useEffect(() => {
    setNodes((nds) => nds.map((node) => {
      // Only update if the node doesn't already have the duplicate function
      if (!node.data.duplicateNode) {
        return {
          ...node,
          data: {
            ...node.data,
            duplicateNode: duplicateNodeFunc,
            onChange: updateNodeData,
            setAsStartNode: setAsStartNode
          }
        };
      }
      return node;
    }));
  }, [nodes.length]); // Run when nodes are added/removed

  const setAsStartNode = useCallback((id) => {
    setNodes((nds) => nds.map((node) => ({
      ...node,
      data: { ...node.data, isStart: node.id === id }
    })));
  }, [setNodes]);

  const refreshFlows = () => {
    if (USE_LOCAL_STORAGE) {
      const savedFlows = localStorage.getItem('insurance-wizard-flows');
      if (savedFlows) {
        setAvailableFlows(JSON.parse(savedFlows));
      } else {
        const hasAnyData = Object.keys(localStorage).some(key => key.startsWith('insurance-wizard-') && key !== 'insurance-wizard-flows' && key !== 'insurance-wizard-last-flow');
        
        if (hasAnyData) {
          const flowKeys = Object.keys(localStorage)
            .filter(key => key.startsWith('insurance-wizard-') && key !== 'insurance-wizard-flows' && key !== 'insurance-wizard-last-flow')
            .map(key => key.replace('insurance-wizard-', ''));
          
          setAvailableFlows(flowKeys.length > 0 ? flowKeys : []);
          if (flowKeys.length > 0) {
            localStorage.setItem('insurance-wizard-flows', JSON.stringify(flowKeys));
          } else {
            localStorage.setItem('insurance-wizard-flows', JSON.stringify([]));
          }
        } else {
          setAvailableFlows(["default_flow.json"]);
          localStorage.setItem('insurance-wizard-flows', JSON.stringify(["default_flow.json"]));
        }
      }
    } else {
      fetch(`${API_URL}/flows`)
        .then(res => res.json())
        .then(files => {
          if(files.length === 0) setAvailableFlows(["default_flow.json"]);
          else setAvailableFlows(files);
        })
        .catch(() => setAvailableFlows(["default_flow.json"]));
    }
  };

  useEffect(() => {
    refreshFlows();
    const timer = setTimeout(() => {
      loadFlowData(currentFlowName);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (USE_LOCAL_STORAGE && currentFlowName) {
      localStorage.setItem('insurance-wizard-last-flow', currentFlowName);
    }
  }, [currentFlowName]);

  useEffect(() => {
    const currentNode = getCurrentNode();
    if (currentNode && currentNode.type === 'carrierNode') {
      setSelectedCallType(currentNode.data.defaultCallType || "Quote");
    }
  }, [currentNodeId, nodes]);

  const loadFlowData = (filename) => {
    if (USE_LOCAL_STORAGE) {
      const savedData = localStorage.getItem(`insurance-wizard-${filename}`);
      
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          if (!data.nodes || data.nodes.length === 0) {
            setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Welcome to the Insurance Wizard', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true, callTypes: data.callTypes || DEFAULT_CALL_TYPES}}]);
            setEdges([]);
            setCarriers(DEFAULT_CARRIERS);
            setResources(DEFAULT_RESOURCES);
            setQuoteSettings(DEFAULT_QUOTE_SETTINGS);
            setCallTypes(data.callTypes || DEFAULT_CALL_TYPES);
            setHistory([]);
            return;
          }
          const nodesWithHandler = data.nodes.map(n => ({ ...n, data: { ...n.data, onChange: updateNodeData, setAsStartNode: setAsStartNode, callTypes: data.callTypes || DEFAULT_CALL_TYPES } }));
          setNodes(nodesWithHandler);
          setEdges(data.edges || []);
          setCarriers(data.carriers || DEFAULT_CARRIERS);
          setResources(data.resources || DEFAULT_RESOURCES);
          setQuoteSettings(data.quoteSettings || DEFAULT_QUOTE_SETTINGS);
          setCallTypes(data.callTypes || DEFAULT_CALL_TYPES);
          setIssues(data.issues || DEFAULT_ISSUES);
          setHistory([]);
          setActiveChecklistState({});
          const start = nodesWithHandler.find(n => n.data.isStart) || nodesWithHandler.find(n => n.id === '1') || nodesWithHandler[0];
          if(start) setCurrentNodeId(start.id);
        } catch (err) {
          console.error('Error loading from localStorage:', err);
          setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Error loading file. Resetting...', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true}}]);
          setEdges([]);
          setHistory([]);
        }
      } else {
        setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Welcome to the Insurance Wizard', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true, callTypes: DEFAULT_CALL_TYPES}}]);
        setEdges([]);
        setCarriers(DEFAULT_CARRIERS);
        setResources(DEFAULT_RESOURCES);
        setQuoteSettings(DEFAULT_QUOTE_SETTINGS);
        setCallTypes(DEFAULT_CALL_TYPES);
        setHistory([]);
        const start = { id: '1' };
        setCurrentNodeId(start.id);
      }
    } else {
      fetch(`${API_URL}/load?filename=${filename}`)
        .then(res => res.json())
        .then(data => {
          if (!data.nodes || data.nodes.length === 0) {
              setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Welcome to the Insurance Wizard', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true, callTypes: data.callTypes || DEFAULT_CALL_TYPES}}]);
              setEdges([]);
              setCarriers(DEFAULT_CARRIERS);
              setResources(DEFAULT_RESOURCES);
              setQuoteSettings(DEFAULT_QUOTE_SETTINGS);
              setCallTypes(data.callTypes || DEFAULT_CALL_TYPES);
              setHistory([]);
              return;
          }
          const nodesWithHandler = data.nodes.map(n => ({ ...n, data: { ...n.data, onChange: updateNodeData, setAsStartNode: setAsStartNode, callTypes: data.callTypes || DEFAULT_CALL_TYPES } }));
          setNodes(nodesWithHandler);
          setEdges(data.edges || []);
          setCarriers(data.carriers || DEFAULT_CARRIERS);
          setResources(data.resources || DEFAULT_RESOURCES);
          setQuoteSettings(data.quoteSettings || DEFAULT_QUOTE_SETTINGS);
          setCallTypes(data.callTypes || DEFAULT_CALL_TYPES);
          setIssues(data.issues || DEFAULT_ISSUES);
          setHistory([]);
          setActiveChecklistState({});
          const start = nodesWithHandler.find(n => n.data.isStart) || nodesWithHandler.find(n => n.id === '1') || nodesWithHandler[0];
          if(start) setCurrentNodeId(start.id);
        }).catch(err => {
            setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'Error loading file. Resetting...', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true}}]);
            setEdges([]);
            setHistory([]);
        });
    }
  }

  const handleSwitchFlow = (e) => {
      const newFile = e.target.value;
      if (newFile === "NEW") {
          const name = prompt("Enter name for new Playbook (e.g., 'Home Insurance'):");
          if (name) {
              const safeName = name.toLowerCase().replace(/ /g, '_') + ".json";
              setAvailableFlows(prev => [...prev, safeName]);
              setCurrentFlowName(safeName);
              setNodes([{ id: '1', type: 'scriptNode', position: {x:250, y:150}, data: {label:'Start', text:'', onChange: updateNodeData, setAsStartNode: setAsStartNode, isStart: true, callTypes}}]);
              setEdges([]);
              setCarriers(DEFAULT_CARRIERS);
              setResources(DEFAULT_RESOURCES);
              setQuoteSettings(DEFAULT_QUOTE_SETTINGS);
              setCallTypes(DEFAULT_CALL_TYPES);
              setHistory([]);
              setCurrentNodeId('1');
          }
      } else {
          setCurrentFlowName(newFile);
          loadFlowData(newFile);
      }
  };

  const duplicateCurrentPlaybook = () => {
    const baseName = currentFlowName.replace('.json', '');
    const copyName = prompt(`Enter name for duplicate of "${baseName}":`, `${baseName} (Copy)`);
    
    if (!copyName || copyName.trim() === '') return;
    
    let safeCopyName = copyName.trim();
    if (!safeCopyName.endsWith('.json')) {
        safeCopyName = safeCopyName + '.json';
    }
    
    saveToServer();
    
    if (USE_LOCAL_STORAGE) {
        const originalData = localStorage.getItem(`insurance-wizard-${currentFlowName}`);
        
        if (originalData) {
            localStorage.setItem(`insurance-wizard-${safeCopyName}`, originalData);
            
            const flows = JSON.parse(localStorage.getItem('insurance-wizard-flows') || '[]');
            if (!flows.includes(safeCopyName)) {
                flows.push(safeCopyName);
                localStorage.setItem('insurance-wizard-flows', JSON.stringify(flows));
                setAvailableFlows(flows);
            }
            
            setCurrentFlowName(safeCopyName);
            loadFlowData(safeCopyName);
            alert(`Playbook duplicated as "${safeCopyName.replace('.json', '')}"!`);
        }
    } else {
        fetch(`${API_URL}/copy_flow`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ sourceFilename: currentFlowName, newFilename: safeCopyName })
        }).then(res => res.json()).then(data => {
            if(data.message && data.message.includes("success")) {
                refreshFlows();
                setCurrentFlowName(safeCopyName);
                loadFlowData(safeCopyName);
                alert(`Playbook duplicated as "${safeCopyName.replace('.json', '')}"!`);
            }
        });
    }
  };

  const saveToServer = () => {
    const cleanNodes = nodes.map(n => { const { onChange, setAsStartNode, ...rest } = n.data; return { ...n, data: rest }; });
    const dataToSave = {
      filename: currentFlowName,
      nodes: cleanNodes,
      edges,
      carriers,
      quoteSettings,
      resources,
      callTypes,
      issues
    };
    
    if (USE_LOCAL_STORAGE) {
      localStorage.setItem(`insurance-wizard-${currentFlowName}`, JSON.stringify(dataToSave));
      
      const savedFlows = localStorage.getItem('insurance-wizard-flows');
      const flows = savedFlows ? JSON.parse(savedFlows) : [];
      if (!flows.includes(currentFlowName)) {
        flows.push(currentFlowName);
        localStorage.setItem('insurance-wizard-flows', JSON.stringify(flows));
        setAvailableFlows(flows);
      }
      
      alert('Playbook saved successfully!');
    } else {
      fetch(`${API_URL}/save`, { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(dataToSave) 
      }).then(res => res.json()).then(d => alert(d.message));
    }
  };

  const exportPlaybookAsText = () => {
    try {
      const output = [];
      
      // Professional formatting characters
      const HR = '═'.repeat(88);
      const SEC = '─'.repeat(88);
      const SUB = '·'.repeat(88);
      
      // Header
      output.push(HR);
      output.push('                    INSURANCE WIZARD PLAYBOOK');
      output.push('                     LEGAL COMPLIANCE REVIEW');
      output.push(HR);
      output.push('');
      output.push('  PLAYBOOK INFORMATION:');
      output.push('');
      output.push('    Name:             ' + currentFlowName.replace('.json', ''));
      output.push('    Export Date:      ' + new Date().toLocaleString('en-US', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      }));
      output.push('    Total Steps:      ' + nodes.length);
      output.push('    Total Paths:      ' + edges.length);
      output.push('    Call Types:       ' + callTypes.length);
      output.push('    Carriers:         ' + Object.keys(carriers).length);
      output.push('');
      output.push(SEC);
      output.push('');
      
      // Table of Contents
      output.push('  TABLE OF CONTENTS:');
      output.push('');
      output.push('    1. Call Types Configuration');
      output.push('    2. Carrier Scripts & Verbiage');
      output.push('    3. Complete Call Flow Structure');
      output.push('    4. Compliance & Legal Notes');
      output.push('');
      output.push(SEC);
      output.push('');
      
      // Section 1: Call Types
      output.push('  SECTION 1: CALL TYPES CONFIGURATION');
      output.push('');
      output.push('  The following call types are configured in this playbook. Each carrier may');
      output.push('  have different scripts for each call type.');
      output.push('');
      
      if (callTypes && callTypes.length > 0) {
        callTypes.forEach((type, idx) => {
          output.push('    ' + (idx + 1) + '. ' + type);
        });
      } else {
        output.push('    [No call types configured]');
      }
      
      output.push('');
      output.push(SEC);
      output.push('');
      
      // Section 2: Carrier Scripts
      output.push('  SECTION 2: CARRIER SCRIPTS & VERBIAGE');
      output.push('');
      output.push('  This section contains the exact verbiage that agents use when communicating');
      output.push('  with customers for each carrier and call type combination.');
      output.push('');
      
      if (Object.keys(carriers).length > 0) {
        Object.values(carriers).forEach((carrier, carrierIdx) => {
          output.push(SUB);
          output.push('');
          output.push('  CARRIER ' + (carrierIdx + 1) + ': ' + carrier.name.toUpperCase());
          output.push('');
          
          if (carrier.scripts && Object.keys(carrier.scripts).length > 0) {
            callTypes.forEach(callType => {
              const script = carrier.scripts[callType];
              if (script && script.trim()) {
                output.push('    ┌─ Call Type: ' + callType.toUpperCase() + ' ' + '─'.repeat(Math.max(0, 46 - callType.length)));
                output.push('    │');
                
                const cleanText = script
                  .replace(/<[^>]*>/g, '')
                  .replace(/&nbsp;/g, ' ')
                  .replace(/&amp;/g, '&')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&quot;/g, '"')
                  .trim();
                
                if (cleanText) {
                  cleanText.split('\n').forEach(line => {
                    if (line.trim()) {
                      const words = line.trim().split(' ');
                      let currentLine = '    │  ';
                      words.forEach(word => {
                        if (currentLine.length + word.length + 1 > 82) {
                          output.push(currentLine);
                          currentLine = '    │  ' + word;
                        } else {
                          currentLine += (currentLine.endsWith('  ') ? '' : ' ') + word;
                        }
                      });
                      if (currentLine.length > 6) output.push(currentLine);
                    }
                  });
                } else {
                  output.push('    │  [No script content]');
                }
                
                output.push('    │');
                output.push('    └' + '─'.repeat(70));
                output.push('');
              }
            });
          }
        });
      }
      
      output.push(SEC);
      output.push('');
      
      // Section 3: Call Flow
      output.push('  SECTION 3: COMPLETE CALL FLOW STRUCTURE');
      output.push('');
      output.push('  This section shows the exact path agents follow during customer calls.');
      output.push('  Each step is numbered and shows the content agents use or actions they take.');
      output.push('');
      
      const startNode = nodes.find(n => n.data && n.data.isStart) || nodes[0];
      
      if (startNode) {
        let stepNumber = 1;
        
        output.push('  ╔' + '═'.repeat(76) + '╗');
        output.push('  ║' + ' '.repeat(27) + 'CALL FLOW START' + ' '.repeat(34) + '║');
        output.push('  ╚' + '═'.repeat(76) + '╝');
        output.push('');
        
        const buildTree = (nodeId, depth, visited) => {
          if (!nodeId || visited.has(nodeId) || depth > 20) return;
          visited.add(nodeId);
          
          const node = nodes.find(n => n.id === nodeId);
          if (!node || !node.data) return;
          
          const indent = '  ' + '│  '.repeat(depth);
          
          const typeLabels = {
            scriptNode: 'AGENT SCRIPT',
            carrierNode: 'CARRIER SELECTION',
            quoteNode: 'QUOTE PRESENTATION',
            checklistNode: 'COMPLIANCE CHECKPOINT',
            madLibsNode: 'CUSTOMIZED VERBIAGE'
          };
          
          const icons = {
            scriptNode: '📄',
            carrierNode: '🏢',
            quoteNode: '💰',
            checklistNode: '✓',
            madLibsNode: '✏️'
          };
          
          const icon = icons[node.type] || '•';
          const label = typeLabels[node.type] || 'STEP';
          
          output.push(indent + '┌' + '─'.repeat(71));
          output.push(indent + '│ STEP ' + stepNumber + ': ' + icon + ' ' + label);
          output.push(indent + '│ ' + node.data.label);
          output.push(indent + '├' + '─'.repeat(71));
          
          stepNumber++;
          
          // Content
          if (node.type === 'scriptNode' && node.data.text) {
            const clean = node.data.text
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim();
            
            if (clean) {
              output.push(indent + '│');
              output.push(indent + '│ Agent reads the following script to the customer:');
              output.push(indent + '│');
              clean.split('\n').forEach(line => {
                if (line.trim()) {
                  const words = line.trim().split(' ');
                  let currentLine = indent + '│   "';
                  words.forEach(word => {
                    if (currentLine.length + word.length + 2 > 76) {
                      output.push(currentLine);
                      currentLine = indent + '│    ' + word;
                    } else {
                      currentLine += (currentLine.endsWith('"') ? '' : ' ') + word;
                    }
                  });
                  if (currentLine.length > indent.length + 5) output.push(currentLine + '"');
                }
              });
            }
          }
          
          if (node.type === 'carrierNode') {
            const callType = node.data.defaultCallType || callTypes[0] || 'Quote';
            output.push(indent + '│');
            output.push(indent + '│ Agent Action Required:');
            output.push(indent + '│   1. Agent selects the appropriate carrier from the system');
            output.push(indent + '│   2. Agent selects call type (default: ' + callType + ')');
            output.push(indent + '│   3. System displays corresponding script (see Section 2)');
            output.push(indent + '│   4. Agent reads displayed script to customer');
          }
          
          if (node.type === 'checklistNode' && node.data.items) {
            output.push(indent + '│');
            output.push(indent + '│ COMPLIANCE REQUIREMENTS:');
            output.push(indent + '│ Agent MUST complete all items before proceeding:');
            output.push(indent + '│');
            node.data.items.split('\n').forEach(item => {
              if (item.trim()) output.push(indent + '│   ☐ ' + item.trim());
            });
            output.push(indent + '│');
            output.push(indent + '│ ⚠️  All boxes must be checked before advancing to next step');
          }
          
          if (node.type === 'madLibsNode' && node.data.template) {
            output.push(indent + '│');
            output.push(indent + '│ Agent reads the following, filling in customer information:');
            output.push(indent + '│');
            output.push(indent + '│   "' + node.data.template + '"');
            output.push(indent + '│');
            output.push(indent + '│ NOTE: Text in {brackets} is replaced with actual customer data');
          }
          
          if (node.type === 'quoteNode') {
            output.push(indent + '│');
            output.push(indent + '│ Quote Presentation Process:');
            output.push(indent + '│   1. System calculates pricing based on customer information');
            output.push(indent + '│   2. Agent reviews quote details with customer');
            output.push(indent + '│   3. Agent presents all coverage options and pricing');
            if (node.data.closingQuestion) {
              output.push(indent + '│   4. Agent asks: "' + node.data.closingQuestion + '"');
            }
          }
          
          output.push(indent + '└' + '─'.repeat(71));
          output.push(indent);
          
          const children = edges.filter(e => e.source === nodeId);
          
          if (children.length > 0) {
            if (children.length > 1) {
              output.push(indent + '  Customer Response Determines Next Step:');
              output.push(indent);
            }
            children.forEach((edge, idx) => {
              const isLast = idx === children.length - 1;
              const char = isLast ? '└' : '├';
              output.push(indent + '  ' + char + '─── [' + (edge.label || 'Next') + '] ────>');
              output.push(indent + '  ' + (isLast ? ' ' : '│'));
              buildTree(edge.target, depth + 1, visited);
              if (!isLast) output.push(indent + '  │');
            });
          } else {
            output.push(indent + '  └─── [CALL COMPLETE] ');
            output.push('');
          }
        };
        
        buildTree(startNode.id, 0, new Set());
        
        output.push('');
        output.push('  ╔' + '═'.repeat(76) + '╗');
        output.push('  ║' + ' '.repeat(28) + 'CALL FLOW END' + ' '.repeat(35) + '║');
        output.push('  ╚' + '═'.repeat(76) + '╝');
      }
      
      output.push('');
      output.push(SEC);
      output.push('');
      
      // Section 4: Legal Notes
      output.push('  SECTION 4: COMPLIANCE & LEGAL NOTES');
      output.push('');
      output.push('  DOCUMENT PURPOSE:');
      output.push('    This document represents the complete call flow and verbiage used by');
      output.push('    customer service agents when interacting with customers.');
      output.push('');
      output.push('  AGENT REQUIREMENTS:');
      output.push('    • Agents must follow the prescribed call flow from start to finish');
      output.push('    • All scripts must be read as written with no deviation');
      output.push('    • Compliance checkpoints must be completed before advancing');
      output.push('    • All customer interactions must be documented in the system');
      output.push('');
      output.push('  COMPLIANCE CHECKPOINTS:');
      output.push('    • Checkboxes marked with ☐ must be completed during calls');
      output.push('    • Agents cannot proceed without completing all compliance items');
      output.push('    • All disclosures must be read verbatim to customers');
      output.push('    • Date of birth verification is required for all transactions');
      output.push('');
      output.push('  CARRIER-SPECIFIC SCRIPTS:');
      output.push('    • Scripts vary by carrier and call type (see Section 2)');
      output.push('    • Agents see only the relevant script for selected carrier/call type');
      output.push('    • All carrier scripts have been reviewed and approved');
      output.push('');
      output.push('  CUSTOMIZED VERBIAGE:');
      output.push('    • Text in {brackets} indicates customer-specific information');
      output.push('    • Agents replace bracketed text with actual customer data');
      output.push('    • Example: {customer_name} becomes "John Smith"');
      output.push('');
      output.push('  QUALITY ASSURANCE:');
      output.push('    • All calls may be monitored for quality and compliance');
      output.push('    • Agents are evaluated on adherence to this playbook');
      output.push('    • Any deviations must be documented and approved');
      output.push('');
      output.push(HR);
      output.push('');
      output.push('  END OF LEGAL REVIEW DOCUMENT');
      output.push('');
      output.push('  Exported: ' + new Date().toLocaleString());
      output.push('  Playbook: ' + currentFlowName.replace('.json', ''));
      output.push('');
      output.push(HR);
      
      const blob = new Blob([output.join('\n')], { type: 'text/plain; charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFlowName.replace('.json', '') + '_LEGAL_REVIEW.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting playbook: ' + error.message);
    }
  };

  const autoLayoutNodes = () => {
    if (nodes.length === 0) return;
    
    // Find the start node
    const startNode = nodes.find(n => n.data && n.data.isStart) || nodes.find(n => n.id === '1') || nodes[0];
    if (!startNode) return;
    
    // Configuration
    const HORIZONTAL_SPACING = 300; // Space between columns
    const VERTICAL_SPACING = 150;   // Space between nodes in same column
    const START_X = 100;
    const START_Y = 100;
    
    // Track node positions by level
    const levels = new Map(); // level -> array of node IDs
    const nodePositions = new Map(); // nodeId -> { x, y, level }
    const visited = new Set();
    
    // Build level structure (BFS for proper horizontal layout)
    const buildLevels = () => {
      const queue = [{ id: startNode.id, level: 0 }];
      visited.add(startNode.id);
      
      while (queue.length > 0) {
        const { id, level } = queue.shift();
        
        if (!levels.has(level)) {
          levels.set(level, []);
        }
        levels.get(level).push(id);
        
        // Get children
        const childEdges = edges.filter(e => e.source === id);
        childEdges.forEach(edge => {
          if (!visited.has(edge.target)) {
            visited.add(edge.target);
            queue.push({ id: edge.target, level: level + 1 });
          }
        });
      }
    };
    
    // Calculate positions
    const calculatePositions = () => {
      levels.forEach((nodeIds, level) => {
        const x = START_X + (level * HORIZONTAL_SPACING);
        
        nodeIds.forEach((nodeId, index) => {
          const y = START_Y + (index * VERTICAL_SPACING);
          nodePositions.set(nodeId, { x, y, level });
        });
      });
      
      // Handle orphan nodes (not connected to start)
      nodes.forEach(node => {
        if (!nodePositions.has(node.id)) {
          // Place orphans at the bottom
          const orphanY = START_Y + (levels.get(0)?.length || 0) * VERTICAL_SPACING + 200;
          nodePositions.set(node.id, { x: START_X, y: orphanY, level: -1 });
        }
      });
    };
    
    // Apply positions to nodes
    const applyLayout = () => {
      const updatedNodes = nodes.map(node => {
        const pos = nodePositions.get(node.id);
        if (pos) {
          return {
            ...node,
            position: { x: pos.x, y: pos.y }
          };
        }
        return node;
      });
      
      setNodes(updatedNodes);
    };
    
    // Execute layout
    buildLevels();
    calculatePositions();
    applyLayout();
    
    // Show success message
    const totalLevels = levels.size;
    const totalOrphans = nodes.length - visited.size;
    let message = `Layout complete! Organized ${nodes.length} nodes into ${totalLevels} levels.`;
    if (totalOrphans > 0) {
      message += `\n${totalOrphans} orphan node(s) placed at bottom.`;
    }
    alert(message);
  };

  const onConnect = useCallback((params) => { const label = window.prompt("Choice label?", "Next"); setEdges((eds) => addEdge({ ...params, label: label || "Next" }, eds)); }, [setEdges]);
  const addNewNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'scriptNode', position: {x:250, y:150}, data: {label:'Step', text:'', onChange: updateNodeData, setAsStartNode: setAsStartNode, duplicateNode: duplicateNodeFunc}}]);
  const addCarrierNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'carrierNode', position: {x:250, y:150}, data: {label:'Select Carrier', onChange: updateNodeData, setAsStartNode: setAsStartNode, duplicateNode: duplicateNodeFunc, callTypes, defaultCallType: callTypes[0] || "Quote"}}]);
  const addQuoteNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'quoteNode', position: {x:250, y:150}, data: {label:'Present Quote', closingQuestion:'How does that price sound?', onChange: updateNodeData, setAsStartNode: setAsStartNode, duplicateNode: duplicateNodeFunc}}]);
  const addMadLibsNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'madLibsNode', position: {x:250, y:150}, data: {label:'Word Track', template:'', onChange: updateNodeData, setAsStartNode: setAsStartNode, duplicateNode: duplicateNodeFunc}}]);
  const addChecklistNode = () => setNodes((nds) => [...nds, { id: (Math.random()*10000).toFixed(0), type: 'checklistNode', position: {x:250, y:150}, data: {label:'Compliance Check', items:'Did you disclose the TCPA? (yes/no)\nDid you verify date of birth?', onChange: updateNodeData, setAsStartNode: setAsStartNode, duplicateNode: duplicateNodeFunc}}]);
  
  const deleteSelected = useCallback(() => { 
    const deletedNodeIds = nodes.filter(n => n.selected).map(n => n.id);
    
    setNodes((nds) => nds.filter((n) => !n.selected)); 
    
    setEdges((eds) => eds.filter((e) => 
      !e.selected && 
      !deletedNodeIds.includes(e.source) && 
      !deletedNodeIds.includes(e.target)
    )); 
  }, [nodes, setNodes, setEdges]);
  const getCurrentNode = () => nodes.find(n => n.id === currentNodeId);
  const getOptions = () => edges.filter(e => e.source === currentNodeId).map(e => ({ label: e.label || "Next", targetId: e.target }));

  const handleHistoryClick = (index) => {
    // Navigate back to a previous step
    const newHistory = history.slice(0, index);
    setHistory(newHistory);
    
    // Set current node to the step that was clicked
    const clickedStep = history[index];
    setCurrentNodeId(clickedStep.id);
    
    // Restore the state from that step if needed
    if (clickedStep.type === 'carrierNode' && clickedStep.carrierInfo) {
      setSelectedCarrierId(clickedStep.carrierInfo.id);
      setSelectedCallType(clickedStep.carrierInfo.selectedCallType || "Quote");
    } else {
      setSelectedCarrierId(null);
      setSelectedCallType("Quote");
    }
    
    // Scroll to the clicked item
    setTimeout(() => {
      const wizardContent = document.querySelector('.wizard-content');
      if (wizardContent) {
        const historyItems = wizardContent.querySelectorAll('.history-item');
        if (historyItems[index]) {
          historyItems[index].scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }
      }
    }, 100);
  };

  const handleOptionClick = (targetId, label) => {
    const current = getCurrentNode();
    let historyData = { ...current, selectedOption: label };
    
    if (current.type === 'carrierNode' && selectedCarrierId) {
        historyData.carrierInfo = {
          ...carriers[selectedCarrierId],
          selectedCallType: selectedCallType,
          displayScript: carriers[selectedCarrierId].scripts?.[selectedCallType] || carriers[selectedCarrierId].script
        };
    }
    if (current.type === 'checklistNode') {
        historyData.checklistAnswers = activeChecklistState[current.id] || {};
    }
    if (current.type === 'madLibsNode') {
        historyData.madLibsData = {
          filledText: fillTemplate(current.data.template, madLibsValues[current.id] || {}),
          variables: madLibsValues[current.id] || {}
        };
    }

    setHistory(prev => [...prev, historyData]);
    setCurrentNodeId(targetId);
    setSelectedCarrierId(null);
    setSelectedCallType("Quote");
    
    // Auto-scroll to show the new step only if user hasn't manually scrolled recently
    setTimeout(() => {
      const wizardContent = document.querySelector('.wizard-content');
      if (wizardContent && !userScrollingRef.current) {
        const currentScrollTop = wizardContent.scrollTop;
        const scrollHeight = wizardContent.scrollHeight;
        const clientHeight = wizardContent.clientHeight;
        
        // Only auto-scroll if we're near the bottom (within 200px)
        if (scrollHeight - currentScrollTop - clientHeight < 200) {
          wizardContent.scrollTo({
            top: wizardContent.scrollHeight,
            behavior: 'smooth'
          });
        }
      }
    }, 100);
  };

  const resetWizard = () => { 
      const start = nodes.find(n => n.data.isStart) || nodes.find(n => n.id === '1') || nodes[0]; 
      if(start) setCurrentNodeId(start.id); 
      setHistory([]); 
      setSelectedCarrierId(null);
      setSelectedCallType("Quote");
      setActiveChecklistState({});
      setMadLibsValues({});
  };

  const updateChecklistAnswer = (nodeId, itemText, value) => {
      setActiveChecklistState(prev => {
          const nodeState = prev[nodeId] || {};
          if (value === null) {
              const newState = { ...nodeState };
              delete newState[itemText];
              return { ...prev, [nodeId]: newState };
          }
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
                  const displayVal = val ? val.toUpperCase() : ' ';
                  report += `[${displayVal}] ${cleanItem}\n`;
              } else {
                  report += `[${val ? 'X' : ' '}] ${cleanItem}\n`;
              }
          });
      });
      return report;
  };

  const extractVariables = (template) => {
    if (!template) return [];
    const regex = /\{([^}]+)\}/g;
    const matches = [];
    let match;
    while ((match = regex.exec(template)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    return matches;
  };

  const fillTemplate = (template, values) => {
    if (!template) return '';
    let filled = template;
    Object.keys(values).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      filled = filled.replace(regex, values[key] || `{${key}}`);
    });
    return filled;
  };

  const updateMadLibsValue = (nodeId, variableName, value) => {
    setMadLibsValues(prev => ({
      ...prev,
      [nodeId]: {
        ...(prev[nodeId] || {}),
        [variableName]: value
      }
    }));
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

  const renderChecklistItems = (itemsText, answers, nodeId, isInteractive) => {
      return (itemsText || "").split('\n').map((rawItem, i) => {
          if (!rawItem.trim()) return null;
          const isYesNo = rawItem.toLowerCase().includes('(yes/no)');
          const cleanItem = rawItem.replace(/\(yes\/no\)/i, '').trim();
          const currentVal = answers ? answers[cleanItem] : null;

          if (isYesNo) {
             return (
                 <div key={i} style={{margin:'8px 0', padding:'8px', background:'white', border:`1px solid ${BORDER}`, borderRadius:'6px'}}>
                     <div style={{fontSize:'14px', color:SLATE, marginBottom:'6px', fontWeight:'500', wordWrap: 'break-word'}}>{cleanItem}</div>
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
                        style={{width:'16px', height:'16px', accentColor: COMPLIANCE_ORANGE, flexShrink: 0}}
                      />
                      <span style={{fontSize:'14px', color:SLATE, wordWrap: 'break-word'}}>{cleanItem}</span>
                  </label>
              );
          }
      });
  };

  return (
    <div className="app-container" style={{display:'flex', width:'100vw', height:'100vh', overflow:'hidden', fontFamily:'Inter, sans-serif'}}>
      <CallTypesManager isOpen={isCallTypesModalOpen} onClose={() => setCallTypesModalOpen(false)} callTypes={callTypes} setCallTypes={setCallTypes} />
      <CarrierManager isOpen={isCarrierModalOpen} onClose={() => setCarrierModalOpen(false)} carriers={carriers} setCarriers={setCarriers} callTypes={callTypes} />
      <SettingsManager isOpen={isSettingsModalOpen} onClose={() => setSettingsModalOpen(false)} settings={quoteSettings} setSettings={setQuoteSettings} />
      <PlaybookManager 
        isOpen={isPlaybookManagerOpen} 
        onClose={() => setPlaybookManagerOpen(false)} 
        availableFlows={availableFlows} 
        refreshList={refreshFlows}
        currentFlowName={currentFlowName}
        setCurrentFlowName={setCurrentFlowName}
        loadFlowData={loadFlowData}
      />

      <ResourceSidebar resources={resources} setResources={setResources} issues={issues} setIssues={setIssues} />

      <div className="wizard-pane" style={{
          flex: showAdmin ? '0 0 400px' : '1', 
          maxWidth: '100%', 
          minWidth: '350px',
          borderRight: showAdmin ? `1px solid ${BORDER}` : 'none', 
          display:'flex', flexDirection:'column', background: 'white'
        }}>
        <div className="wizard-header" style={{borderBottom:`1px solid ${BORDER}`, padding:'15px 20px', display:'flex', alignItems:'center'}}>
          <img src={jerryLogo} alt="Jerry" style={{height:'30px', marginRight:'10px'}} />
          <div style={{ fontWeight: '700', fontSize: '18px', color: SLATE }}>Insurance Wizard</div>
          <div style={{ flexGrow: 1 }}></div>
          
          <div style={{display:'flex', alignItems:'center', gap:'4px', marginRight:'12px'}}>
              <FolderOpen size={16} color={SLATE} />
              <select value={currentFlowName} onChange={handleSwitchFlow} style={{fontSize:'12px', padding:'4px', borderRadius:'4px', maxWidth:'120px', border:`1px solid ${BORDER}`}}>
                  {availableFlows.map(f => <option key={f} value={f}>{f.replace('.json','')}</option>)}
              </select>
          </div>

          <button className="btn btn-secondary" onClick={() => setShowAdmin(!showAdmin)} style={{marginRight:'10px', color: showAdmin ? JERRY_PINK : '#999', borderColor: 'transparent'}}>
             {showAdmin ? <Unlock size={16}/> : <Lock size={16}/>}
          </button>
          <button className="btn btn-secondary" onClick={resetWizard} style={{color: SLATE}}><RefreshCw size={16} /></button>
        </div>
        
        <div 
          className="wizard-content" 
          style={{background: 'white', overflowX: 'hidden'}}
          onScroll={(e) => {
            // Track when user manually scrolls
            userScrollingRef.current = true;
            
            // Reset the flag after 2 seconds of no scrolling
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
              userScrollingRef.current = false;
            }, 2000);
          }}
        >
          {history.map((step, idx) => (
            <div 
              key={idx} 
              className="history-item"
              onClick={() => handleHistoryClick(idx)}
              style={{
                opacity: 0.6, 
                marginBottom: '20px',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            >
              <div className="bubble" style={{background: '#F3F4F6'}}>
                <div className="bubble-label" style={{color: SLATE}}>{step.data.label}</div>
                {step.type === 'scriptNode' && <div className="bubble-text" style={{color: SLATE, width: '100%', minWidth: 0, wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'normal', whiteSpace: 'normal'}} dangerouslySetInnerHTML={{__html: cleanHTML(step.data.text)}}></div>}
                {step.type === 'carrierNode' && step.carrierInfo && (
                  <div>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'6px'}}>
                      <div style={{fontWeight:'bold', color:JERRY_PINK}}>{step.carrierInfo.name} Selected</div>
                      {step.carrierInfo.selectedCallType && (
                        <div style={{fontSize:'10px', background:'#8b5cf6', color:'white', padding:'3px 6px', borderRadius:'4px', fontWeight:'bold'}}>
                          {step.carrierInfo.selectedCallType}
                        </div>
                      )}
                    </div>
                    <div style={{fontSize:'12px'}} dangerouslySetInnerHTML={{__html: step.carrierInfo.displayScript || step.carrierInfo.script}}></div>
                  </div>
                )}
                {step.type === 'checklistNode' && (
                    <div style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                        {renderChecklistItems(step.data.items, step.checklistAnswers, step.id, false)}
                    </div>
                )}
                {step.type === 'madLibsNode' && step.madLibsData && (
                  <div style={{background:'white', padding:'10px', borderRadius:'6px', border:'1px solid #10b981'}}>
                    <div style={{fontSize:'13px', color:SLATE, lineHeight:'1.6'}}>
                      {step.madLibsData.filledText}
                    </div>
                  </div>
                )}
                {step.type === 'quoteNode' && <div style={{fontStyle:'italic', color:'#666'}}>Quote presented.</div>}
              </div>
            </div>
          ))}
          
          {getCurrentNode() && (
            <div className="bubble" style={{ borderLeft: `4px solid ${getCurrentNode().type === 'carrierNode' ? '#8b5cf6' : getCurrentNode().type === 'quoteNode' ? JERRY_PINK : getCurrentNode().type === 'checklistNode' ? COMPLIANCE_ORANGE : getCurrentNode().type === 'madLibsNode' ? '#10b981' : '#E5090E'}`, background: JERRY_BG }}>
              <div className="bubble-label" style={{color: JERRY_PINK}}>{getCurrentNode().data.label}</div>
              
              {getCurrentNode().type === 'scriptNode' && <div className="bubble-text" style={{color: SLATE, width: '100%', minWidth: 0, wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'normal', whiteSpace: 'normal'}} dangerouslySetInnerHTML={{__html: cleanHTML(getCurrentNode().data.text)}}></div>}
              
              {getCurrentNode().type === 'carrierNode' && (
                <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                  {/* Call Type Selector */}
                  <div>
                    <label style={{fontSize:'12px', fontWeight:'bold', color:SLATE, display:'block', marginBottom:'6px'}}>Call Type:</label>
                    <select 
                      style={{padding:'8px', borderRadius:'8px', border:`1px solid ${BORDER}`, fontSize:'14px', width:'100%'}} 
                      onChange={(e) => setSelectedCallType(e.target.value)} 
                      value={selectedCallType || getCurrentNode().data.defaultCallType || callTypes[0] || "Quote"}
                    >
                      {callTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  
                  {/* Carrier Selector */}
                  <div>
                    <label style={{fontSize:'12px', fontWeight:'bold', color:SLATE, display:'block', marginBottom:'6px'}}>Select Carrier:</label>
                    <select 
                      style={{padding:'8px', borderRadius:'8px', border:`1px solid ${BORDER}`, fontSize:'14px', width:'100%'}} 
                      onChange={(e) => setSelectedCarrierId(e.target.value)} 
                      value={selectedCarrierId || ""}
                    >
                      <option value="" disabled>-- Choose Carrier --</option>
                      {Object.values(carriers).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  
                  {/* Display Script for Selected Call Type */}
                  {selectedCarrierId && carriers[selectedCarrierId] && (
                    <div style={{background:'white', padding:'12px', borderRadius:'8px', border:`2px solid #8b5cf6`}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                        <div style={{fontWeight:'bold', color:'#8b5cf6', fontSize:'15px'}}>{carriers[selectedCarrierId].name}</div>
                        <div style={{fontSize:'11px', background:'#8b5cf6', color:'white', padding:'4px 8px', borderRadius:'4px', fontWeight:'bold'}}>{selectedCallType}</div>
                      </div>
                      <div style={{fontSize:'13px', color:SLATE}} dangerouslySetInnerHTML={{__html: carriers[selectedCarrierId].scripts?.[selectedCallType] || carriers[selectedCarrierId].script || "<p><i>No script for this call type yet.</i></p>"}}></div>
                    </div>
                  )}
                </div>
              )}

              {getCurrentNode().type === 'checklistNode' && (
                  <div style={{display:'flex', flexDirection:'column', gap:'8px'}}>
                      {renderChecklistItems(getCurrentNode().data.items, activeChecklistState[getCurrentNode().id], getCurrentNode().id, true)}
                  </div>
              )}

              {getCurrentNode().type === 'madLibsNode' && (
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  {/* Show filled preview at top */}
                  <div style={{background:'white', padding:'12px', borderRadius:'8px', border:'2px solid #10b981'}}>
                    <div style={{fontSize:'11px', fontWeight:'bold', color:'#10b981', marginBottom:'8px', textTransform:'uppercase'}}>Preview:</div>
                    <div style={{fontSize:'14px', color:SLATE, lineHeight:'1.6', fontFamily:'inherit'}}>
                      {fillTemplate(getCurrentNode().data.template, madLibsValues[getCurrentNode().id] || {})}
                    </div>
                  </div>
                  
                  {/* Input fields for each variable */}
                  <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                    <div style={{fontSize:'11px', fontWeight:'bold', color:'#10b981', textTransform:'uppercase'}}>Fill in the blanks:</div>
                    {extractVariables(getCurrentNode().data.template).map((variable, idx) => (
                      <div key={idx} style={{display:'flex', flexDirection:'column', gap:'4px'}}>
                        <label style={{fontSize:'12px', fontWeight:'600', color:SLATE}}>{variable}:</label>
                        <input 
                          type="text"
                          value={madLibsValues[getCurrentNode().id]?.[variable] || ''}
                          onChange={(e) => updateMadLibsValue(getCurrentNode().id, variable, e.target.value)}
                          placeholder={`Enter ${variable}...`}
                          style={{
                            padding:'10px',
                            border:`1px solid ${BORDER}`,
                            borderRadius:'6px',
                            fontSize:'14px',
                            width:'100%'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {getCurrentNode().type === 'quoteNode' && (<QuoteBuilderForm closingQuestion={getCurrentNode().data.closingQuestion} settings={quoteSettings} carriers={carriers} />)}
            </div>
          )}
        </div>
        
        <div className="wizard-actions" style={{ flexWrap: 'wrap' }}>
          {getCurrentNode() && getOptions().map((opt, idx) => (
            <button key={idx} className="btn-option" disabled={getCurrentNode().type === 'carrierNode' && !selectedCarrierId} style={{opacity: (getCurrentNode().type === 'carrierNode' && !selectedCarrierId) ? 0.5 : 1, borderColor: BORDER, color: SLATE}} onClick={() => handleOptionClick(opt.targetId, opt.label)}><span>{opt.label}</span><ChevronRight size={16} color={JERRY_PINK} /></button>
          ))}
          {getCurrentNode() && getOptions().length === 0 && (
             <div style={{display:'flex', flexDirection:'column', gap:'10px', width:'100%'}}>
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
                <button onClick={duplicateCurrentPlaybook} title="Duplicate Current Playbook" style={{border:'none', background:'none', cursor:'pointer', padding:'4px'}}><Copy size={16} color={SLATE}/></button>
                <button onClick={() => setPlaybookManagerOpen(true)} title="Manage Playbooks" style={{border:'none', background:'none', cursor:'pointer', padding:'4px'}}><FolderCog size={16} color={SLATE}/></button>
            </div>

            <div style={{width:'1px', height:'20px', background: BORDER, margin:'0 4px'}}></div>
            <button className="btn btn-secondary" onClick={() => setSettingsModalOpen(true)} title="Config"><Settings size={16}/></button>
            <button className="btn btn-secondary" onClick={() => setCarrierModalOpen(true)} title="Carriers"><Building2 size={16}/></button>
            <button className="btn btn-secondary" onClick={() => setCallTypesModalOpen(true)} title="Manage Call Types" style={{color:'#8b5cf6'}}><Layers size={16}/></button>
            <button className="btn btn-secondary" onClick={exportPlaybookAsText} title="Export for Legal Review" style={{color:'#10b981'}}><FileText size={16}/></button>
            <button className="btn btn-secondary" onClick={autoLayoutNodes} title="Auto-Organize Playbook" style={{color:'#3b82f6'}}><GitBranch size={16}/></button>
            <div style={{width:'1px', height:'20px', background: BORDER, margin:'0 4px'}}></div>
            <button className="btn btn-secondary" onClick={addNewNode} title="Add Script"><Plus size={16}/></button>
            <button className="btn btn-secondary" onClick={addMadLibsNode} style={{color:'#10b981'}} title="Add Word Track"><Edit size={16}/></button>
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