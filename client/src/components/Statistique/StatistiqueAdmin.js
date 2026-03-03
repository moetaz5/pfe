import React, { useState, useMemo, useContext } from "react";
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
  Users,
  Activity,
  FileCheck,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  FileText,
  Calendar,
  ChevronRight,
  RefreshCw,
  Clock,
  Zap,
  ShieldCheck
} from "lucide-react";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { AuthContext } from "../../context/AuthContext";

const queryClient = new QueryClient();

// --- API Helpers ---
const fetchAdminStats = async () => {
  const res = await axios.get("http://localhost:5000/api/statistiqueadmin", {
    withCredentials: true,
  });
  return res.data;
};

// --- Utilities ---
const safeNum = (v) => (isNaN(parseFloat(v)) ? 0 : parseFloat(v));
const formatN = (v) => new Intl.NumberFormat("fr-FR").format(v);

const StatistiqueAdminContent = () => {
  const { user, loading: authLoading } = useContext(AuthContext);
  const role = String(user?.role || "").trim().toLowerCase();
  const isAdmin = role === "admin" || role === "superadmin" || role === "1";

  const [activeFilterKey, setActiveFilterKey] = useState("tx-signed");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["stats-admin"],
    queryFn: fetchAdminStats,
    enabled: !!user && isAdmin,
  });

  // Process data for charts
  const processedVolumeData = useMemo(() => {
    if (!stats?.transactionsParMois) return [];
    return stats.transactionsParMois.map(item => ({
      name: item.mois || item.month || "...",
      total: safeNum(item.total || item.value)
    }));
  }, [stats]);

  // Filters and Search
  const filteredItems = useMemo(() => {
    if (!stats) return [];
    let rows = [];
    const txList = Array.isArray(stats.transactionsListe) ? stats.transactionsListe : [];
    const fctList = Array.isArray(stats.facturesListe) ? stats.facturesListe : [];
    const userList = Array.isArray(stats.utilisateursListe) ? stats.utilisateursListe : [];

    switch (activeFilterKey) {
      case "tx-signed": rows = txList.filter(t => String(t.statut).toLowerCase().includes('sign') && !String(t.statut).toLowerCase().includes('ttn')); break;
      case "tx-ttn": rows = txList.filter(t => String(t.statut).toLowerCase().includes('ttn')); break;
      case "tx-created": rows = txList.filter(t => String(t.statut).toLowerCase().includes('cree')); break;
      case "fct-signed": rows = fctList.filter(f => String(f.statut).toLowerCase().includes('sign')); break;
      case "fct-pending": rows = fctList.filter(f => !String(f.statut).toLowerCase().includes('sign')); break;
      case "users-all": rows = userList; break;
      default: rows = txList;
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      rows = rows.filter(r => 
        String(r.id).includes(q) || 
        String(r.invoice_number || "").toLowerCase().includes(q) ||
        String(r.filename || "").toLowerCase().includes(q) ||
        String(r.email || r.user_email || "").toLowerCase().includes(q) ||
        String(r.name || r.user_name || "").toLowerCase().includes(q)
      );
    }
    return rows;
  }, [activeFilterKey, stats, searchQuery]);

  if (authLoading) return <div className="stat-scope"><div className="stat-page">Authentification...</div></div>;
  if (!isAdmin) return <div className="stat-scope"><div className="stat-page">Accès admin requis.</div></div>;
  if (isLoading) return <div className="stat-scope"><div className="stat-page">Chargement du dashboard global...</div></div>;
  if (isError) return <div className="stat-scope"><div className="stat-page">Erreur de chargement.</div></div>;

  const totalUsers = stats?.utilisateurs || 0;
  const totalTx = stats?.totalTransactions || 0;
  const totalFct = stats?.totalFactures || 0;
  const lastMonthTotal = processedVolumeData[processedVolumeData.length-2]?.total || 0;
  const thisMonthTotal = processedVolumeData[processedVolumeData.length-1]?.total || 0;
  const growth = lastMonthTotal > 0 ? (((thisMonthTotal - lastMonthTotal) / lastMonthTotal) * 100).toFixed(1) : "0.0";
  const cumulatedVolume = processedVolumeData.reduce((acc, curr) => acc + curr.total, 0);

  return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          
          {/* Header */}
          <header className="stat-header">
            <div className="stat-title">
              <h2>Dashboard Global Admin</h2>
              <p>Surveillance complète de l'activité, des utilisateurs et des flux financiers.</p>
            </div>
            <div className="stat-time-pill">
              <ShieldCheck size={14} style={{ color: 'var(--sec)' }} />
              <span>Console Administrateur</span>
              <RefreshCw size={14} style={{ marginLeft: 10, cursor: 'pointer' }} onClick={() => queryClient.invalidateQueries()} />
            </div>
          </header>

          {/* KPI Cards */}
          <section className="stat-kpi-grid">
            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-p-box"><Users size={20} /></div>
                  <div className="stat-trend-tag up">Global</div>
               </div>
               <h4>Clients Actifs</h4>
               <div className="value">{formatN(totalUsers)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-s-box"><Activity size={20} /></div>
                  <div className={`stat-trend-tag ${parseFloat(growth) >= 0 ? 'up' : 'down'}`}>
                    {parseFloat(growth) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                    {growth}%
                  </div>
               </div>
               <h4>Volume Transactions</h4>
               <div className="value">{formatN(totalTx)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-a-box"><FileCheck size={20} /></div>
               </div>
               <h4>Total Facturation</h4>
               <div className="value">{formatN(totalFct)}</div>
            </div>

            <div className="stat-kpi-item">
               <div className="stat-kpi-icon-row">
                  <div className="stat-icon-box stat-p-box" style={{ background: '#fef2f2', color: '#ef4444' }}><Zap size={20} /></div>
               </div>
               <h4>Santé Système</h4>
               <div className="value">99.9%</div>
            </div>
          </section>

          {/* Main Layout Area */}
          <div className="stat-main-grid">
            {/* Chart Area */}
            <div className="stat-glass-card">
               <div className="stat-card-head">
                  <div>
                    <h3 style={{ fontSize: '20px', letterSpacing: '-0.02em' }}>Flux de Transactions Global</h3>
                    <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                      Volume cumulé (12m): <strong style={{ color: 'var(--ink)' }}>{formatN(cumulatedVolume)}</strong>
                    </p>
                  </div>
                  <div className="stat-pill" style={{ background: 'var(--pri-soft)', border: 'none', color: 'var(--pri)', fontWeight: 700 }}>
                    <TrendingUp size={12} />
                    <span>Activité Intense</span>
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
                              <div style={{ background: 'white', padding: '12px 16px', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
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
                        activeDot={{ r: 6, fill: 'var(--pri)', stroke: 'white', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
               </div>
            </div>

            {/* Sidebar Filters */}
            <div className="stat-glass-card">
                <div className="stat-card-head">
                   <h3>Audit de la Plateforme</h3>
                </div>
                <div className="stat-filter-group">
                   <button className={`stat-f-item ${activeFilterKey === 'tx-signed' ? 'active' : ''}`} onClick={() => setActiveFilterKey('tx-signed')}>
                      <div className="stat-f-info">
                        <span>Transactions Signées</span>
                        <strong>{formatN(stats.transactionsListe?.filter(t => String(t.statut).toLowerCase().includes('sign') && !String(t.statut).toLowerCase().includes('ttn')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'tx-ttn' ? 'active' : ''}`} onClick={() => setActiveFilterKey('tx-ttn')}>
                      <div className="stat-f-info">
                        <span>Signatures TTN</span>
                        <strong>{formatN(stats.transactionsListe?.filter(t => String(t.statut).toLowerCase().includes('ttn')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'users-all' ? 'active' : ''}`} onClick={() => setActiveFilterKey('users-all')}>
                      <div className="stat-f-info">
                        <span>Liste des Utilisateurs</span>
                        <strong>{formatN(stats.utilisateursListe?.length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                   <button className={`stat-f-item ${activeFilterKey === 'fct-signed' ? 'active' : ''}`} onClick={() => setActiveFilterKey('fct-signed')}>
                      <div className="stat-f-info">
                        <span>Factures Validées</span>
                        <strong>{formatN(stats.facturesListe?.filter(f => String(f.statut).toLowerCase().includes('sign')).length || 0)}</strong>
                      </div>
                      <ChevronRight size={18} />
                   </button>
                </div>
            </div>

            {/* Data Explorer Table */}
            <div className="stat-glass-card stat-wide-card" style={{ padding: '0' }}>
                <div className="stat-card-head" style={{ padding: '30px 30px 20px', borderBottom: '1px solid #f1f5f9' }}>
                    <div>
                      <h3 style={{ fontSize: '20px' }}>Explorateur de Données Global</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                        Surveillance de <span style={{ color: 'var(--pri)', fontWeight: 700 }}>{filteredItems.length}</span> enregistrements
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ position: 'relative', width: '300px' }}>
                            <Search size={14} style={{ position: 'absolute', left: 12, top: 12, color: '#94a3b8' }} />
                            <input 
                                type="text" 
                                placeholder="Rechercher utilisateur, doc, ID..." 
                                style={{ width: '100%', padding: '10px 10px 10px 35px', borderRadius: '12px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '13px', background: '#f8fafc' }}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Headers */}
                <div className="stat-table-header">
                    <div className="stat-col-id">IDENTIFIANT</div>
                    <div className="stat-col-doc">CONTEXTE / UTILISATEUR</div>
                    <div className="stat-col-date">HORODATAGE</div>
                    <div className="stat-col-status">STATUT</div>
                    <div className="stat-col-action"></div>
                </div>

                <div className="stat-table-wrap" style={{ padding: '0 10px 20px' }}>
                    {filteredItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '80px 0', color: '#94a3b8' }}>
                            <Activity size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                            <p style={{ fontWeight: 600 }}>Aucune donnée trouvée pour cette requête.</p>
                        </div>
                    ) : (
                        filteredItems.map(item => (
                            <div key={item.id} className="stat-row">
                                <div className="stat-col-id">
                                  <span className="id-badge">#{String(item.id).slice(-6)}</span>
                                </div>
                                <div className="stat-col-doc">
                                    <div className="doc-main-info">
                                      <strong>{item.invoice_number || item.name || "SANS RÉFÉRENCE"}</strong>
                                      <span>{item.email || item.user_email || item.filename || "Inconnu"}</span>
                                    </div>
                                </div>
                                <div className="stat-col-date">
                                    <div className="date-box">
                                      <Calendar size={12} style={{ opacity: 0.5 }} />
                                      {new Date(item.date_creation || item.created_at || item.date_facture).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </div>
                                </div>
                                <div className="stat-col-status">
                                    <span className={`stat-row-status ${String(item.statut || item.role).toLowerCase().includes('sign') || String(item.role).toLowerCase() === 'admin' ? 'stat-s-green' : 'stat-s-blue'}`}>
                                        {item.statut || item.role}
                                    </span>
                                </div>
                                <div className="stat-col-action">
                                    <button className="row-action-btn">
                                      <ChevronRight size={16} />
                                    </button>
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

const StatistiqueAdmin = () => (
  <QueryClientProvider client={queryClient}>
    <StatistiqueAdminContent />
  </QueryClientProvider>
);

export default StatistiqueAdmin;