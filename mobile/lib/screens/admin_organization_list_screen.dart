import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../api_service.dart';

class AdminOrganizationListScreen extends StatefulWidget {
  const AdminOrganizationListScreen({super.key});

  @override
  State<AdminOrganizationListScreen> createState() => _AdminOrganizationListScreenState();
}

class _AdminOrganizationListScreenState extends State<AdminOrganizationListScreen> {
  final ApiService api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  List<dynamic> _orgs = [];
  List<dynamic> _filteredOrgs = [];

  @override
  void initState() {
    super.initState();
    _loadData();
    _searchController.addListener(_filterOrgs);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() => _loading = true);
    try {
      final data = await api.adminGetAllOrganizations();
      if (mounted) {
        setState(() {
          _orgs = data;
          _filteredOrgs = data;
          _loading = false;
        });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _filterOrgs() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredOrgs = _orgs.where((org) {
        final name = (org['name'] ?? '').toString().toLowerCase();
        final owner = (org['owner_email'] ?? '').toString().toLowerCase();
        return name.contains(query) || owner.contains(query);
      }).toList();
    });
  }

  Future<void> _confirmDelete(dynamic org) async {
    final bool? confirm = await showGeneralDialog<bool>(
      context: context,
      pageBuilder: (c, a, b) => Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 40),
          padding: const EdgeInsets.all(28),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFF43F5E), size: 64),
                const SizedBox(height: 16),
                const Text('Démanteler ?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                const SizedBox(height: 8),
                Text('Supprimer définitivement ${org['name']} ?', textAlign: TextAlign.center, style: const TextStyle(color: Color(0xFF64748B))),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(child: TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('ANNULER', style: TextStyle(color: Color(0xFF94A3B8))))),
                    const SizedBox(width: 8),
                    Expanded(child: ElevatedButton(onPressed: () => Navigator.pop(c, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF43F5E), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: const Text('SUPPRIMER', style: TextStyle(color: Colors.white)))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    if (confirm == true) { await api.adminDeleteOrganization(org['id']); _loadData(); }
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
                        const Text('INDEX DES STRUCTURES', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_filteredOrgs.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune organisation trouvée.')))
                        else
                          ..._filteredOrgs.map((org) => _buildOrgCard(org)).toList(),
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
      flexibleSpace: const FlexibleSpaceBar(
        centerTitle: true,
        title: Text('Audit Entités', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
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
          hintText: 'Rechercher une organisation...',
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
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _miniStat('TOTAL AGENCES', _orgs.length.toString(), const Color(0xFF0247AA)),
          _miniStat('FILTRÉES', _filteredOrgs.length.toString(), const Color(0xFF10B981)),
        ],
      ),
    );
  }

  Widget _miniStat(String l, String v, Color c) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
      Text(v, style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: c)),
    ]);
  }

  Widget _buildOrgCard(dynamic org) {
    final date = DateTime.tryParse(org['created_at'] ?? '') ?? DateTime.now();

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Row(
              children: [
                Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF0247AA).withOpacity(0.08), shape: BoxShape.circle), child: const Icon(Icons.business_rounded, size: 20, color: Color(0xFF0247AA))),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(org['name'] ?? 'Entité', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF000000))),
                    Text('Responsable: ${org['owner_email'] ?? '-'}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
                  ]),
                ),
                IconButton(icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFF43F5E), size: 20), onPressed: () => _confirmDelete(org)),
              ],
            ),
            const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: Divider(height: 1, color: Color(0xFFF1F5F9))),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _badge(Icons.people_alt_rounded, '${org['members_count'] ?? 0} Membres'),
                _badge(Icons.calendar_month_rounded, DateFormat('dd MMM yyyy').format(date)),
                _statusPill('VALIDE'),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _badge(IconData i, String t) {
    return Row(children: [
      Icon(i, size: 14, color: const Color(0xFF94A3B8)),
      const SizedBox(width: 8),
      Text(t, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF64748B))),
    ]);
  }

  Widget _statusPill(String s) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s, style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF10B981), letterSpacing: 0.5)),
    );
  }
}
