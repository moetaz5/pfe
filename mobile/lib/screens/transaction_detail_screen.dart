import 'package:flutter/material.dart';
import '../api_service.dart';
import 'package:intl/intl.dart';

class TransactionDetailScreen extends StatefulWidget {
  final int transactionId;
  const TransactionDetailScreen({super.key, required this.transactionId});

  @override
  State<TransactionDetailScreen> createState() => _TransactionDetailScreenState();
}

class _TransactionDetailScreenState extends State<TransactionDetailScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  Map<String, dynamic>? _transaction;
  List<dynamic> _documents = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    try {
      final tx = await api.getTransactionDetails(widget.transactionId);
      final docs = await api.getTransactionDocs(widget.transactionId);
      if (mounted) setState(() { _transaction = tx; _documents = docs; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _handleResend() async {
    setState(() => _loadingAction = true);
    try {
      await api.resendToTTN(widget.transactionId);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Transaction renvoyée avec succès au TTN')),
        );
        _fetchData();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Erreur: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _loadingAction = false);
    }
  }

  bool _loadingAction = false;

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Scaffold(backgroundColor: Color(0xFFF8FAFC), body: Center(child: CircularProgressIndicator()));
    if (_transaction == null) return const Scaffold(body: Center(child: Text('Transaction introuvable.')));

    final status = _transaction!['statut']?.toString().toLowerCase() ?? '';
    final bool good = status.contains('sign');

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: CustomScrollView(
        slivers: [
          _buildSliverAppBar(status, good),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
            sliver: SliverList(
              delegate: SliverChildListDelegate([
                _buildMainInfo(status, good),
                const SizedBox(height: 32),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  const Text('DOCUMENTS ASSOCIÉS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                  Text('${_documents.length} FICHIERS', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF2563EB))),
                ]),
                const SizedBox(height: 16),
                if (_documents.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(40),
                    decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
                    child: const Column(children: [
                      Icon(Icons.folder_off_rounded, size: 48, color: Color(0xFFCBD5E1)),
                      SizedBox(height: 16),
                      Text('Aucun document rattaché', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
                    ]),
                  )
                else
                  ..._documents.map((doc) => _buildDocCard(doc)).toList(),
                const SizedBox(height: 80),
              ]),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSliverAppBar(String status, bool good) {
    return SliverAppBar(
      expandedHeight: 140,
      pinned: true,
      backgroundColor: const Color(0xFF0F172A),
      leading: IconButton(icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20), onPressed: () => Navigator.pop(context)),
      flexibleSpace: FlexibleSpaceBar(
        titlePadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        title: Column(
          mainAxisAlignment: MainAxisAlignment.end,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Détails Flux', style: TextStyle(color: Colors.white60, fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1)),
            Text('TRX-#${widget.transactionId}', style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
          ],
        ),
        background: Container(color: const Color(0xFF0F172A)),
      ),
    );
  }

  Widget _buildMainInfo(String status, bool good) {
    final date = DateTime.tryParse(_transaction!['date_creation'] ?? '');
    final dateStr = date != null ? DateFormat('dd MMM, yyyy HH:mm').format(date) : '-';

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
               Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                 const Text('ÉMETTEUR', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF94A3B8), letterSpacing: 1)),
                 Text(_transaction!['user_name'] ?? 'Système', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: Color(0xFF000000))),
               ]),
               _statusBadge(status, good),
            ],
          ),
          const Padding(padding: EdgeInsets.symmetric(vertical: 20), child: Divider(height: 1, color: Color(0xFFF1F5F9))),
          _infoRow(Icons.calendar_month_rounded, 'Date création', dateStr),
          _infoRow(Icons.fingerprint_rounded, 'Certification', good ? 'Signé Numériquement' : 'En attente TTN'),
          _infoRow(Icons.account_tree_outlined, 'Type Flux', 'Workflow Signature Standard'),
          if (status.contains('refus') || status.contains('rejet'))
             _buildResendButton(),
        ],
      ),
    );
  }

  Widget _infoRow(IconData i, String l, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(children: [
        Icon(i, size: 16, color: const Color(0xFF64748B)),
        const SizedBox(width: 12),
        Text('$l :', style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
        const SizedBox(width: 6),
        Text(v, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900, color: Color(0xFF1E293B))),
      ]),
    );
  }

  Widget _buildResendButton() {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 24),
      child: ElevatedButton.icon(
        onPressed: _loadingAction ? null : _handleResend,
        icon: _loadingAction 
          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
          : const Icon(Icons.sync_rounded),
        label: const Text('RENVOYER AU TTN', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1)),
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF2563EB),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        ),
      ),
    );
  }

  Widget _buildDocCard(dynamic d) {
    final bool docGood = (d['statut_doc']?.toString() ?? '').toLowerCase().contains('sign') || (d['statut_doc']?.toString() ?? '').toLowerCase().contains('arch');
    final color = docGood ? const Color(0xFF10B981) : Colors.blue;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: color.withOpacity(0.08), shape: BoxShape.circle), child: Icon(docGood ? Icons.verified_rounded : Icons.description_rounded, size: 20, color: color)),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(d['nom_document'] ?? 'Document', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F172A))),
            Text('ID: ${d['id']}', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
          ])),
          _badge(d['statut_doc'] ?? 'Inconnu', docGood),
        ],
      ),
    );
  }

  Widget _badge(String s, bool good) {
    final c = good ? const Color(0xFF10B981) : Colors.blue;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }

  Widget _statusBadge(String s, bool good) {
    Color c = good ? const Color(0xFF10B981) : const Color(0xFF0247AA);
    if (s.toLowerCase().contains('refu') || s.toLowerCase().contains('reje')) {
      c = Colors.redAccent;
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }
}
