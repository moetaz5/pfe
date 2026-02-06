import React from "react";
import axios from "axios";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import "../style/statistique.css";

import { Typography } from "@mui/material";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";

/* ================= CONFIG ================= */
const COLORS = ["#0f5ad1", "#0ea5a4", "#f59e0b", "#0f172a"];

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/* ================= API ================= */
const fetchStats = async () => {
  const res = await axios.get("http://localhost:5000/api/statistiques", {
    withCredentials: true,
  });
  return res.data;
};

/* ================= CONTENT ================= */
const StatistiqueContent = () => {
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  if (isLoading) {
    return (
      <div className="stat-scope">
        <div className="stat-page">
          <div className="stat-container">
            <Skeleton count={5} height={80} className="stat-skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="stat-scope">
        <div className="stat-page">
          <div className="stat-container">
            <Typography color="error">
              Erreur de chargement des statistiques
            </Typography>
          </div>
        </div>
      </div>
    );
  }

  const barData = [
    { name: "Transactions", value: stats.totalTransactions },
    { name: "Factures", value: stats.totalFactures },
  ];

  const pieData = [
    { name: "Validees", value: stats.transactionsValidees },
    { name: "En attente", value: stats.transactionsEnAttente },
  ];

  const kpis = [
    { label: "Utilisateurs", value: stats.utilisateurs, hint: "Comptes actifs" },
    { label: "Transactions", value: stats.totalTransactions, hint: "Total traite" },
    { label: "Factures", value: stats.totalFactures, hint: "Documents PDF" },
    {
      label: "Validations",
      value: stats.transactionsValidees,
      hint: "Transactions validees",
    },
  ];

  return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          <div className="stat-hero">
            <div className="stat-title">
              <h2>Dashboard statistiques</h2>
              <p>Vue d’ensemble sur l’activité et l’état des transactions</p>
            </div>
            <div className="stat-pill">Données globales</div>
          </div>

          <div className="stat-kpis">
            {kpis.map((item, i) => (
              <div className="stat-kpi-card" key={i}>
                <div className="stat-kpi-label">{item.label}</div>
                <div className="stat-kpi-value">{item.value}</div>
                <div className="stat-kpi-hint">{item.hint}</div>
              </div>
            ))}
          </div>

          <div className="stat-panels">
            <div className="stat-panel">
              <div className="stat-panel-head">
                <h3>Activité</h3>
                <p>Transactions vs factures</p>
              </div>
              <div className="stat-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0f5ad1" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="stat-panel">
              <div className="stat-panel-head">
                <h3>Statut des transactions</h3>
                <p>Répartition globale</p>
              </div>
              <div className="stat-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" labelLine={false} label>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="stat-legend">
                {pieData.map((item, i) => (
                  <div className="stat-legend-item" key={item.name}>
                    <div className="stat-legend-left">
                      <span
                        className="stat-legend-swatch"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span>{item.name}</span>
                    </div>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="stat-panel stat-panel-wide">
              <div className="stat-panel-head">
                <h3>Transactions par mois</h3>
                <p>Volume de transactions par période</p>
              </div>
              <div className="stat-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.transactionsParMois}>
                    <XAxis dataKey="mois" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#0ea5a4" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ================= EXPORT ================= */
const Statistique = () => (
  <QueryClientProvider client={queryClient}>
    <StatistiqueContent />
  </QueryClientProvider>
);

export default Statistique;
