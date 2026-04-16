import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'dart:async';
import '../api_service.dart';
import 'dashboard_home.dart';
import 'notifications_screen.dart';
import 'profile_screen.dart';
import 'organization_screen.dart';
import 'transactions_screen.dart';
import 'facture_screen.dart';
import 'buy_tokens_screen.dart';
import 'token_requests_screen.dart';
import 'contact_screen.dart';
import 'token_api_screen.dart';
import 'admin_user_management_screen.dart';
import 'admin_transaction_list_screen.dart';
import 'admin_organization_list_screen.dart';
import 'admin_api_management_screen.dart';
import 'admin_token_requests_screen.dart';
import 'admin_payment_confirmations_screen.dart';
import 'statistics_screen.dart';
import 'create_transaction_redirect_screen.dart';
import '../notification_service.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _user;
  bool _hasOrganization = false;

  String _currentRoute = 'Tableau de bord';

  @override
  void initState() {
    super.initState();
    _loadUser();
    // On peut forcer un rafraîchissement au démarrage du dashboard
    NotificationService.refreshNotifications();
  }

  @override
  void dispose() { super.dispose(); }

  Future<void> _loadUser() async {
    try {
      final user = await api.getCurrentUser();
      bool hasOrg = false;
      if (user['role'] == 'USER') {
        try { final orgs = await api.getMyOrganizations(); hasOrg = orgs.isNotEmpty; } catch (_) {}
      }
      if (mounted) setState(() { _user = user; _hasOrganization = hasOrg; _loading = false; });
    } catch (e) {
      if (e is DioException && e.response?.statusCode == 401) { if (mounted) Navigator.of(context).pushReplacementNamed('/login'); return; }
      if (mounted) setState(() { _error = e.toString(); _loading = false; });
    }
  }

  void _navigateTo(String route) { setState(() => _currentRoute = route); Navigator.of(context).pop(); }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFFF8FAFC), body: Center(child: CircularProgressIndicator()));
    final isUser = _user?['role'] == 'USER';
    final isAdmin = _user?['role'] == 'ADMIN';

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        centerTitle: false,
        backgroundColor: Colors.white,
        elevation: 0,
        title: const Text('MÉDICA-SIGN', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, letterSpacing: 0, color: Color(0xFF0247AA))),
        leading: _currentRoute == 'Tableau de bord' 
            ? Builder(builder: (c) => IconButton(icon: const Icon(Icons.menu_open_rounded, color: Color(0xFF0247AA)), onPressed: () => Scaffold.of(c).openDrawer()))
            : IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0247AA), size: 20), onPressed: () => setState(() => _currentRoute = 'Tableau de bord')),
        actions: [
          if (isUser && _user?['total_jetons'] != null)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: BoxDecoration(
                  color: const Color(0xFF0247AA).withOpacity(0.08),
                  borderRadius: BorderRadius.circular(30),
                  border: Border.all(color: const Color(0xFF0247AA).withOpacity(0.15)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.toll_rounded, size: 14, color: Color(0xFF0247AA)),
                    const SizedBox(width: 6),
                    Text(
                      '${_user?['total_jetons']}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0247AA),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(width: 8),
          ValueListenableBuilder<int>(
            valueListenable: NotificationService.unreadCount,
            builder: (context, count, _) => _badgeBtn(Icons.notifications_none_rounded, count, _showNotificationsOverlay),
          ),
          const SizedBox(width: 8),
          _avatarBtn(),
          const SizedBox(width: 16),
        ],
      ),
      drawer: _buildDrawer(isUser, isAdmin),
      body: AnimatedSwitcher(duration: const Duration(milliseconds: 300), child: _buildBody()),
      bottomNavigationBar: isUser ? _buildUserBottomNav() : null,
    );
  }

  Widget _badgeBtn(IconData i, int count, VoidCallback fn) {
    return Stack(alignment: Alignment.center, children: [
      IconButton(onPressed: fn, icon: Icon(i, color: const Color(0xFF64748B), size: 26)),
      if (count > 0) Positioned(top: 12, right: 12, child: Container(padding: const EdgeInsets.all(4), decoration: const BoxDecoration(color: Color(0xFFF43F5E), shape: BoxShape.circle), child: Text('$count', style: const TextStyle(color: Colors.white, fontSize: 7, fontWeight: FontWeight.w900)))),
    ]);
  }

  Widget _avatarBtn() {
    return InkWell(
      onTap: () => setState(() => _currentRoute = 'Mes informations'),
      borderRadius: BorderRadius.circular(12),
      child: Container(width: 36, height: 36, decoration: BoxDecoration(color: const Color(0xFF0247AA).withOpacity(0.1), borderRadius: BorderRadius.circular(12)), child: Center(child: Text((_user?['name'] ?? 'U')[0].toUpperCase(), style: const TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w900)))),
    );
  }

  Widget _buildDrawer(bool isUser, bool isAdmin) {
    return Drawer(
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.only(topRight: Radius.circular(32), bottomRight: Radius.circular(32))),
      child: Column(
        children: [
          _drawerHeader(),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              children: [
                _tile(Icons.grid_view_rounded, 'Tableau de bord'),
                if (isUser) ...[
                  _section('FLUX DE TRAVAIL'),
                  _tile(Icons.add_task_rounded, 'Création de transaction'),
                  _tile(Icons.dynamic_feed_rounded, 'Mes transactions'),
                  _tile(Icons.receipt_long_rounded, 'Mes factures'),
                  _section('STRUCTURE'),
                  _tile(Icons.business_rounded, _hasOrganization ? 'Détail organisation' : 'Créer une organisation'),
                  _tile(Icons.hub_rounded, 'Transactions organisation'),
                  _section('INFRASTRUCTURE'),
                  _tile(Icons.wallet_rounded, 'Acheter des jetons'),
                  _tile(Icons.history_rounded, 'Historique jetons'),
                  _tile(Icons.mark_chat_read_rounded, 'Contacter'),
                ],
                if (isAdmin) ...[
                  _section('ANALYTIQUE'),
                  _tile(Icons.analytics_rounded, 'Statistiques Globales'),
                  _section('ADMINISTRATION'),
                  _tile(Icons.admin_panel_settings_rounded, 'Gestion Utilisateurs'),
                  _tile(Icons.share_location_rounded, 'Toutes les transactions'),
                  _tile(Icons.corporate_fare_rounded, 'Toutes les organisations'),
                  _section('FINANCE'),
                  _tile(Icons.toll_rounded, 'Demandes de jetons'),
                  _tile(Icons.verified_rounded, 'Confirmations Paiements'),
                ],
              ],
            ),
          ),
          _drawerFooter(),
        ],
      ),
    );
  }

  Widget _drawerHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 60, 24, 32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF0247AA), borderRadius: BorderRadius.circular(16)), child: const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 32)),
          const SizedBox(height: 16),
          Text(_user?['name'] ?? 'Utilisateur', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0247AA), letterSpacing: -0.5)),
          Text(_user?['email'] ?? '-', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  Widget _section(String t) => Padding(padding: const EdgeInsets.only(top: 24, bottom: 8, left: 16), child: Text(t, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: const Color(0xFF94A3B8).withOpacity(0.5), letterSpacing: 1)));

  Widget _tile(IconData i, String r) {
    final bool active = _currentRoute == r;
    return Container(
      margin: const EdgeInsets.only(bottom: 4),
      decoration: BoxDecoration(color: active ? const Color(0xFF0247AA).withOpacity(0.08) : Colors.transparent, borderRadius: BorderRadius.circular(16)),
      child: ListTile(
        leading: Icon(i, color: active ? const Color(0xFF0247AA) : const Color(0xFF64748B), size: 22),
        title: Text(r, style: TextStyle(color: active ? const Color(0xFF0247AA) : const Color(0xFF475569), fontWeight: active ? FontWeight.w900 : FontWeight.w600, fontSize: 13)),
        onTap: () => _navigateTo(r),
      ),
    );
  }

  Widget _drawerFooter() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: ElevatedButton.icon(
        onPressed: () async { await api.logout(); if(!mounted) return; Navigator.of(context).pushReplacementNamed('/login'); },
        icon: const Icon(Icons.logout_rounded, size: 18),
        label: const Text('DÉCONNEXION'),
        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFF1F5F9), foregroundColor: const Color(0xFFF43F5E), elevation: 0, minimumSize: const Size(double.infinity, 56), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
      ),
    );
  }

  int _getNavIndex() {
    if (_currentRoute == 'Tableau de bord') return 0;
    if (_currentRoute == 'Mes transactions') return 1;
    if (_currentRoute == 'Mes factures') return 2;
    if (_currentRoute.contains('jetons') || _currentRoute == 'Confirmer paiement') return 3;
    return 0;
  }

  Widget _buildUserBottomNav() {
    return Container(
      padding: const EdgeInsets.only(bottom: 12, left: 20, right: 20),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF1F5F9)))),
      child: BottomNavigationBar(
        elevation: 0, backgroundColor: Colors.white, type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF0247AA), unselectedItemColor: const Color(0xFF94A3B8),
        selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w900, fontSize: 10),
        unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 10),
        currentIndex: _getNavIndex(),
        onTap: (idx) {
          final routes = ['Tableau de bord', 'Mes transactions', 'Mes factures', 'Acheter des jetons'];
          setState(() => _currentRoute = routes[idx]);
        },
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.grid_view_rounded), label: 'ACCUEIL'),
          BottomNavigationBarItem(icon: Icon(Icons.dynamic_feed_rounded), label: 'JOURNAL'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_rounded), label: 'FACTURES'),
          BottomNavigationBarItem(icon: Icon(Icons.wallet_rounded), label: 'JETONS'),
        ],
      ),
    );
  }

  Widget _buildBody() {
    switch (_currentRoute) {
      case 'Tableau de bord': return DashboardHome(user: _user, onNavigate: (r) => setState(() => _currentRoute = r));
      case 'Mes informations':
      case 'Modifier profil':
      case 'Changer mot de passe':
      case 'Ma signature':
      case 'Certifier mon compte':
        String sub = 'info';
        if (_currentRoute.contains('Modifier')) sub = 'edit';
        if (_currentRoute.contains('mot de passe')) sub = 'password';
        if (_currentRoute.contains('signature')) sub = 'signature';
        if (_currentRoute.contains('Certifier')) sub = 'certification';
        return ProfileScreen(user: _user, subPage: sub, onNavigate: (r) => setState(() => _currentRoute = r));
      case 'Création de transaction': return const CreateTransactionRedirectScreen();
      case 'Créer une organisation':
      case 'Détail organisation': return OrganizationScreen(user: _user, subPage: 'create');
      case 'Transactions organisation': return OrganizationScreen(user: _user, subPage: 'transactions');
      case 'Mes transactions': return TransactionsScreen(onNavigate: (r) => setState(() => _currentRoute = r));
      case 'Mes factures': return const FactureScreen();
      case 'Contacter': return const ContactScreen();
      case 'Acheter des jetons': return BuyTokensScreen(user: _user, subPage: 'buy', onNavigate: (r) => setState(() => _currentRoute = r));
      case 'Confirmer paiement': return BuyTokensScreen(user: _user, subPage: 'proof', onNavigate: (r) => setState(() => _currentRoute = r));
      case 'Historique jetons': return BuyTokensScreen(user: _user, subPage: 'history', onNavigate: (r) => setState(() => _currentRoute = r));
      case 'Statistiques Globales': return StatisticsScreen(user: _user);
      case 'Gestion Utilisateurs': return const AdminUserManagementScreen();
      case 'Toutes les transactions': return const AdminTransactionListScreen();
      case 'Toutes les organisations': return const AdminOrganizationListScreen();
      case 'Demandes de jetons': return const AdminTokenRequestsScreen();
      case 'Confirmations Paiements': return const AdminPaymentConfirmationsScreen();
      default: return Center(child: Text(_currentRoute));
    }
  }

  void _showNotificationsOverlay() {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'NOTIFICATIONS',
      transitionDuration: const Duration(milliseconds: 200),
      pageBuilder: (c, a, b) => Align(
        alignment: Alignment.topRight,
        child: Container(
          width: MediaQuery.of(c).size.width * 0.85,
          margin: const EdgeInsets.only(top: 80, right: 20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 30, offset: const Offset(0, 10))],
          ),
          child: Material(
            color: Colors.transparent,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: Color(0xFFF1F5F9)))),
                  child: Row(
                    children: [
                      const Icon(Icons.notifications_active_rounded, color: Color(0xFF0247AA), size: 18),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Text(
                          'NOTIFICATIONS', 
                          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1, color: Color(0xFF0247AA)),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      TextButton(onPressed: () => Navigator.pop(c), child: const Text('FERMER', style: TextStyle(fontSize: 10))),
                    ],
                  ),
                ),
                Flexible(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(maxHeight: MediaQuery.of(c).size.height * 0.5),
                    child: const NotificationsScreen(),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
