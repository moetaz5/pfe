import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api_service.dart';
import 'transaction_detail_screen.dart';

class AdminTransactionListScreen extends StatefulWidget {
  const AdminTransactionListScreen({super.key});

  @override
  State<AdminTransactionListScreen> createState() => _AdminTransactionListScreenState();
}

class _AdminTransactionListScreenState extends State<AdminTransactionListScreen> {
  final ApiService api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  List<dynamic> _transactions = [];
  List<dynamic> _filteredTransactions = [];

  @override
  void initState() {
    super.initState();
    _loadData();
    _searchController.addListener(_filterTransactions);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final txs = await api.adminGetAllTransactions();
      if (mounted) {
        setState(() {
          _transactions = txs;
          _filteredTransactions = txs;
          _loading = false;
        });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _filterTransactions() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredTransactions = _transactions.where((tx) {
        final id = tx['id'].toString().toLowerCase();
        final userName = (tx['user_name'] ?? '').toString().toLowerCase();
        final userEmail = (tx['user_email'] ?? '').toString().toLowerCase();
        final clientEmail = (tx['client_email'] ?? '').toString().toLowerCase();
        return id.contains(query) || userName.contains(query) || userEmail.contains(query) || clientEmail.contains(query);
      }).toList();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _loading 
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: CustomScrollView(
                slivers: [
                  _buildSliverHeader(),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        _buildSearchBar(),
                        const SizedBox(height: 24),
                        _buildOverviewCard(),
                        const SizedBox(height: 32),
                        const Text('JOURNAL GLOBAL DES FLUX', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_filteredTransactions.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune transaction trouvée.')))
                        else
                          ..._filteredTransactions.map((tx) => _buildTxCard(tx)).toList(),
                        const SizedBox(height: 80),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSliverHeader() {
    return SliverAppBar(
      expandedHeight: 120,
      pinned: true,
      backgroundColor: const Color(0xFF0247AA),
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        title: const Text('Surveillance Flux', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
        background: Container(color: const Color(0xFF0247AA)),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)],
      ),
      child: TextField(
        controller: _searchController,
        decoration: const InputDecoration(
          icon: Icon(Icons.search_rounded, color: Color(0xFF94A3B8)),
          hintText: 'Rechercher par ID, nom ou email...',
          hintStyle: TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildOverviewCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0)), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('ANALYTIQUE SYSTÈME', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF94A3B8), letterSpacing: 1.5)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _miniStat('TOTAL', _transactions.length.toString(), const Color(0xFF0247AA)),
              _miniStat('SIGNÉES', _transactions.where((t) => (t['statut'] ?? '').toString().toLowerCase().contains('sign')).length.toString(), const Color(0xFF10B981)),
              _miniStat('FILTRÉES', _filteredTransactions.length.toString(), Colors.orange),
            ],
          ),
        ],
      ),
    );
  }

  Widget _miniStat(String l, String v, Color c) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(l, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
      Text(v, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: c)),
    ]);
  }

  Widget _buildTxCard(dynamic tx) {
    final status = (tx['statut'] ?? '').toString();
    final bool good = status.toLowerCase().contains('sign');
    final bool isRefused = status.toLowerCase().contains('refu') || status.toLowerCase().contains('reje');
    final date = DateTime.tryParse(tx['date_creation'] ?? '') ?? DateTime.now();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isRefused ? Colors.redAccent.withOpacity(0.3) : const Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => TransactionDetailScreen(transactionId: tx['id']))),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('ID #${tx['id'].toString().padLeft(6, '0')}', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: isRefused ? Colors.redAccent : const Color(0xFF0247AA))),
                  _statusBadge(status, good),
                ],
              ),
              const SizedBox(height: 16),
              Text(tx['user_name'] ?? 'Utilisateur', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
              Text(tx['user_email'] ?? '-', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
              const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFF1F5F9))),
              Row(
                children: [
                  const Icon(Icons.alternate_email_rounded, size: 14, color: Color(0xFF94A3B8)),
                  const SizedBox(width: 8),
                  Expanded(child: Text(tx['client_email'] ?? '-', style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)), overflow: TextOverflow.ellipsis)),
                  Text(DateFormat('dd MMM').format(date), style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(String s, bool good) {
    Color c = good ? const Color(0xFF10B981) : const Color(0xFF0247AA);
    if (s.toLowerCase().contains('refu') || s.toLowerCase().contains('reje')) {
      c = Colors.redAccent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }
}
