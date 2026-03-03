import React, { useState, useMemo } from "react";
import axios from "axios";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import "../style/statistique.css";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import {
  Activity,
  FileCheck,
  Zap,
  Clock,
  ChevronRight,
  Filter,
  RefreshCw,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  FileText,
  Calendar
} from "lucide-react";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

const queryClient = new QueryClient();

// --- API Helpers ---
const fetchStats = async () => {
    try {
        const res = await axios.get("http://localhost:5000/api/statistiquesUSER", { withCredentials: true });
        return res.data;
    } catch (e) {
        console.error("fetchStats error", e);
        throw e;
    }
};

const fetchTransactionsData = async () => {
  const res = await axios.get("http://localhost:5000/api/transactions", { withCredentials: true });
  return Array.isArray(res.data) ? res.data : [];
};

const fetchFacturesData = async () => {
  const res = await axios.get("http://localhost:5000/api/factures", { withCredentials: true });
  return Array.isArray(res.data) ? res.data : [];
};

// --- Utilities ---
const safeNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const formatN = (v) => new Intl.NumberFormat("fr-FR").format(v);

const StatistiqueContent = () => {
  const [activeFilterKey, setActiveFilterKey] = useState("tx-signed");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading: l1 } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const { data: txs, isLoading: l2 } = useQuery({ queryKey: ["stats-tx"], queryFn: fetchTransactionsData });
  const { data: fcts, isLoading: l3 } = useQuery({ queryKey: ["stats-fct"], queryFn: fetchFacturesData });

  const isLoading = l1 || l2 || l3;

  // Process data
  const processedVolumeData = useMemo(() => {
    if (!stats?.transactionsParMois) return [];
    return stats.transactionsParMois.map(item => ({
      name: item.mois || item.month || "...",
      total: safeNum(item.total || item.value)
    }));
  }, [stats]);

  const filteredItems = useMemo(() => {
    let rows = [];
    const txList = Array.isArray(txs) ? txs : [];
    const fctList = Array.isArray(fcts) ? fcts : [];

    switch (activeFilterKey) {
        case "tx-signed": rows = txList.filter(t => String(t.statut).toLowerCase().includes('sign')); break;
        case "tx-created": rows = txList.filter(t => String(t.statut).toLowerCase().includes('cree')); break;
        case "fct-signed": rows = fctList.filter(f => String(f.statut).toLowerCase().includes('sign')); break;
        case "fct-pending": rows = fctList.filter(f => !String(f.statut).toLowerCase().includes('sign')); break;
        default: rows = txList;
    }

    if (searchQuery) {
        rows = rows.filter(r => 
            String(r.id).includes(searchQuery) || 
            String(r.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(r.filename || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    return rows;
  }, [activeFilterKey, txs, fcts, searchQuery]);

  if (isLoading) return <div className="stat-scope"><div className="stat-page">Chargement du dashboard premium...</div></div>;

  const totalTx = txs?.length || 0;
  const totalFct = fcts?.length || 0;
  const lastMonthTotal = processedVolumeData[processedVolumeData.length-2]?.total || 0;
  const thisMonthTotal = processedVolumeData[processedVolumeData.length-1]?.total || 0;
  const growth = lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : "0.0";

  return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          
          {/* Header */}
          <header className="stat-header">
            <div className="stat-title">
              <h2>Analytics Pro</h2>
              <p>Renseignements détaillés sur vos flux de signature électronique.</p>
            </div>
            <div className="stat-time-pill">
              <Calendar size={14} />
              <span>Derniers 12 mois</span>
              <RefreshCw size={14} style={{ marginLeft: 10, cursor: 'pointer' }} onClick={() => queryClient.invalidateQueries()} />
            </div>
          </header>

          {/* KPI Cards */}
          <section className="stat-kpi-grid">
            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-p-box"><Activity size={20} /></div>
                  <div className={`stat-trend-tag ${parseFloat(growth) >= 0 ? 'up' : 'down'}`}>
                    {parseFloat(growth) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {growth}%
                  </div>
               </div>
               <h4>Flux Transactionnel</h4>
               <div className="value">{formatN(totalTx)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-s-box"><FileCheck size={20} /></div>
               </div>
               <h4>Factures Traitées</h4>
               <div className="value">{formatN(totalFct)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-a-box"><Zap size={20} /></div>
               </div>
               <h4>Taux de réussite</h4>
               <div className="value">98.4%</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-p-box" style={{ background: '#f1f5f9', color: '#475569' }}><Clock size={20} /></div>
               </div>
               <h4>Temps moyen</h4>
               <div className="value">2.4m</div>
            </div>
          </section>

          {/* Main Charts area */}
          <div className="stat-main-grid">
            <div className="stat-glass-card">
               <div className="stat-card-head">
                  <div>
                    <h3 style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>Progression Mensuelle</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      Volume cumulé sur 12 mois: <strong style={{ color: 'var(--ink)' }}>{formatN(processedVolumeData.reduce((acc, curr) => acc + curr.total, 0))}</strong>
                    </p>
                  </div>
                  <div className="stat-pill" style={{ background: 'var(--pri-soft)', border: 'none', color: 'var(--pri)', fontWeight: 700 }}>
                    <TrendingUp size={12} />
                    <span>En hausse</span>
                  </div>
               </div>
               <div style={{ height: 350, width: '100%', marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--pri)" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="var(--pri)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                        dy={15}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
                      />
                      <Tooltip 
                        cursor={{ stroke: 'var(--pri)', strokeWidth: 1, strokeDasharray: '4 4' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div style={{ 
                                background: 'white', 
                                padding: '12px 16px', 
                                border: '1px solid #e2e8f0', 
                                borderRadius: '12px',
                                boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                              }}>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{payload[0].payload.name}</p>
                                <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800, color: 'var(--pri)' }}>{formatN(payload[0].value)} <span style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>docs</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="total" 
                        stroke="var(--pri)" 
                        strokeWidth={4}
                        fillOpacity={1} 
                        fill="url(#colorTotal)" 
                        dot={{ r: 4, fill: 'white', stroke: 'var(--pri)', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: 'var(--pri)', stroke: 'white', strokeWidth: 2, shadow: '0 0 10px rgba(15, 90, 209, 0.5)' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="stat-glass-card">
                <div className="stat-card-head">
                   <h3>Filtres Avancés</h3>
                </div>
                <div className="stat-filter-group">
                   <button className={`stat-f-item ${activeFilterKey === 'tx-signed' ? 'active' : ''}`} onClick={() => setActiveFilterKey('tx-signed')}>
                      <div className="stat-f-info">
                        <span>Transactions Signées</span>
                        <strong>{formatN(txs?.filter(t => String(t.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'tx-created' ? 'active' : ''}`} onClick={() => setActiveFilterKey('tx-created')}>
                      <div className="stat-f-info">
                        <span>Transactions Créées</span>
                        <strong>{formatN(txs?.filter(t => String(t.statut).toLowerCase().includes('cree')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'fct-signed' ? 'active' : ''}`} onClick={() => setActiveFilterKey('fct-signed')}>
                      <div className="stat-f-info">
                        <span>Factures Signées</span>
                        <strong>{formatN(fcts?.filter(f => String(f.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'fct-pending' ? 'active' : ''}`} onClick={() => setActiveFilterKey('fct-pending')}>
                      <div className="stat-f-info">
                        <span>Factures en attente</span>
                        <strong>{formatN(fcts?.filter(f => !String(f.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="stat-glass-card stat-wide-card">
                <div className="stat-card-head" style={{ flexWrap: 'wrap', gap: '20px' }}>
                    <h3>Explorateur de données</h3>
                    <div style={{ display: 'flex', gap: '15px', flex: 1, maxWidth: '400px' }}>
                        <div style={{ position: 'relative', width: '100%' }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                            <input 
                                type="text" 
                                placeholder="Filtrer les résultats ici..." 
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none', fontSize: 13 }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="stat-table-wrap">
                    {filteredItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '100px 0', color: '#94a3b8' }}>
                            <FileText size={48} style={{ opacity: 0.2, marginBottom: '10px' }} />
                            <p>Aucune donnée ne correspond à votre recherche.</p>
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <div key={item.id} className="stat-row">
                                <div className="stat-avatar-txt">#{String(item.id).slice(-3)}</div>
                                <div className="stat-row-info">
                                    <h5>{item.invoice_number || item.filename || "Document sans nom"}</h5>
                                    <p>{new Date(item.date_creation || item.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <div>
                                    <span className={`stat-row-status ${String(item.statut).toLowerCase().includes('sign') ? 'stat-s-green' : 'stat-s-blue'}`}>
                                        {item.statut}
                                    </span>
                                </div>
                                <div style={{ color: '#94a3b8' }}>
                                    <ChevronRight size={18} />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

const Statistique = () => (
  <QueryClientProvider client={queryClient}>
    <StatistiqueContent />
  </QueryClientProvider>
);

export default Statistique;
