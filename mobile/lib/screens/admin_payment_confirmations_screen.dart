import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:url_launcher/url_launcher.dart';
import '../web_view_registry.dart';
import '../api_service.dart';
import '../ui_utils.dart';


class AdminPaymentConfirmationsScreen extends StatefulWidget {
  const AdminPaymentConfirmationsScreen({super.key});

  @override
  State<AdminPaymentConfirmationsScreen> createState() => _AdminPaymentConfirmationsScreenState();
}

class _AdminPaymentConfirmationsScreenState extends State<AdminPaymentConfirmationsScreen> {
  final ApiService api = ApiService();
  final TextEditingController _searchController = TextEditingController();
  bool _loading = true;
  List<dynamic> _requests = [];
  List<dynamic> _filteredRequests = [];
  String _statusFilter = 'payment_submitted';

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
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          const Text('COMMANDES À VALIDER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                          Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: const Color(0xFF0247AA).withOpacity(0.1), borderRadius: BorderRadius.circular(10)), child: Text('${_filteredRequests.length} UNITÉS', style: const TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF0247AA)))),
                        ]),
                        const SizedBox(height: 16),
                        if (_filteredRequests.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucun paiement trouvé.')))
                        else
                          ..._filteredRequests.map((req) => _buildConfirmCard(req)).toList(),
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
      flexibleSpace: const FlexibleSpaceBar(
        centerTitle: true,
        title: Text('Centre de Validation', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
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
          style: const TextStyle(color: Color(0xFF0247AA), fontWeight: FontWeight.w900, fontSize: 13),
          items: const [
            DropdownMenuItem(value: 'payment_submitted', child: Text('FILTRER : PREUVES REÇUES')),
            DropdownMenuItem(value: 'all', child: Text('HISTORIQUE COMPLET')),
            DropdownMenuItem(value: 'approved', child: Text('VALIDÉES')),
          ],
          onChanged: (v) { setState(() => _statusFilter = v!); _loadData(); },
        ),
      ),
    );
  }

  Widget _buildConfirmCard(dynamic req) {
    final status = req['status'] ?? '';
    final bool isActionable = status == 'payment_submitted';
    final date = DateTime.tryParse(req['payment_uploaded_at'] ?? '');
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
                Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFF10B981).withOpacity(0.08), shape: BoxShape.circle), child: const Icon(Icons.verified_user_rounded, size: 20, color: Color(0xFF10B981))),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(req['user_name'] ?? 'Utilisateur', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0F172A))),
                    Text('Facture: ${req['pack_name']}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
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
                _data('VOLUME À CRÉDITER', '${req['tokens']} JETONS'),
                _data('MONTANT CALCULÉ', '${req['price_tnd']} TND'),
                _data('RÉCEPTION DE PREUVE', dateStr),
                const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(icon: const Icon(Icons.description_outlined, color: Color(0xFF0247AA), size: 20), onPressed: () => _viewProof(req['id'])),
                    if (isActionable) Row(children: [
                      IconButton(icon: const Icon(Icons.close_rounded, color: Color(0xFFF43F5E), size: 18), onPressed: () => _handleDecision(req, false)),
                      const SizedBox(width: 8),
                      ElevatedButton(onPressed: () => _handleDecision(req, true), style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10))), child: const Text('VÉRIFIER & CRÉDITER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white))),
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
      case 'payment_submitted': c = Colors.indigo; break;
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

  Future<void> _handleDecision(dynamic req, bool approve) async {
    setState(() => _loading = true);
    try { await api.adminTokenDecision(req['id'], approve ? 'approved' : 'rejected', note: approve ? "Paiement validé" : "Preuve incorrecte"); _loadData(); }
    catch (_) { if (mounted) setState(() => _loading = false); }
  }

  void _viewProof(int requestId) {
    final url = api.getTokenProofUrl(requestId);
    
    if (kIsWeb) {
      final String viewId = 'proof-final-view-$requestId-${DateTime.now().millisecondsSinceEpoch}';
      registerWebViewFactory(viewId, url);
      showGeneralDialog(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'PROOF',
        pageBuilder: (c, a, b) => Center(
          child: Container(
            width: MediaQuery.of(c).size.width * 0.9, height: MediaQuery.of(c).size.height * 0.85,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
            padding: const EdgeInsets.all(24),
            child: Material(
              color: Colors.transparent,
              child: Column(
                children: [
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('Validation du Paiement', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0F172A))),
                    IconButton(icon: const Icon(Icons.close_rounded), onPressed: () => Navigator.pop(c)),
                  ]),
                  const SizedBox(height: 16),
                  Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(16), child: HtmlElementView(viewType: viewId))),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(c),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0247AA),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 0,
                      ),
                      child: const Text('TERMINER LA RÉVISION', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
                    )
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    } else {
      // Mobile / Emulator Compatibility
      showModalBottomSheet(
        context: context,
        backgroundColor: Colors.transparent,
        builder: (context) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 28),
              const Icon(Icons.account_balance_wallet_rounded, size: 64, color: Color(0xFF0247AA)),
              const SizedBox(height: 24),
              const Text(
                'Revue de Paiement',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Examinez la preuve de virement du client dans votre lecteur PDF natif.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    final uri = Uri.parse(url);
                    try {
                      await launchUrl(uri);
                    } catch (e) {
                      if (mounted) UiUtils.showError(this.context, 'Impossible d\'ouvrir le document : $e');
                    }
                  },
                  icon: const Icon(Icons.visibility_rounded),
                  label: const Text('VISUALISER LA PREUVE', style: TextStyle(fontWeight: FontWeight.bold)),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0247AA),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('ANNULER', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.bold)),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      );
    }
  }

}
