import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../api_service.dart';

class TokenApiScreen extends StatefulWidget {
  const TokenApiScreen({super.key});

  @override
  State<TokenApiScreen> createState() => _TokenApiScreenState();
}

class _TokenApiScreenState extends State<TokenApiScreen> {
  final ApiService api = ApiService();
  String? _token;
  bool _loading = true;
  bool _actionLoading = false;

  @override
  void initState() {
    super.initState();
    _loadToken();
  }

  Future<void> _loadToken() async {
    try {
      final token = await api.getApiToken();
      if (token != null) {
        if (mounted) setState(() { _token = token; _loading = false; });
      } else {
        final newToken = await api.generateApiToken();
        if (mounted) setState(() { _token = newToken; _loading = false; });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _regenerateToken() async {
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
                const Icon(Icons.warning_amber_rounded, color: Colors.orange, size: 64),
                const SizedBox(height: 16),
                const Text('Régénérer ?', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0F172A))),
                const SizedBox(height: 8),
                const Text('L\'ancien token API sera instantanément révoqué.', textAlign: TextAlign.center, style: TextStyle(color: Color(0xFF64748B))),
                const SizedBox(height: 32),
                Row(
                  children: [
                    Expanded(child: TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('ANNULER', style: TextStyle(color: Color(0xFF94A3B8))))),
                    const SizedBox(width: 8),
                    Expanded(child: ElevatedButton(onPressed: () => Navigator.pop(c, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF2563EB), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: const Text('CONFIRMER', style: TextStyle(color: Colors.white)))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );

    if (confirm != true) return;
    setState(() => _actionLoading = true);
    try {
      final newToken = await api.regenerateApiToken();
      if (mounted) { setState(() { _token = newToken; _actionLoading = false; }); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('✅ Nouveau token généré.'))); }
    } catch (_) { if (mounted) { setState(() => _actionLoading = false); ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('❌ Échec.'))); } }
  }

  void _copyToken() {
    if (_token == null) return;
    Clipboard.setData(ClipboardData(text: _token!));
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('📋 Copié dans le presse-papier.')));
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    return Container(
      color: const Color(0xFFF8FAFC),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: [
          _buildHeader(),
          const SizedBox(height: 32),
          _buildTerminalCard(),
          const SizedBox(height: 24),
          _buildSecurityInfo(),
          const SizedBox(height: 80),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Console API', style: TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0F172A), letterSpacing: -1)),
              Text('Infrastructure d\'accès programmatique.', style: TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
            ]),
            IconButton(icon: const Icon(Icons.refresh_rounded, color: Color(0xFF2563EB)), onPressed: _actionLoading ? null : _regenerateToken),
          ],
        ),
      ],
    );
  }

  Widget _buildTerminalCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: const Color(0xFF000000), borderRadius: BorderRadius.circular(32), boxShadow: [BoxShadow(color: const Color(0xFF000000).withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 10))]),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(children: [
            Icon(Icons.terminal_rounded, color: Color(0xFF0247AA), size: 18),
            SizedBox(width: 12),
            Text('JETON D\'ACCÈS PRIVÉ', style: TextStyle(color: Colors.white, fontSize: 10, letterSpacing: 1.5, fontWeight: FontWeight.w900)),
          ]),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(20), border: Border.all(color: Colors.white.withOpacity(0.1))),
            child: SelectableText(_token ?? 'Génération...', style: const TextStyle(color: Colors.white70, fontFamily: 'monospace', fontSize: 13, height: 1.5)),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _copyToken,
              icon: const Icon(Icons.copy_rounded, size: 18),
              label: const Text('COPIER LE TOKEN', style: TextStyle(fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecurityInfo() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('CONSIGNES DE SÉCURITÉ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF94A3B8), letterSpacing: 1.5)),
          const SizedBox(height: 16),
          _bullet('Utilisez ce token uniquement dans des environnements serveurs.'),
          _bullet('Ne l\'exposez jamais dans le code source client (JS/HTML).'),
          _bullet('Régénérez-le si vous soupçonnez une fuite de données.'),
        ],
      ),
    );
  }

  static Widget _bullet(String t) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Icon(Icons.verified_user_rounded, size: 14, color: Color(0xFF2563EB)),
        const SizedBox(width: 12),
        Expanded(child: Text(t, style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), fontWeight: FontWeight.w500))),
      ]),
    );
  }
}
