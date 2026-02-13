import React from "react";
import axios from "axios";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import "../style/statistique.css";

import {
  BarChart,
  Bar,
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
  FileText,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const fetchStats = async () => {
  const res = await axios.get("http://localhost:5000/api/statistiquesUSER", {
    withCredentials: true,
  });
  return res.data;
};

const fetchTransactions = async () => {
  const res = await axios.get("http://localhost:5000/api/transactions", {
    withCredentials: true,
  });
  return Array.isArray(res.data) ? res.data : [];
};

const fetchFactures = async () => {
  const res = await axios.get("http://localhost:5000/api/factures", {
    withCredentials: true,
  });
  return Array.isArray(res.data) ? res.data : [];
};

const toNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace("%", "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
};

const safeNumber = (value) => {
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (value) =>
  new Intl.NumberFormat("fr-FR").format(safeNumber(value));

const formatDateTime = (value) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("fr-FR");
};

const normalizeStatus = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getMonthlyGrowth = (volumeData) => {
  if (!Array.isArray(volumeData) || volumeData.length < 2) return null;
  const last = volumeData[volumeData.length - 1]?.total ?? 0;
  const prev = volumeData[volumeData.length - 2]?.total ?? 0;
  if (!Number.isFinite(last) || !Number.isFinite(prev) || prev === 0) return null;
  const value = ((last - prev) / prev) * 100;
  return { value, trendUp: value >= 0 };
};

const CHART_COLORS = ["#0f5ad1", "#0ea5a4", "#f59e0b"];

const FilterCard = ({ label, count, isActive, onClick }) => (
  <button
    type="button"
    className={`stat-filter-card ${isActive ? "is-active" : ""}`}
    onClick={onClick}
  >
    <span className="stat-filter-card-label">{label}</span>
    <strong className="stat-filter-card-count">{formatNumber(count)}</strong>
  </button>
);

const StatistiqueContent = () => {
  const [activeFilterKey, setActiveFilterKey] = React.useState("tx-signed");

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
  } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  const {
    data: transactions,
    isLoading: isTransactionsLoading,
    isError: isTransactionsError,
  } = useQuery({
    queryKey: ["stats-transactions"],
    queryFn: fetchTransactions,
  });

  const {
    data: factures,
    isLoading: isFacturesLoading,
    isError: isFacturesError,
  } = useQuery({
    queryKey: ["stats-factures"],
    queryFn: fetchFactures,
  });

  const isLoading = isStatsLoading || isTransactionsLoading || isFacturesLoading;
  const isError = isStatsError || isTransactionsError || isFacturesError;

  if (isLoading) {
    return (
      <div className="stat-scope">
        <div className="stat-page">
          <div className="stat-container">
            <div className="stat-hero">
              <div className="stat-title">
                <Skeleton height={28} width={220} />
                <Skeleton height={16} width={320} style={{ marginTop: 8 }} />
              </div>
              <Skeleton height={36} width={160} />
            </div>
            <div className="stat-kpis">
              {Array.from({ length: 2 }).map((_, i) => (
                <div className="stat-kpi-card stat-skeleton" key={i}>
                  <Skeleton height={16} width={120} />
                  <Skeleton height={28} width={90} style={{ marginTop: 8 }} />
                </div>
              ))}
            </div>
            <div className="stat-panels">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  className={`stat-panel ${i === 3 ? "stat-panel-wide" : ""}`}
                  key={i}
                >
                  <Skeleton height={18} width={180} />
                  <Skeleton height={12} width={240} />
                  <Skeleton height={180} style={{ marginTop: 16 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="stat-scope">
        <div className="stat-page">
          <div className="stat-container">
            <div className="stat-panel">
              <div className="stat-panel-head">
                <h3>Erreur de chargement</h3>
                <p>Impossible de recuperer les statistiques pour le moment.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const txRows = Array.isArray(transactions) ? transactions : [];
  const factureRows = Array.isArray(factures) ? factures : [];

  const txSignedTTN = txRows.filter((row) =>
    normalizeStatus(row.statut).includes("ttn"),
  );
  const txSigned = txRows.filter((row) => {
    const status = normalizeStatus(row.statut);
    return status.includes("sign") && !status.includes("ttn");
  });
  const txCreated = txRows.filter((row) =>
    normalizeStatus(row.statut).includes("cree"),
  );

  const factureWaiting = factureRows.filter((row) => {
    const status = normalizeStatus(row.statut);
    return !status || status.includes("attente");
  });
  const factureInTransaction = factureRows.filter((row) =>
    normalizeStatus(row.statut).includes("transaction"),
  );
  const factureSigned = factureRows.filter((row) =>
    normalizeStatus(row.statut).includes("sign"),
  );

  const filterMap = {
    "tx-signed": {
      key: "tx-signed",
      kind: "transaction",
      label: "Transactions signees",
      rows: txSigned,
    },
    "tx-created": {
      key: "tx-created",
      kind: "transaction",
      label: "Transactions creees",
      rows: txCreated,
    },
    "tx-ttn": {
      key: "tx-ttn",
      kind: "transaction",
      label: "Transactions signees par TTN",
      rows: txSignedTTN,
    },
    "facture-waiting": {
      key: "facture-waiting",
      kind: "facture",
      label: "Factures en attente",
      rows: factureWaiting,
    },
    "facture-transaction": {
      key: "facture-transaction",
      kind: "facture",
      label: "Factures en transaction",
      rows: factureInTransaction,
    },
    "facture-signed": {
      key: "facture-signed",
      kind: "facture",
      label: "Factures signees",
      rows: factureSigned,
    },
  };

  const activeFilter = filterMap[activeFilterKey] || filterMap["tx-signed"];

  const pieData =
    activeFilter.kind === "facture"
      ? [
          { name: "En attente", value: factureWaiting.length },
          { name: "En transaction", value: factureInTransaction.length },
          { name: "Signees", value: factureSigned.length },
        ]
      : [
          { name: "Signees", value: txSigned.length },
          { name: "Creees", value: txCreated.length },
          { name: "Signees TTN", value: txSignedTTN.length },
        ];

  const totalTransactions = safeNumber(stats.totalTransactions ?? txRows.length);
  const totalFactures = safeNumber(stats.totalFactures ?? factureRows.length);

  const volumeData = Array.isArray(stats.transactionsParMois)
    ? stats.transactionsParMois.map((item) => ({
        label: item.mois ?? item.month ?? item.label ?? "",
        total: safeNumber(item.total ?? item.value ?? 0),
      }))
    : [];

  const growth = getMonthlyGrowth(volumeData);

  const kpis = [
    {
      label: "Transactions",
      value: formatNumber(totalTransactions),
      icon: TrendingUp,
      accent: "accent-brand",
      trend: growth
        ? `${growth.value >= 0 ? "+" : ""}${growth.value.toFixed(1)}%`
        : null,
      trendUp: growth ? growth.trendUp : true,
    },
    {
      label: "Factures",
      value: formatNumber(totalFactures),
      icon: FileText,
      accent: "accent-blue",
    },
  ];

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    color: "var(--ink)",
    boxShadow: "var(--shadow)",
  };

  return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          <div className="stat-hero">
            <div className="stat-title">
              <h2>Statistiques</h2>
              <p>Transactions et factures avec filtres par statut.</p>
            </div>
            <div className="stat-pill">
              <TrendingUp size={16} />
              <span>Indicateurs en direct</span>
            </div>
          </div>

          <div className="stat-kpis">
            {kpis.map((kpi) => (
              <div className="stat-kpi-card" key={kpi.label}>
                <div className="stat-kpi-top">
                  <div className={`stat-kpi-icon ${kpi.accent}`}>
                    <kpi.icon size={18} />
                  </div>
                  {kpi.trend && (
                    <div className={`stat-kpi-trend ${kpi.trendUp ? "up" : "down"}`}>
                      {kpi.trendUp ? (
                        <ArrowUpRight size={14} />
                      ) : (
                        <ArrowDownRight size={14} />
                      )}
                      {kpi.trend}
                    </div>
                  )}
                </div>
                <div className="stat-kpi-value">{kpi.value}</div>
                <div className="stat-kpi-label">{kpi.label}</div>
              </div>
            ))}
          </div>

          <div className="stat-panels">
            <div className="stat-panel stat-panel-wide">
              <div className="stat-panel-head">
                <h3>Transactions par mois</h3>
                <p>Volume des transactions de votre compte par mois.</p>
              </div>
              <div className="stat-chart stat-chart-lg">
                {volumeData.length === 0 ? (
                  <div className="stat-empty">Aucune donnee disponible.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={volumeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--muted)", fontSize: 12 }}
                        axisLine={{ stroke: "var(--line)" }}
                        tickLine={{ stroke: "var(--line)" }}
                      />
                      <YAxis
                        tick={{ fill: "var(--muted)", fontSize: 12 }}
                        axisLine={{ stroke: "var(--line)" }}
                        tickLine={{ stroke: "var(--line)" }}
                      />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar
                        dataKey="total"
                        fill={CHART_COLORS[0]}
                        radius={[8, 8, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="stat-panel">
              <div className="stat-panel-head">
                <h3>
                  {activeFilter.kind === "facture"
                    ? "Repartition factures"
                    : "Repartition transactions"}
                </h3>
                <p>Le graphique suit le groupe de filtre actif.</p>
              </div>
              <div className="stat-chart stat-chart-md">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={5}
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="stat-legend">
                {pieData.map((item, i) => (
                  <div className="stat-legend-item" key={item.name}>
                    <div className="stat-legend-left">
                      <span
                        className="stat-legend-swatch"
                        style={{
                          backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <strong>{formatNumber(item.value)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="stat-panel">
              <div className="stat-panel-head">
                <h3>Filtres transactions</h3>
                <p>Cliquez une carte pour afficher la liste et le total.</p>
              </div>
              <div className="stat-filter-cards">
                <FilterCard
                  label="Transactions signees"
                  count={txSigned.length}
                  isActive={activeFilterKey === "tx-signed"}
                  onClick={() => setActiveFilterKey("tx-signed")}
                />
                <FilterCard
                  label="Transactions creees"
                  count={txCreated.length}
                  isActive={activeFilterKey === "tx-created"}
                  onClick={() => setActiveFilterKey("tx-created")}
                />
                <FilterCard
                  label="Transactions signees TTN"
                  count={txSignedTTN.length}
                  isActive={activeFilterKey === "tx-ttn"}
                  onClick={() => setActiveFilterKey("tx-ttn")}
                />
              </div>
            </div>

            <div className="stat-panel">
              <div className="stat-panel-head">
                <h3>Filtres factures</h3>
                <p>Cliquez une carte pour afficher la liste et le total.</p>
              </div>
              <div className="stat-filter-cards">
                <FilterCard
                  label="Factures en attente"
                  count={factureWaiting.length}
                  isActive={activeFilterKey === "facture-waiting"}
                  onClick={() => setActiveFilterKey("facture-waiting")}
                />
                <FilterCard
                  label="Factures en transaction"
                  count={factureInTransaction.length}
                  isActive={activeFilterKey === "facture-transaction"}
                  onClick={() => setActiveFilterKey("facture-transaction")}
                />
                <FilterCard
                  label="Factures signees"
                  count={factureSigned.length}
                  isActive={activeFilterKey === "facture-signed"}
                  onClick={() => setActiveFilterKey("facture-signed")}
                />
              </div>
            </div>

            <div className="stat-panel stat-panel-wide">
              <div className="stat-panel-head">
                <h3>Resultat filtre</h3>
                <p>Liste detaillee basee sur le filtre selectionne.</p>
              </div>

              <div className="stat-filter-summary">
                <span className="stat-filter-chip">{activeFilter.label}</span>
                <strong>Total filtre: {formatNumber(activeFilter.rows.length)}</strong>
              </div>

              <div className="stat-filter-list">
                {activeFilter.rows.length === 0 ? (
                  <div className="stat-empty">Aucun element pour ce filtre.</div>
                ) : (
                  activeFilter.rows.map((row) => (
                    <div
                      className="stat-filter-row"
                      key={`${activeFilter.key}-${row.id}-${row.statut || "na"}`}
                    >
                      {activeFilter.kind === "transaction" ? (
                        <>
                          <div className="stat-filter-main">
                            <strong>Transaction #{row.id}</strong>
                            <span>Facture: {row.facture_number || "-"}</span>
                            <span>Statut: {row.statut || "-"}</span>
                          </div>
                          <span className="stat-filter-date">
                            {formatDateTime(row.date_creation)}
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="stat-filter-main">
                            <strong>Facture #{row.id}</strong>
                            <span>Statut: {row.statut || "en attente"}</span>
                          </div>
                          <span className="stat-filter-date">
                            {formatDateTime(row.date_facture)}
                          </span>
                        </>
                      )}
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
