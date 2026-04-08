import 'package:flutter/material.dart';
import '../api_service.dart';

class DashboardHome extends StatefulWidget {
  final Map<String, dynamic>? user;
  final Function(String)? onNavigate;
  const DashboardHome({super.key, this.user, this.onNavigate});

  @override
  State<DashboardHome> createState() => _DashboardHomeState();
}

class _DashboardHomeState extends State<DashboardHome> {
  final ApiService api = ApiService();
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _stats;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    setState(() { _loading = true; _error = null; });
    try {
      final stats = await api.getDashboardStats();
      if (mounted) setState(() { _stats = stats; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString().replaceFirst('Exception: ', ''); });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator());
    
    final name = widget.user?['name'] ?? 'Utilisateur';
    final isAdmin = widget.user?['role'] == 'ADMIN';

    return RefreshIndicator(
      onRefresh: _loadStats,
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildWelcomeHeader(name, isAdmin),
            const SizedBox(height: 28),
            _buildQuickActions(isAdmin),
            const SizedBox(height: 32),
            _buildSectionTitle(isAdmin ? 'SITUATION GLOBALE' : 'VUE D\'ENSEMBLE', () => widget.onNavigate?.call('Statistiques Globales')),
            const SizedBox(height: 16),
            _buildStatGrid(isAdmin),
            const SizedBox(height: 32),
            _buildSectionTitle('MON PROFIL SÉCURISÉ', () => widget.onNavigate?.call('Mes informations')),
            const SizedBox(height: 16),
            _buildUserInfoCard(),
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  Widget _buildWelcomeHeader(String name, bool isAdmin) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(isAdmin ? 'Administrateur, ' : 'Bonjour, ', style: const TextStyle(fontSize: 16, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
            Text(name.split(' ')[0], style: const TextStyle(fontSize: 16, color: Color(0xFF0247AA), fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 4),
        Text(isAdmin ? 'Centre de Contrôle' : 'Plateforme Signature', style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1)),
      ],
    );
  }

  Widget _buildQuickActions(bool isAdmin) {
    return SizedBox(
      height: 110,
      child: ListView(
        scrollDirection: Axis.horizontal,
        clipBehavior: Clip.none,
        children: isAdmin ? [
          _quickActionItem(Icons.people_alt_rounded, 'Utilisateurs', const Color(0xFF0247AA), () => widget.onNavigate?.call('Gestion Utilisateurs')),
          _quickActionItem(Icons.corporate_fare_rounded, 'Organisations', const Color(0xFF10B981), () => widget.onNavigate?.call('Toutes les organisations')),
          _quickActionItem(Icons.receipt_long_rounded, 'Transactions', const Color(0xFF8B5CF6), () => widget.onNavigate?.call('Toutes les transactions')),
          _quickActionItem(Icons.toll_rounded, 'Flux Jetons', const Color(0xFFF59E0B), () => widget.onNavigate?.call('Demandes de jetons')),
        ] : [
          _quickActionItem(Icons.add_circle_rounded, 'Nouvelle\nTransaction', const Color(0xFF0247AA), () => widget.onNavigate?.call('Création de transaction')),
          _quickActionItem(Icons.toll_rounded, 'Acheter\nJetons', const Color(0xFFF59E0B), () => widget.onNavigate?.call('Acheter des jetons')),
          _quickActionItem(Icons.verified_user_rounded, 'Certifier\nCompte', const Color(0xFF10B981), () => widget.onNavigate?.call('Certifier mon compte')),
          _quickActionItem(Icons.support_agent_rounded, 'Support\nClient', const Color(0xFF8B5CF6), () => widget.onNavigate?.call('Contacter')),
        ],
      ),
    );
  }

  Widget _quickActionItem(IconData icon, String label, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        width: 100,
        margin: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 10),
            Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF475569), height: 1.2)),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
          const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFF94A3B8)),
        ],
      ),
    );
  }

  Widget _buildStatGrid(bool isAdmin) {
    final total = _stats?['transactions'] ?? 0;
    final signatures = _stats?['signatures'] ?? 0;
    final factures = _stats?['factures'] ?? 0;
    final totalJetons = _stats?['totalJetons'] ?? 0;
    final organizationsCount = _stats?['organizations'] ?? 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 1.3,
      children: [
        _statCard(isAdmin ? 'JETONS CIRCULANTS' : 'SOLDE JETONS', totalJetons.toString(), const Color(0xFF0247AA), Icons.toll_rounded),
        _statCard(isAdmin ? 'TOTAL ORGANISATIONS' : 'FLUX SIGNATURES', (isAdmin ? organizationsCount : total).toString(), const Color(0xFF10B981), (isAdmin ? Icons.business_rounded : Icons.swap_horiz_rounded)),
        _statCard(isAdmin ? 'UTILISATEURS ACTIFS' : 'SIGNATURES APP', signatures.toString(), const Color(0xFF8B5CF6), (isAdmin ? Icons.people_rounded : Icons.draw_rounded)),
        _statCard(isAdmin ? 'TRANSACTIONS TOTALES' : 'MES FACTURES', (isAdmin ? total : factures).toString(), const Color(0xFFEF4444), (isAdmin ? Icons.sync_alt_rounded : Icons.receipt_long_rounded)),
      ],
    );
  }

  Widget _statCard(String label, String value, Color color, IconData icon) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text(value, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
                ),
              ),
              const SizedBox(width: 8),
              Icon(icon, color: color, size: 20),
            ],
          ),
          const Spacer(),
          Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: Color(0xFF64748B), letterSpacing: 0.5)),
        ],
      ),
    );
  }

  Widget _buildUserInfoCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20)],
      ),
      child: Column(
        children: [
          _userInfoRow(Icons.alternate_email_rounded, 'Identité de connexion', widget.user?['email'] ?? '-'),
          const Divider(height: 32, color: Color(0xFFF1F5F9)),
          _userInfoRow(Icons.security_rounded, 'Privilèges Système', widget.user?['role'] ?? 'USER'),
          const Divider(height: 32, color: Color(0xFFF1F5F9)),
          _userInfoRow(Icons.shield_rounded, 'État Certification', widget.user?['is_certified'] == 1 ? 'ENTITÉ VÉRIFIÉE' : 'STANDARD'),
        ],
      ),
    );
  }

  Widget _userInfoRow(IconData icon, String label, String value) {
    return Row(
      children: [
        Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)), child: Icon(icon, size: 18, color: const Color(0xFF64748B))),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
            Text(value, style: const TextStyle(fontSize: 14, color: Color(0xFF1E293B), fontWeight: FontWeight.w700)),
          ],
        ),
      ],
    );
  }
}
