import React from "react";
import axios from "axios";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
} from "@mui/material";

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

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";

const COLORS = ["#4caf50", "#ff9800", "#2196f3", "#f44336"];

/* ================= QUERY CLIENT LOCAL ================= */
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
      <Box sx={{ padding: 4 }}>
        <Skeleton count={5} height={80} style={{ margin: 10 }} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{ padding: 4 }}>
        <Typography color="error">
          Erreur de chargement des statistiques
        </Typography>
      </Box>
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
    <Box sx={{ padding: 4 }}>
      <Typography variant="h4" gutterBottom>
        Dashboard Statistiques
      </Typography>

      {/* Cards */}
      <Grid container spacing={3} sx={{ marginBottom: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: "#e3f2fd" }}>
            <CardContent>
              <Typography>Utilisateurs</Typography>
              <Typography variant="h5">{stats.utilisateurs}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: "#fce4ec" }}>
            <CardContent>
              <Typography>Transactions</Typography>
              <Typography variant="h5">{stats.totalTransactions}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: "#e8f5e9" }}>
            <CardContent>
              <Typography>Factures</Typography>
              <Typography variant="h5">{stats.totalFactures}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: "#fff3e0" }}>
            <CardContent>
              <Typography>Montant total</Typography>
              <Typography variant="h5">{stats.totalMontant} DT</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bar chart */}
      <Typography variant="h6">Activité</Typography>
      <Box sx={{ height: 300, mb: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" fill="#1976d2" />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Pie chart */}
      <Typography variant="h6">Statut Transactions</Typography>
      <Box sx={{ height: 300, mb: 4 }}>
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
      </Box>

      {/* Monthly chart */}
      <Typography variant="h6">Transactions par mois</Typography>
      <Box sx={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={stats.transactionsParMois}>
            <XAxis dataKey="mois" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="total" fill="#ff5722" />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

/* ================= EXPORT ================= */
const Statistique = () => (
  <QueryClientProvider client={queryClient}>
    <StatistiqueContent />
  </QueryClientProvider>
);

export default Statistique;
