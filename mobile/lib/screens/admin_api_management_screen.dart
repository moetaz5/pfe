import 'package:flutter/material.dart';
import '../api_service.dart';

class AdminApiManagementScreen extends StatefulWidget {
  const AdminApiManagementScreen({super.key});

  @override
  State<AdminApiManagementScreen> createState() => _AdminApiManagementScreenState();
}

class _AdminApiManagementScreenState extends State<AdminApiManagementScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  List<dynamic> _routes = [];

  @override
  void initState() {
    super.initState();
    _loadRoutes();
  }

  Future<void> _loadRoutes() async {
    setState(() => _loading = true);
    try {
      final routes = await api.adminGetRoutes();
      if (mounted) setState(() { _routes = routes; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _loading 
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadRoutes,
              child: CustomScrollView(
                slivers: [
                  _buildSliverHeader(),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        _buildProtocolOverview(),
                        const SizedBox(height: 32),
                        const Text('INDEX DES ENDPOINTS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_routes.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune route système.')))
                        else
                          ..._routes.map((r) => _buildRouteCard(r)).toList(),
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
      backgroundColor: const Color(0xFF0F172A),
      flexibleSpace: const FlexibleSpaceBar(
        centerTitle: true,
        title: Text('Sécurité API', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
      ),
    );
  }

  Widget _buildProtocolOverview() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0)), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)]),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _miniStat('TOTAL ROUTES', _routes.length.toString(), Colors.blue),
          _miniStat('SÉCURITÉ', 'JWT/TLS', const Color(0xFF10B981)),
          _miniStat('LATENCE', 'OPTIMAL', Colors.orange),
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

  Widget _buildRouteCard(dynamic r) {
    final List<dynamic> methods = r['methods'] ?? [];
    final String path = r['path'] ?? '/';
    final String role = r['role'] ?? 'Non défini';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        leading: Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: const Color(0xFFF1F5F9), shape: BoxShape.circle), child: const Icon(Icons.hub_rounded, size: 18, color: Color(0xFF64748B))),
        title: Text(path, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, color: Color(0xFF0F172A))),
        subtitle: Row(
          children: [
            const Icon(Icons.verified_user_rounded, size: 12, color: Color(0xFF94A3B8)),
            const SizedBox(width: 6),
            Text(role, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
          ],
        ),
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            alignment: Alignment.centerLeft,
            child: Wrap(
              spacing: 8,
              children: methods.map<Widget>((m) => _methodBadge(m.toString())).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _methodBadge(String m) {
    Color c;
    switch (m.toUpperCase()) {
      case 'GET': c = const Color(0xFF10B981); break;
      case 'POST': c = const Color(0xFF0247AA); break;
      case 'PUT': c = Colors.orange; break;
      case 'DELETE': c = const Color(0xFFF43F5E); break;
      default: c = const Color(0xFF64748B);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(m.toUpperCase(), style: TextStyle(color: c, fontWeight: FontWeight.w900, fontSize: 8, letterSpacing: 0.5)),
    );
  }
}
