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
} from "recharts";

import {
  Activity,
  FileCheck,
  Zap,
  Clock,
  ChevronRight,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  FileText,
  Calendar,
  Layers,
  BarChart3
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
        const res = await axios.get("http://51.178.39.67/api/statistiquesUSER", { withCredentials: true });
        return res.data;
    } catch (e) {
        console.error("fetchStats error", e);
        throw e;
    }
};

const fetchTransactionsData = async () => {
  const res = await axios.get("http://51.178.39.67/api/transactions", { withCredentials: true });
  return Array.isArray(res.data) ? res.data : [];
};

const fetchFacturesData = async () => {
  const res = await axios.get("http://51.178.39.67/api/my-transaction-factures", { withCredentials: true });
  return Array.isArray(res.data) ? res.data : [];
};

const fetchDashboardStats = async () => {
  const res = await axios.get("http://51.178.39.67/api/dashboard/stats", { withCredentials: true });
  return res.data;
};

// --- Utilities ---
const safeNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const formatN = (v) => new Intl.NumberFormat("fr-FR").format(v);

const StatistiqueContent = () => {
  const [activeFilterKey, setActiveFilterKey] = useState("tx-signed");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState("year"); // 'day', 'week', 'month', 'year', 'custom'
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: stats, isLoading: l1 } = useQuery({ queryKey: ["stats"], queryFn: fetchStats });
  const { data: dashStats, isLoading: lDash } = useQuery({ queryKey: ["dashStats"], queryFn: fetchDashboardStats });
  const { data: txs, isLoading: l2 } = useQuery({ queryKey: ["stats-tx"], queryFn: fetchTransactionsData });
  const { data: fcts, isLoading: l3 } = useQuery({ queryKey: ["stats-fct"], queryFn: fetchFacturesData });

  const isLoading = l1 || lDash || l2 || l3;

  // --- Date filtering logic ---
  const isWithinRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const dateCopy = new Date(dateStr);
    dateCopy.setHours(0, 0, 0, 0);
    
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timeRange === "day") {
      return dateCopy.getTime() === today.getTime();
    }
    
    if (timeRange === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(today.getDate() - 7);
      return date >= weekAgo && date <= now;
    }
    
    if (timeRange === "month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(today.getMonth() - 1);
      return date >= monthAgo && date <= now;
    }
    
    if (timeRange === "custom") {
      if (!startDate && !endDate) return true;
      const start = startDate ? new Date(startDate) : new Date(0);
      start.setHours(0, 0, 0, 0);
      const end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
      return date >= start && date <= end;
    }
    
    const yearAgo = new Date(today);
    yearAgo.setFullYear(today.getFullYear() - 1);
    return date >= yearAgo && date <= now;
  };

  const filteredTxs = useMemo(() => {
    return (txs || []).filter(t => isWithinRange(t.date_creation || t.created_at));
  }, [txs, timeRange, startDate, endDate]);

  const filteredFcts = useMemo(() => {
    return (fcts || []).filter(f => isWithinRange(f.date_creation || f.created_at));
  }, [fcts, timeRange, startDate, endDate]);

  // 🔥 NEW: Process chart data DYNAMICALLY from raw data for better granularity
  const processedVolumeData = useMemo(() => {
    const combined = [...filteredTxs, ...filteredFcts];
    
    // Default fallback to monthly stats from API if no filtered data
    if (combined.length === 0 && stats?.transactionsParMois) {
       return stats.transactionsParMois.map(item => ({
          name: item.mois || item.month || "...",
          total: safeNum(item.total || item.value)
       }));
    }

    const groups = {};
    combined.forEach(item => {
      const d = new Date(item.date_creation || item.created_at);
      let key;
      if (timeRange === "year") {
        key = d.toLocaleString('fr-FR', { month: 'short' });
      } else {
        key = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      }
      groups[key] = (groups[key] || 0) + 1;
    });

    return Object.entries(groups).map(([name, total]) => ({ name, total }));
  }, [filteredTxs, filteredFcts, stats, timeRange, startDate, endDate]);

  const tableItems = useMemo(() => {
    let rows = [];
    switch (activeFilterKey) {
        case "tx-signed": rows = filteredTxs.filter(t => String(t.statut).toLowerCase().includes('sign')); break;
        case "tx-created": rows = filteredTxs.filter(t => String(t.statut).toLowerCase().includes('cree')); break;
        case "fct-signed": rows = filteredFcts.filter(f => String(f.statut).toLowerCase().includes('sign')); break;
        case "fct-pending": rows = filteredFcts.filter(f => !String(f.statut).toLowerCase().includes('sign')); break;
        default: rows = filteredTxs;
    }

    if (searchQuery) {
        rows = rows.filter(r => 
            String(r.id).includes(searchQuery) || 
            String(r.invoice_number || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            String(r.filename || "").toLowerCase().includes(searchQuery.toLowerCase())
        );
    }
    return rows;
  }, [activeFilterKey, filteredTxs, filteredFcts, searchQuery]);

  const growth = useMemo(() => {
    const lastMonthTotal = stats?.transactionsParMois?.[stats.transactionsParMois.length - 2]?.total || 0;
    const thisMonthTotal = stats?.transactionsParMois?.[stats.transactionsParMois.length - 1]?.total || 0;
    return lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : "0.0";
  }, [stats]);

  const signatureRate = useMemo(() => {
    const totalCount = filteredTxs.length + filteredFcts.length;
    if (totalCount === 0) return "0.0";
    const signedCount = filteredTxs.filter(t => String(t.statut).toLowerCase().includes('sign')).length + 
                        filteredFcts.filter(f => String(f.statut).toLowerCase().includes('sign')).length;
    return ((signedCount / totalCount) * 100).toFixed(1);
  }, [filteredTxs, filteredFcts]);


  if (isLoading) return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          <Skeleton height={40} width={200} style={{ marginBottom: 20 }} />
          <div className="stat-kpi-grid">
            {[1,2,3,4].map(i => <Skeleton key={i} height={120} borderRadius={20} />)}
          </div>
          <Skeleton height={400} borderRadius={20} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          
          {/* Header */}
          <header className="stat-header">
            <div className="stat-title">
              <div className="stat-badge"><BarChart3 size={14} /> Analytics Médical</div>
              <h2>Tableau de Bord Statistiques</h2>
              <p>Analyse précise de vos transactions et documents sécurisés Médica-Sign.</p>
            </div>
            
            <div className="stat-actions-row">
              <div className="stat-range-selector">
                <button className={timeRange === 'day' ? 'active' : ''} onClick={() => setTimeRange('day')}>Jour</button>
                <button className={timeRange === 'week' ? 'active' : ''} onClick={() => setTimeRange('week')}>Semaine</button>
                <button className={timeRange === 'month' ? 'active' : ''} onClick={() => setTimeRange('month')}>Mois</button>
                <button className={timeRange === 'year' ? 'active' : ''} onClick={() => setTimeRange('year')}>1 An</button>
                <button className={timeRange === 'custom' ? 'active' : ''} onClick={() => setTimeRange('custom')}>Période</button>
              </div>

              {timeRange === 'custom' && (
                <div className="stat-custom-range">
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                    placeholder="Du"
                  />
                  <span>au</span>
                  <input 
                    type="date" 
                    value={endDate} 
                    onChange={(e) => setEndDate(e.target.value)}
                    placeholder="Au"
                  />
                </div>
              )}

              <div className="stat-time-pill" title="Actualiser les données" onClick={() => queryClient.invalidateQueries()}>
                <Calendar size={14} />
                <span>
                  {timeRange === 'day' ? "Aujourd'hui" : 
                   timeRange === 'week' ? "7 derniers jours" : 
                   timeRange === 'month' ? "30 derniers jours" : 
                   timeRange === 'custom' ? (startDate && endDate ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}` : "Choisir dates") :
                   "Derniers 12 mois"}
                </span>
                <Layers size={14} className="refresh-icon" />
              </div>
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
               <h4>Transactions Flux</h4>
               <div className="value">{formatN(filteredTxs.length)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-s-box"><FileCheck size={20} /></div>
               </div>
               <h4>Factures Traitées</h4>
               <div className="value">{formatN(filteredFcts.length)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-a-box"><Zap size={20} /></div>
               </div>
               <h4>Taux de Signature</h4>
               <div className="value">{signatureRate}%</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box" style={{ background: 'var(--pri-soft)', color: 'var(--pri)' }}><Clock size={20} /></div>
               </div>
               <h4>Jetons Disponibles</h4>
               <div className="value">{formatN(dashStats?.totalJetons || 0)}</div>
            </div>
          </section>

          {/* Main Content Area */}
          <div className="stat-main-grid">
            <div className="stat-glass-card">
               <div className="stat-card-head">
                  <div>
                    <h3 style={{ fontSize: '20px', letterSpacing: '-0.02em', fontWeight: 800 }}>Évolution du Volume</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--muted)' }}>
                      Documents cumulés sur la période : <strong style={{ color: 'var(--pri)' }}>{formatN(filteredTxs.length + filteredFcts.length)}</strong>
                    </p>
                  </div>
                  <div className="stat-growth-label">
                    <TrendingUp size={14} />
                    <span>Progression stable</span>
                  </div>
               </div>
               <div style={{ height: 350, width: '100%', marginTop: '20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={processedVolumeData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--pri)" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="var(--pri)" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} 
                        dy={15}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} 
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="chart-tooltip-pro">
                                <p className="tooltip-date">{payload[0].payload.name}</p>
                                <p className="tooltip-value">{formatN(payload[0].value)} <span>documents</span></p>
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
                        dot={{ r: 5, fill: 'white', stroke: 'var(--pri)', strokeWidth: 3 }}
                        activeDot={{ r: 7, fill: 'var(--pri)', stroke: 'white', strokeWidth: 3 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            <div className="stat-glass-card">
                <div className="stat-card-head">
                   <h3 style={{ fontWeight: 800 }}>Répartition & Filtres</h3>
                </div>
                <div className="stat-filter-group">
                   <button className={`stat-f-item ${activeFilterKey === 'tx-signed' ? 'active' : ''}`} onClick={() => setActiveFilterKey('tx-signed')}>
                      <div className="stat-f-info">
                        <span>Transactions Signées</span>
                        <strong>{formatN(filteredTxs.filter(t => String(t.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'tx-created' ? 'active' : ''}`} onClick={() => setActiveFilterKey('tx-created')}>
                      <div className="stat-f-info">
                        <span>Transactions Créées</span>
                        <strong>{formatN(filteredTxs.filter(t => String(t.statut).toLowerCase().includes('cree')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'fct-signed' ? 'active' : ''}`} onClick={() => setActiveFilterKey('fct-signed')}>
                      <div className="stat-f-info">
                        <span>Factures Signées</span>
                        <strong>{formatN(filteredFcts.filter(f => String(f.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'fct-pending' ? 'active' : ''}`} onClick={() => setActiveFilterKey('fct-pending')}>
                      <div className="stat-f-info">
                        <span>Factures en attente</span>
                        <strong>{formatN(filteredFcts.filter(f => !String(f.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                </div>
            </div>

            {/* Explorateur de données */}
            <div className="stat-glass-card stat-wide-card">
                <div className="stat-card-head" style={{ flexWrap: 'wrap', gap: '24px' }}>
                    <h3 style={{ fontWeight: 800 }}>Explorateur de Documents</h3>
                    <div style={{ display: 'flex', gap: '15px', flex: 1, maxWidth: '500px' }}>
                        <div className="stat-search-wrap">
                            <Search size={16} className="search-icon" />
                            <input 
                                type="text" 
                                placeholder="Rechercher par ID, nom de fichier ou numéro de facture..." 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="stat-table-wrap">
                    {tableItems.length === 0 ? (
                        <div className="stat-empty-state">
                            <FileText size={44} />
                            <p>Aucune donnée trouvée pour cette période ou ces critères.</p>
                        </div>
                    ) : (
                        tableItems.map(item => (
                            <div key={item.id} className="stat-row">
                                <div className="stat-id-badge">#{String(item.id).slice(-4)}</div>
                                <div className="stat-row-info">
                                    <strong>{item.invoice_number || item.filename || "Document Médica-Sign"}</strong>
                                    <p className="row-date">
                                      {new Date(item.date_creation || item.created_at).toLocaleDateString('fr-FR', { 
                                        day: '2-digit', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </p>
                                </div>
                                <div className="stat-row-type">
                                  {item.invoice_number ? "Facture Electronique" : "Transaction Libre"}
                                </div>
                                <div>
                                    <span className={`stat-row-status ${String(item.statut).toLowerCase().includes('sign') ? 'stat-s-green' : 'stat-s-blue'}`}>
                                        {item.statut === "signé" ? "Signé" : item.statut === "créé" ? "En attente" : item.statut}
                                    </span>
                                </div>
                                <div className="stat-row-action">
                                    <ChevronRight size={20} />
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
