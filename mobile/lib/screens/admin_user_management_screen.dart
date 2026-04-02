import 'package:flutter/material.dart';
import '../api_service.dart';
import '../ui_utils.dart';

class AdminUserManagementScreen extends StatefulWidget {
  const AdminUserManagementScreen({super.key});

  @override
  State<AdminUserManagementScreen> createState() => _AdminUserManagementScreenState();
}

class _AdminUserManagementScreenState extends State<AdminUserManagementScreen> {
  final ApiService api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  List<dynamic> _users = [];
  List<dynamic> _filteredUsers = [];

  @override
  void initState() {
    super.initState();
    _loadUsers();
    _searchController.addListener(_filterUsers);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadUsers() async {
    setState(() => _loading = true);
    try {
      final users = await api.adminGetUsers();
      if (mounted) {
        setState(() {
          _users = users;
          _filteredUsers = users;
          _loading = false;
        });
      }
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _filterUsers() {
    final query = _searchController.text.toLowerCase();
    setState(() {
      _filteredUsers = _users.where((u) {
        final name = (u['name'] ?? '').toString().toLowerCase();
        final email = (u['email'] ?? '').toString().toLowerCase();
        return name.contains(query) || email.contains(query);
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
              onRefresh: _loadUsers,
              child: CustomScrollView(
                slivers: [
                  _buildSliverHeader(),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        _buildSearchBar(),
                        const SizedBox(height: 32),
                        const Text('ANNUAIRE DES UTILISATEURS', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_filteredUsers.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucun utilisateur trouvé.')))
                        else
                          ..._filteredUsers.map((u) => _buildUserCard(u)).toList(),
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
        title: const Text('Sécurité & Accès', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
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
          hintText: 'Rechercher un membre par nom ou email...',
          hintStyle: TextStyle(fontSize: 14, color: Color(0xFF94A3B8)),
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildUserCard(dynamic user) {
    final bool isActive = (user['status'] ?? user['statut']) == 1;
    final String role = user['role'] ?? 'USER';
    final bool isAdmin = role == 'ADMIN';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: ExpansionTile(
        tilePadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        leading: CircleAvatar(
          backgroundColor: (isAdmin ? const Color(0xFFF43F5E) : const Color(0xFF0247AA)).withOpacity(0.1),
          child: Text(user['name']?.substring(0, 1).toUpperCase() ?? 'U', style: TextStyle(color: isAdmin ? const Color(0xFFF43F5E) : const Color(0xFF0247AA), fontWeight: FontWeight.bold))
        ),
        title: Text(user['name'] ?? 'Utilisateur', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
        subtitle: Text(user['email'] ?? '-', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
        trailing: _statusBadge(isActive),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: const BoxDecoration(color: Color(0xFFF8FAFC), borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _action(Icons.shield_outlined, 'RÔLE $role', () {}),
                _action(isActive ? Icons.block_flipped : Icons.check_circle_outline_rounded, isActive ? 'BLOQUER' : 'ACTIVER', () async { 
                  setState(() => _loading = true); 
                  try {
                    await api.adminUpdateUserStatus(user['id'], !isActive);
                    if (mounted) UiUtils.showSuccess(context, 'Statut de ${user['name']} mis à jour.');
                    _loadUsers(); 
                  } catch(_) {
                    if (mounted) UiUtils.showError(context, 'Impossible de modifier le statut.');
                    setState(() => _loading = false);
                  }
                }, danger: isActive),
                _action(Icons.delete_outline_rounded, 'SUPPRIMER', () {
                   UiUtils.showInfo(context, 'Suppression non implémentée pour la sécurité.');
                }, danger: true),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _action(IconData i, String l, VoidCallback fn, {bool danger = false}) {
    return InkWell(
      onTap: fn,
      child: Column(
        children: [
          Icon(i, size: 20, color: danger ? const Color(0xFFF43F5E) : const Color(0xFF64748B)),
          const SizedBox(height: 6),
          Text(l, style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: danger ? const Color(0xFFF43F5E) : const Color(0xFF94A3B8), letterSpacing: 0.5)),
        ],
      ),
    );
  }

  Widget _statusBadge(bool active) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: (active ? const Color(0xFF10B981) : const Color(0xFFF43F5E)).withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(active ? 'ACTIF' : 'SUSPENDU', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: active ? const Color(0xFF10B981) : const Color(0xFFF43F5E), letterSpacing: 0.5)),
    );
  }
}
