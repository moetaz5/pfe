import 'package:flutter/material.dart';
import '../api_service.dart';
import 'package:intl/intl.dart';
import '../ui_utils.dart';

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  final ApiService api = ApiService();
  List<dynamic> _notifications = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    if (mounted) setState(() { _loading = true; });
    try {
      final notifs = await api.getNotifications();
      if (mounted) setState(() => _notifications = notifs);
    } catch (e) {
      if (mounted) UiUtils.showError(context, 'Impossible de charger les notifications.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _markRead(int id) async {
    try { 
      await api.markNotificationRead(id); 
      _loadNotifications(); 
    } catch (_) {
      if (mounted) UiUtils.showError(context, 'Erreur lors de la lecture.');
    }
  }

  Future<void> _markAllRead() async {
    try { 
      await api.markAllNotificationsRead(); 
      if (mounted) UiUtils.showSuccess(context, 'Toutes les notifications sont lues.');
      _loadNotifications(); 
    } catch (_) {
      if (mounted) UiUtils.showError(context, 'Échec de l\'opération.');
    }
  }

  Future<void> _delete(int id) async {
    try { 
      await api.deleteNotification(id); 
      _loadNotifications(); 
    } catch (_) {
      if (mounted) UiUtils.showError(context, 'Échec de la suppression.');
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: Color(0xFF0247AA)));
    
    return Column(
      children: [
        if (_notifications.any((n) => n['is_read'] == 0))
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 8, 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Flexible(
                  child: Text(
                    '${_notifications.where((n) => n['is_read'] == 0).length} NOUVEAUTÉS', 
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF94A3B8), letterSpacing: 1),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 4),
                Flexible(
                  child: TextButton.icon(
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    onPressed: _markAllRead,
                    icon: const Icon(Icons.done_all_rounded, size: 14, color: Color(0xFF0247AA)),
                    label: const Text(
                      'Tout marquer comme lu', 
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF0247AA)),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ),
          ),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _loadNotifications,
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              children: [
                if (_notifications.isEmpty) _buildEmptyState()
                else ..._notifications.map((n) => _buildNotificationCard(n)).toList(),
                const SizedBox(height: 40),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 60),
          Container(padding: const EdgeInsets.all(24), decoration: BoxDecoration(color: const Color(0xFFF8FAFC), shape: BoxShape.circle), child: const Icon(Icons.notifications_none_rounded, size: 48, color: Color(0xFF94A3B8))),
          const SizedBox(height: 24),
          const Text('Centre de Alertes Vide', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0247AA))),
          const Text('Aucune nouvelle notification pour le moment.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(dynamic n) {
    final bool isUnread = n['is_read'] == 0;
    final date = DateTime.tryParse(n['created_at'] ?? '');
    final dateStr = date != null ? DateFormat('dd MMM, HH:mm').format(date) : '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isUnread ? const Color(0xFF0247AA).withOpacity(0.04) : Colors.white, 
        borderRadius: BorderRadius.circular(20), 
        border: Border.all(color: isUnread ? const Color(0xFF0247AA).withOpacity(0.1) : const Color(0xFFE2E8F0))
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(20),
        onTap: () { if (isUnread) _markRead(n['id']); },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: (isUnread ? const Color(0xFF0247AA) : const Color(0xFF64748B)).withOpacity(0.1), shape: BoxShape.circle), child: Icon(Icons.notifications_active_rounded, size: 16, color: isUnread ? const Color(0xFF0247AA) : const Color(0xFF64748B))),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(child: Text(n['title'] ?? 'Système', style: TextStyle(fontWeight: isUnread ? FontWeight.w900 : FontWeight.bold, fontSize: 14, color: isUnread ? const Color(0xFF0247AA) : const Color(0xFF1E293B)))),
                        if (isUnread) Container(width: 6, height: 6, decoration: const BoxDecoration(color: Color(0xFF0247AA), shape: BoxShape.circle)),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(n['message'] ?? '', style: const TextStyle(fontSize: 12, color: Color(0xFF64748B), height: 1.4, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 8),
                    Text(dateStr, style: const TextStyle(fontSize: 9, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              IconButton(icon: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF94A3B8)), onPressed: () => _delete(n['id'])),
            ],
          ),
        ),
      ),
    );
  }
}
