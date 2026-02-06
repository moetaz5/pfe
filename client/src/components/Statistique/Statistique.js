import React from "react";
import axios from "axios";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import "../style/statistique.css";

import { Typography, Grid, Card, CardContent } from "@mui/material";

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
const COLORS = ["#0247AA", "#497BC1", "#A0BADF", "#000000"];

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
    { name: "Validées", value: stats.transactionsValidees },
    { name: "En attente", value: stats.transactionsEnAttente },
  ];

  return (
    <div className="stat-scope">
      <div className="stat-page">
        <div className="stat-container">
          {/* Header */}
          <div className="stat-header">
            <h2>Dashboard Statistiques</h2>
            <p>Vue d’ensemble sur l’activité et l’état des transactions</p>
          </div>

          {/* Cards */}
          <Grid container spacing={3} sx={{ mb: 4 }}>
            {[
              { label: "Utilisateurs", value: stats.utilisateurs },
              { label: "Transactions", value: stats.totalTransactions },
              { label: "Factures", value: stats.totalFactures },
              
            ].map((item, i) => (
              <Grid item xs={12} sm={6} md={3} key={i}>
                <Card className="stat-card">
                  <CardContent>
                    <div className="stat-card-title">{item.label}</div>
                    <div className="stat-card-value">{item.value}</div>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Bar chart */}
          <div className="stat-section-title">Activité</div>
          <Card className="stat-card" sx={{ mb: 4 }}>
            <CardContent>
              <div className="stat-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0247AA" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Pie chart */}
          <div className="stat-section-title">Statut Transactions</div>
          <Card className="stat-card" sx={{ mb: 4 }}>
            <CardContent>
              <div className="stat-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" label>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Monthly chart */}
          <div className="stat-section-title">Transactions par mois</div>
          <Card className="stat-card">
            <CardContent>
              <div className="stat-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.transactionsParMois}>
                    <XAxis dataKey="mois" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="total" fill="#497BC1" radius={[10, 10, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
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
