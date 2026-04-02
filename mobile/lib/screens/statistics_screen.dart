import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:fl_chart/fl_chart.dart';
import '../api_service.dart';
import 'transaction_detail_screen.dart';

class StatisticsScreen extends StatefulWidget {
  final Map<String, dynamic>? user;
  const StatisticsScreen({super.key, this.user});

  @override
  State<StatisticsScreen> createState() => _StatisticsScreenState();
}

class _StatisticsScreenState extends State<StatisticsScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  String? _error;

  Map<String, dynamic>? _stats;
  List<dynamic> _transactions = [];
  List<dynamic> _factures = [];
  List<dynamic> _users = []; 

  String _timeRange = 'year';
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _loading = true; _error = null; });
    try {
      final role = (widget.user?['role'] ?? '').toString().toUpperCase();
      final isAdmin = role == 'ADMIN';

      if (isAdmin) {
        final data = await api.getAdminStats();
        if (mounted) {
          setState(() {
            _stats = data;
            _transactions = data['transactionsListe'] ?? [];
            _factures = data['facturesListe'] ?? [];
            _users = data['utilisateursListe'] ?? []; // This might be empty if the backend doesn't send the full list yet, but 'utilisateurs' count is there
            _loading = false;
          });
        }
      } else {
        final futures = await Future.wait([
          api.getDashboardStats(),
          api.getMyTransactions(),
          api.getMyFactures(),
        ]);
        if (mounted) {
          setState(() {
            _stats = futures[0] as Map<String, dynamic>;
            _transactions = futures[1] as List<dynamic>;
            _factures = futures[2] as List<dynamic>;
            _loading = false;
          });
        }
      }
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 401) {
        if (mounted) Navigator.of(context).pushReplacementNamed('/login');
        return;
      }
      if (mounted) setState(() { _error = "Erreur de chargement des statistiques."; _loading = false; });
    }
  }

  bool _isWithinRange(String? dateStr) {
    if (dateStr == null) return false;
    final date = DateTime.tryParse(dateStr);
    if (date == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final dateCopy = DateTime(date.year, date.month, date.day);
    if (_timeRange == 'day') return dateCopy.isAtSameMomentAs(today);
    if (_timeRange == 'week') return date.isAfter(today.subtract(const Duration(days: 7)));
    if (_timeRange == 'month') return date.isAfter(DateTime(today.year, today.month - 1, today.day));
    return date.isAfter(DateTime(today.year - 1, today.month, today.day));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [Text(_error!), IconButton(icon: const Icon(Icons.refresh), onPressed: _loadData)]));

    final String role = (widget.user?['role'] ?? '').toString().toUpperCase();
    final bool isAdmin = role == 'ADMIN';

    final filteredTxs = _transactions.where((t) => _isWithinRange(t['date_creation'] ?? t['created_at'])).toList();
    final filteredFcts = _factures.where((f) => _isWithinRange(f['date_creation'] ?? f['created_at'])).toList();
    final filteredUsers = _users.where((u) => _isWithinRange(u['created_at'])).toList();

    int signedCount = 0;
    for (var t in filteredTxs) if ((t['statut'] ?? '').toString().toLowerCase().contains('sign')) signedCount++;
    for (var f in filteredFcts) if ((f['statut'] ?? '').toString().toLowerCase().contains('sign')) signedCount++;

    final totalDocs = filteredTxs.length + filteredFcts.length;
    final String rate = totalDocs > 0 ? ((signedCount / totalDocs) * 100).toStringAsFixed(1) : "0.0";

    // Grand totals from backend
    final int globalUsers = _stats?['utilisateurs'] ?? 0;
    final int globalOrgs = _stats?['totalOrganizations'] ?? 0;
    final int globalTxs = _stats?['totalTransactions'] ?? 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: RefreshIndicator(
        onRefresh: _loadData,
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHeader(isAdmin),
              const SizedBox(height: 28),
              _buildTimeSelector(),
              const SizedBox(height: 28),
              _buildKPIGrid(isAdmin, globalUsers, filteredTxs.length, filteredFcts.length, rate, globalOrgs, globalTxs),
              const SizedBox(height: 32),
              _buildChartSection(filteredTxs, filteredFcts),
              const SizedBox(height: 32),
              _buildExplorerSection(filteredTxs, filteredFcts, _users, isAdmin),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(bool isAdmin) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(color: const Color(0xFF0247AA).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
          child: Text(isAdmin ? 'OVERSIGHT ADMINISTRATIF' : 'ANALYTIQUE MÉDICALE', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: 1)),
        ),
        const SizedBox(height: 12),
        const Text('Performances & Flux', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1)),
        const Text('Surveillance temps réel de l\'activité transactionnelle.', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _buildTimeSelector() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(16)),
      child: Row(
        children: [
          _timeItem('JOUR', 'day'),
          _timeItem('SEMAINE', 'week'),
          _timeItem('MOIS', 'month'),
          _timeItem('ANNÉE', 'year'),
        ],
      ),
    );
  }

  Widget _timeItem(String label, String value) {
    final bool active = _timeRange == value;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _timeRange = value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(color: active ? Colors.white : Colors.transparent, borderRadius: BorderRadius.circular(12), boxShadow: active ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10)] : null),
          child: Center(child: Text(label, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: active ? const Color(0xFF0247AA) : const Color(0xFF94A3B8)))),
        ),
      ),
    );
  }

  Widget _buildKPIGrid(bool isAdmin, int globalUsers, int filteredTxs, int filteredFcts, String rate, int globalOrgs, int globalTxs) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.2,
      children: [
        _kpiCard(isAdmin ? 'TOTAL UTILISATEURS' : 'MES TRANSACTIONS', (isAdmin ? globalUsers : filteredTxs).toString(), const Color(0xFF6366F1)),
        _kpiCard(isAdmin ? 'ORGANISATIONS' : 'FACTURES ACTIVES', (isAdmin ? globalOrgs : filteredFcts).toString(), const Color(0xFF8B5CF6)),
        _kpiCard('TAUX SIGNATURE', rate + '%', const Color(0xFF10B981)),
        _kpiCard(isAdmin ? 'VOLUME TOTAL' : 'TOTAL DOSSIERS', (isAdmin ? globalTxs : (filteredTxs + filteredFcts)).toString(), const Color(0xFFF59E0B)),
      ],
    );
  }

  Widget _kpiCard(String label, String value, Color color) {
    return Container(
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
          const Spacer(),
          Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: color, letterSpacing: 1)),
        ],
      ),
    );
  }

  Widget _buildChartSection(List<dynamic> txs, List<dynamic> fcts) {
    final combined = [...txs, ...fcts];
    Map<String, int> grouped = {};
    for (var item in combined) {
      final dateStr = item['date_creation'] ?? item['created_at'];
      if (dateStr == null) continue;
      final date = DateTime.tryParse(dateStr);
      if (date == null) continue;
      String key = _timeRange == 'year' ? DateFormat('MMM').format(date) : DateFormat('dd/MM').format(date);
      grouped[key] = (grouped[key] ?? 0) + 1;
    }
    final dataPoints = grouped.entries.toList();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Evolution Temporelle', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0247AA))),
          const SizedBox(height: 4),
          const Text('Volume d\'activité certifiée', style: TextStyle(fontSize: 12, color: Color(0xFF64748B))),
          const SizedBox(height: 32),
          SizedBox(
            height: 200,
            child: dataPoints.isEmpty 
              ? const Center(child: Text('Aucune donnée'))
              : LineChart(
                  LineChartData(
                    gridData: const FlGridData(show: false),
                    titlesData: const FlTitlesData(show: false),
                    borderData: FlBorderData(show: false),
                    lineBarsData: [
                      LineChartBarData(
                        spots: dataPoints.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value.value.toDouble())).toList(),
                        isCurved: true,
                        color: const Color(0xFF0247AA),
                        barWidth: 4,
                        isStrokeCapRound: true,
                        dotData: const FlDotData(show: false),
                        belowBarData: BarAreaData(show: true, gradient: LinearGradient(colors: [const Color(0xFF0247AA).withOpacity(0.2), const Color(0xFF0247AA).withOpacity(0.0)], begin: Alignment.topCenter, end: Alignment.bottomCenter)),
                      ),
                    ],
                  ),
                ),
          ),
        ],
      ),
    );
  }

  Widget _buildExplorerSection(List<dynamic> txs, List<dynamic> fcts, List<dynamic> users, bool isAdmin) {
    // For explorer, we show filtered items or full list? Let's show recent movements from combined
    List<dynamic> combined = isAdmin ? [...txs, ...fcts] : [...txs, ...fcts];
    if (_searchQuery.isNotEmpty) {
      combined = combined.where((i) {
        final search = _searchQuery.toLowerCase();
        final title = (i['name'] ?? i['invoice_number'] ?? i['filename'] ?? '').toString().toLowerCase();
        final email = (i['email'] ?? i['user_email'] ?? '').toString().toLowerCase();
        return title.contains(search) || email.contains(search);
      }).toList();
    }
    combined.sort((a, b) => (DateTime.tryParse(b['created_at'] ?? b['date_creation'] ?? '') ?? DateTime.now()).compareTo(DateTime.tryParse(a['created_at'] ?? a['date_creation'] ?? '') ?? DateTime.now()));
    final items = combined.take(10).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('DERNIERS MOUVEMENTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
        const SizedBox(height: 16),
        ...items.map((i) => _itemRow(i, isAdmin)).toList(),
      ],
    );
  }

  Widget _itemRow(dynamic i, bool isAdmin) {
    final bool isUser = i['email'] != null && i['role'] != null;
    final title = i['name'] ?? i['invoice_number'] ?? i['filename'] ?? 'Flux sans nom';
    final date = DateTime.tryParse(i['created_at'] ?? i['date_creation'] ?? '');
    final dateStr = date != null ? DateFormat('dd MMM, HH:mm').format(date) : '-';
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: const Color(0xFFF8FAFC), shape: BoxShape.circle),
            child: Icon(isUser ? Icons.person_outline_rounded : Icons.description_outlined, size: 18, color: const Color(0xFF64748B)),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF1E293B)), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text(dateStr, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: Color(0xFFCBD5E1), size: 20),
        ],
      ),
    );
  }
}
