import 'package:flutter/material.dart';
import '../api_service.dart';
import 'package:intl/intl.dart';
import 'transaction_detail_screen.dart';

class TransactionsScreen extends StatefulWidget {
  final Function(String)? onNavigate;
  const TransactionsScreen({super.key, this.onNavigate});

  @override
  State<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends State<TransactionsScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  List<dynamic> _transactions = [];
  String _statusFilter = '';
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadTransactions();
  }

  Future<void> _loadTransactions() async {
    setState(() => _loading = true);
    try {
      final res = await api.getMyTransactions();
      if (mounted) setState(() { _transactions = res; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _deleteTransaction(int id) async {
    final bool? confirm = await showGeneralDialog<bool>(
      context: context,
      pageBuilder: (c, a, b) => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 40),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 64),
                const SizedBox(height: 16),
                const Text('Supprimer ?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
                const SizedBox(height: 8),
                const Text('Cette action est irréversible pour ce flux.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B))),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(child: TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Garder', style: TextStyle(color: Color(0xFF64748B))))),
                    const SizedBox(width: 8),
                    Expanded(child: ElevatedButton(onPressed: () => Navigator.pop(c, true), style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: const Text('Supprimer', style: TextStyle(color: Colors.white)))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (confirm == true) {
      try { await api.deleteTransaction(id); _loadTransactions(); } catch (_) {}
    }
  }

  List<dynamic> get _filteredTransactions {
    return _transactions.where((t) {
      final matchStatus = _statusFilter.isEmpty || t['statut'] == _statusFilter;
      final matchSearch = _searchController.text.isEmpty || (t['id'].toString()).contains(_searchController.text);
      return matchStatus && matchSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _loading 
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadTransactions,
              child: CustomScrollView(
                slivers: [
                  _buildSliverAppBar(),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        _buildFilterSearch(),
                        const SizedBox(height: 32),
                        const Text('TOUTES LES OPÉRATIONS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_filteredTransactions.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune transaction.')))
                        else
                          ..._filteredTransactions.map((t) => _buildTxCard(t)).toList(),
                        const SizedBox(height: 80),
                      ]),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildSliverAppBar() {
    return SliverAppBar(
      expandedHeight: 120,
      floating: false,
      pinned: true,
      backgroundColor: const Color(0xFF0247AA),
      elevation: 0,
      automaticallyImplyLeading: false,
      flexibleSpace: const FlexibleSpaceBar(
        centerTitle: true,
        title: Text('Journal Transactions', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -1)),
      ),
      actions: [
        Padding(
          padding: const EdgeInsets.only(right: 16),
          child: IconButton(
            icon: const Icon(Icons.add_circle_rounded, color: Colors.white, size: 32),
            onPressed: () => widget.onNavigate?.call('Création de transaction'),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterSearch() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(28), border: Border.all(color: const Color(0xFFE2E8F0)), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)]),
      child: Column(
        children: [
          TextField(
            controller: _searchController,
            onChanged: (v) => setState(() {}),
            decoration: InputDecoration(
               prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF94A3B8)),
               hintText: 'Rechercher par ID...',
               filled: true, fillColor: const Color(0xFFF8FAFC),
               border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
               enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
               contentPadding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _statusChip('TOUT', ''),
                _statusChip('SIGNÉ', 'signée_ttn'),
                _statusChip('CRÉÉ', 'créé'),
                _statusChip('BROUILLON', 'brouillon'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusChip(String label, String val) {
    final bool active = _statusFilter == val;
    return GestureDetector(
      onTap: () => setState(() => _statusFilter = val),
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(color: active ? const Color(0xFF0247AA) : const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(12)),
        child: Text(label, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: active ? Colors.white : const Color(0xFF64748B), letterSpacing: 0.5)),
      ),
    );
  }

  Widget _buildTxCard(dynamic t) {
    final statusRaw = t['statut']?.toString() ?? 'Inconnu';
    final status = statusRaw.toLowerCase();
    final bool isSigned = status.contains('sign');
    final bool isRefused = status.contains('refu') || status.contains('reje');
    final Color cardColor = isSigned
        ? const Color(0xFF10B981)
        : isRefused
            ? Colors.redAccent
            : const Color(0xFF0247AA);
    final date = DateTime.tryParse(t['date_creation'] ?? '');
    final dateStr = date != null ? DateFormat('dd MMM, yyyy').format(date) : '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isRefused ? Colors.redAccent.withOpacity(0.3) : const Color(0xFFE2E8F0)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(24),
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (context) => TransactionDetailScreen(transactionId: t['id']))),
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: cardColor.withOpacity(0.08), shape: BoxShape.circle),
                    child: Icon(
                      isSigned ? Icons.verified_rounded : isRefused ? Icons.cancel_rounded : Icons.history_rounded,
                      size: 20,
                      color: cardColor,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(
                        t['objet'] ?? 'Transaction', 
                        style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0247AA), letterSpacing: -0.2),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      ),
                      Text(
                        'Séquence #${t['id']}', 
                        style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ]),
                  ),
                  const SizedBox(width: 8),
                  _statusBadge(statusRaw),
                ],
              ),
              const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: Color(0xFFF1F5F9))),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(child: _badge(Icons.corporate_fare_rounded, t['nom_organisation'] ?? 'Individuel')),
                  const SizedBox(width: 8),
                  _badge(Icons.calendar_month_rounded, dateStr),
                  const SizedBox(width: 8),
                  const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFFCBD5E1)),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _badge(IconData i, String t) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(i, size: 14, color: const Color(0xFF94A3B8)),
        const SizedBox(width: 6),
        Flexible(
          child: Text(
            t, 
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF475569)),
            overflow: TextOverflow.ellipsis,
            maxLines: 1,
          ),
        ),
      ],
    );
  }

  Widget _statusBadge(String s) {
    bool good = s.toLowerCase().contains('sign') || s.toLowerCase().contains('fini');
    Color c = good ? const Color(0xFF10B981) : const Color(0xFF0247AA);
    if (s.toLowerCase().contains('refu') || s.toLowerCase().contains('reje')) {
      c = Colors.redAccent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }
}
