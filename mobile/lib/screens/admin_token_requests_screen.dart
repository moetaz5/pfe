import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api_service.dart';

class AdminTokenRequestsScreen extends StatefulWidget {
  const AdminTokenRequestsScreen({super.key});

  @override
  State<AdminTokenRequestsScreen> createState() => _AdminTokenRequestsScreenState();
}

class _AdminTokenRequestsScreenState extends State<AdminTokenRequestsScreen> {
  final ApiService api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  List<dynamic> _requests = [];
  List<dynamic> _filteredRequests = [];
  String _statusFilter = 'all';

  @override
  void initState() {
    super.initState();
    _loadData();
    _searchController.addListener(_filterRequests);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final status = _statusFilter == 'all' ? null : _statusFilter;
      final data = await api.adminGetTokenRequests(status: status);
      if (mounted) {
        setState(() {
          _requests = data;
          _filteredRequests = data;
          _loading = false;
        });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _filterRequests() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredRequests = _requests.where((req) {
        final userName = (req['user_name'] ?? '').toString().toLowerCase();
        final packName = (req['pack_name'] ?? '').toString().toLowerCase();
        final id = req['id'].toString().toLowerCase();
        return userName.contains(query) || packName.contains(query) || id.contains(query);
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
                        const SizedBox(height: 16),
                        _buildFilterBar(),
                        const SizedBox(height: 32),
                        const Text('HISTORIQUE DES SOUSCRIPTIONS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_filteredRequests.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune demande trouvée.')))
                        else
                          ..._filteredRequests.map((req) => _buildRequestCard(req)).toList(),
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
      expandedHeight: 120, pinned: true, backgroundColor: const Color(0xFF0247AA),
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        title: const Text('Supervision des Jetons', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
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
          hintText: 'Rechercher par utilisateur ou pack...',
          hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildFilterBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _statusFilter, isExpanded: true,
          style: const TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w900, fontSize: 12),
          items: const [
            DropdownMenuItem(value: 'all', child: Text('FILTRER PAR STATUT : TOUTES')),
            DropdownMenuItem(value: 'pending', child: Text('EN ATTENTE DE CONFIRMATION')),
            DropdownMenuItem(value: 'payment_pending', child: Text('ATTENTE PREUVE CLIENT')),
            DropdownMenuItem(value: 'approved', child: Text('APPROUVÉES')),
            DropdownMenuItem(value: 'rejected', child: Text('REJETÉES')),
          ],
          onChanged: (v) { setState(() => _statusFilter = v!); _loadData(); },
        ),
      ),
    );
  }

  Widget _buildRequestCard(dynamic req) {
    final status = req['status'] ?? '';
    final bool isActionable = status == 'pending';
    final date = DateTime.tryParse(req['created_at'] ?? '');
    final dateStr = date != null ? DateFormat('dd MMM, HH:mm').format(date) : '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFF59E0B).withOpacity(0.08), shape: BoxShape.circle), child: const Icon(Icons.toll_rounded, size: 20, color: Color(0xFFF59E0B))),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(req['pack_name'] ?? 'Pack Jetons', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
                    Text('Initié par: ${req['user_name']}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
                  ]),
                ),
                _statusBadge(status),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(color: Color(0xFFF8FAFC), borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
            child: Column(
              children: [
                _data('VOLUME DE JETONS', '${req['tokens']} UN'),
                _data('MONTANT TND', '${req['price_tnd']} TND'),
                _data('SOLDE UTILISATEUR', '${req['user_tokens_balance'] ?? 0} JETONS'),
                const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(dateStr, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                    if (isActionable) Row(children: [
                      IconButton(icon: const Icon(Icons.close_rounded, color: Color(0xFFF43F5E), size: 18), onPressed: () => _handleDecision(req, 'rejected')),
                      const SizedBox(width: 8),
                      ElevatedButton(onPressed: () => _handleDecision(req, 'payment_pending'), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))), child: const Text('CONFIRMER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
                    ]),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _data(String l, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(l, style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontWeight: FontWeight.w900, letterSpacing: 0.5)),
        Text(v, style: const TextStyle(fontSize: 11, color: Color(0xFF1E293B), fontWeight: FontWeight.w900)),
      ]),
    );
  }

  Widget _statusBadge(String s) {
    Color c;
    switch (s) {
      case 'pending': c = Colors.orange; break;
      case 'payment_pending': c = Colors.blue; break;
      case 'approved': c = const Color(0xFF10B981); break;
      case 'rejected': c = const Color(0xFFF43F5E); break;
      default: c = Colors.blueGrey;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }

  Future<void> _handleDecision(dynamic req, String status) async {
    setState(() => _loading = true);
    try { await api.adminTokenDecision(req['id'], status, note: "Traitée par l'admin"); _loadData(); }
    catch (_) { if (mounted) setState(() => _loading = false); }
  }
}
