import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:url_launcher/url_launcher.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import '../api_service.dart';
import '../ui_utils.dart';
import 'package:intl/intl.dart';
import '../web_view_registry.dart';


class FactureScreen extends StatefulWidget {
  const FactureScreen({super.key});

  @override
  State<FactureScreen> createState() => _FactureScreenState();
}

class _FactureScreenState extends State<FactureScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  List<dynamic> _factures = [];
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadFactures();
  }

  Future<void> _loadFactures() async {
    setState(() => _loading = true);
    try {
      final res = await api.getMyFactures();
      if (mounted) setState(() { _factures = res; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _filteredFactures {
    return _factures.where((f) {
      final search = _searchController.text.toLowerCase();
      return (f['invoice_number']?.toString() ?? '').toLowerCase().contains(search) || (f['filename']?.toString() ?? '').toLowerCase().contains(search);
    }).toList();
  }

  // ─── Downloads ──────────────────────────────────────────────────────────────
  void _openDownloadDialog() {
    if (_factures.isEmpty) {
      UiUtils.showError(context, 'Aucune facture disponible à télécharger.');
      return;
    }

    final Set<int> selected = {};

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: EdgeInsets.only(
            top: 24, left: 24, right: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Handle
              Container(width: 40, height: 4, decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2))),
              const SizedBox(height: 20),
              // Title
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(color: const Color(0xFF0247AA).withValues(alpha: 0.08), shape: BoxShape.circle),
                    child: const Icon(Icons.download_rounded, color: Color(0xFF0247AA), size: 22),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('Télécharger des Factures', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 17, color: Color(0xFF0F172A))),
                        Text('Sélectionnez les fichiers à télécharger', style: TextStyle(fontSize: 12, color: Color(0xFF94A3B8))),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () => setLocal(() {
                      if (selected.length == _factures.length) {
                        selected.clear();
                      } else {
                        selected.addAll(_factures.map<int>((f) => f['id'] as int));
                      }
                    }),
                    child: Text(selected.length == _factures.length ? 'Tout désélect.' : 'Tout sélect.', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0247AA))),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // File list
              ConstrainedBox(
                constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.4),
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _factures.length,
                  separatorBuilder: (_, __) => const Divider(height: 1, color: Color(0xFFF1F5F9)),
                  itemBuilder: (_, i) {
                    final f = _factures[i];
                    final id = f['id'] as int;
                    final isChecked = selected.contains(id);
                    return CheckboxListTile(
                      value: isChecked,
                      onChanged: (v) => setLocal(() { if (v == true) { selected.add(id); } else { selected.remove(id); } }),
                      activeColor: const Color(0xFF0247AA),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
                      title: Text('Facture #${f['invoice_number'] ?? id}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0F172A))),
                      subtitle: Text(f['filename'] ?? 'Document PDF', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8)), maxLines: 1, overflow: TextOverflow.ellipsis),
                      secondary: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withOpacity(0.08),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.picture_as_pdf_rounded, color: Color(0xFFEF4444), size: 18),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 20),
              // Info
              if (selected.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  margin: const EdgeInsets.only(bottom: 12),
                  decoration: BoxDecoration(color: const Color(0xFF0247AA).withValues(alpha: 0.06), borderRadius: BorderRadius.circular(12)),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline_rounded, size: 14, color: Color(0xFF0247AA)),
                      const SizedBox(width: 8),
                      Text('${selected.length} fichier(s) sélectionné(s)', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0247AA))),
                    ],
                  ),
                ),
              // Download button
              SizedBox(
                width: double.infinity,
                height: 54,
                child: ElevatedButton.icon(
                  onPressed: selected.isEmpty
                      ? null
                      : () {
                          Navigator.pop(ctx);
                          _downloadSelected(selected.toList());
                        },
                  icon: const Icon(Icons.download_rounded),
                  label: Text(
                    selected.isEmpty ? 'SÉLECTIONNEZ DES FICHIERS' : 'TÉLÉCHARGER (${selected.length})',
                    style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0247AA),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFE2E8F0),
                    disabledForegroundColor: const Color(0xFF94A3B8),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                ),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('ANNULER', style: TextStyle(color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _downloadSelected(List<int> ids) async {
    int success = 0;
    int failed = 0;

    // Show progress snackbar
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(children: [
            const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
            const SizedBox(width: 16),
            Text('Téléchargement de ${ids.length} fichier(s)...'),
          ]),
          duration: const Duration(seconds: 60),
          backgroundColor: const Color(0xFF0247AA),
        ),
      );
    }

    for (final id in ids) {
      final url = api.getFacturePdfUrl(id);
      try {
        if (kIsWeb) {
          // On web, just open the URL
          await launchUrl(Uri.parse(url));
          success++;
        } else {
          // On mobile, download to Downloads folder
          final dir = await _getDownloadDirectory();
          final filename = 'facture_$id.pdf';
          final filePath = '${dir.path}/$filename';

          final dio = Dio();
          await dio.download(url, filePath,
            options: Options(headers: {'Accept': 'application/pdf'}),
          );
          success++;
        }
      } catch (e) {
        failed++;
      }
    }

    if (mounted) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      if (failed == 0) {
        UiUtils.showSuccess(context, '$success fichier(s) téléchargé(s) avec succès dans Téléchargements.');
      } else if (success > 0) {
        UiUtils.showError(context, '$success réussi(s), $failed échec(s). Vérifiez votre connexion.');
      } else {
        UiUtils.showError(context, 'Échec du téléchargement. Vérifiez votre connexion.');
      }
    }
  }

  Future<Directory> _getDownloadDirectory() async {
    try {
      // Try to get external storage (Android)
      final dir = Directory('/storage/emulated/0/Download');
      if (await dir.exists()) return dir;
    } catch (_) {}
    // Fallback to app documents directory
    return await getApplicationDocumentsDirectory();
  }

  // ─── Build methods ───────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _loading 
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadFactures,
              child: CustomScrollView(
                slivers: [
                  _buildSliverHeader(),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                    sliver: SliverList(
                      delegate: SliverChildListDelegate([
                        _buildStatsOverview(),
                        const SizedBox(height: 28),
                        _buildSearchBox(),
                        const SizedBox(height: 32),
                        const Text('LEDGER DES FACTURES', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
                        const SizedBox(height: 16),
                        if (_filteredFactures.isEmpty)
                          const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune facture disponible.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13))))
                        else
                          ..._filteredFactures.map((f) => _buildFactureCard(f)),
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
      elevation: 0,
      automaticallyImplyLeading: false,
      flexibleSpace: const FlexibleSpaceBar(
        centerTitle: true,
        title: Text('Facturation Digitale', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
      ),
      actions: [
        IconButton(
          tooltip: 'Télécharger des factures',
          icon: const Icon(Icons.download_rounded, color: Colors.white),
          onPressed: _openDownloadDialog,
        ),
      ],
    );
  }

  Widget _buildStatsOverview() {
    final signed = _factures.where((f) => f['statut'].toString().toLowerCase().contains('sign')).length;
    return Row(
      children: [
        _statCard('TOTAL', _factures.length.toString(), const Color(0xFF0247AA), Icons.all_inbox_rounded),
        const SizedBox(width: 16),
        _statCard('CERTIFIÉES', signed.toString(), const Color(0xFF10B981), Icons.verified_rounded),
      ],
    );
  }

  Widget _statCard(String label, String val, Color c, IconData i) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(i, color: c, size: 18),
                Text(val, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
              ],
            ),
            const SizedBox(height: 12),
            Text(label, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF64748B), letterSpacing: 1)),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBox() {
    return TextField(
      controller: _searchController,
      onChanged: (v) => setState(() {}),
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.search_rounded, size: 20, color: Color(0xFF94A3B8)),
        hintText: 'Facture # ou document...',
        filled: true, fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
        contentPadding: const EdgeInsets.symmetric(vertical: 14),
      ),
    );
  }

  Widget _buildFactureCard(dynamic f) {
    final status = f['statut']?.toString().toLowerCase() ?? '';
    final bool isSigned = status.contains('sign');
    final color = isSigned ? const Color(0xFF10B981) : const Color(0xFFF59E0B);
    final date = DateTime.tryParse(f['created_at'] ?? '');
    final dateStr = date != null ? DateFormat('dd/MM/yyyy').format(date) : '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0247AA).withValues(alpha: 0.02),
            offset: const Offset(0, 4),
            blurRadius: 10,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: () => _openPdfPreview(f),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                        shape: BoxShape.circle
                      ),
                      child: const Icon(Icons.picture_as_pdf_rounded, color: Color(0xFFEF4444), size: 22),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Facture #${f['invoice_number'] ?? f['id']}',
                            style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, color: Color(0xFF0F172A))
                          ),
                          const SizedBox(height: 2),
                          Text(
                            f['filename'] ?? 'Libellé inconnu',
                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis
                          ),
                        ],
                      ),
                    ),
                    _statusBadge(status, color),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Divider(height: 1, color: Color(0xFFF1F5F9)),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.calendar_today_rounded, size: 14, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 6),
                        Text(dateStr, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
                      ],
                    ),
                    GestureDetector(
                      onTap: () => _downloadSelected([f['id'] as int]),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(color: const Color(0xFF0247AA).withValues(alpha: 0.07), borderRadius: BorderRadius.circular(10)),
                        child: const Row(
                          children: [
                            Icon(Icons.download_rounded, size: 14, color: Color(0xFF0247AA)),
                            SizedBox(width: 4),
                            Text('TÉLÉCHARGER', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: 0.5)),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(String s, Color c) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }

  void _openPdfPreview(dynamic f) {
    final url = api.getFacturePdfUrl(f['id']);
    if (kIsWeb) {
      final String viewId = 'pdf-view-${DateTime.now().millisecondsSinceEpoch}';
      registerWebViewFactory(viewId, url);

      showGeneralDialog(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'PDF',
        pageBuilder: (c, a, b) => Center(
          child: Container(
            width: MediaQuery.of(c).size.width * 0.9,
            height: MediaQuery.of(c).size.height * 0.85,
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32)),
            padding: const EdgeInsets.all(24),
            child: Material(
              color: Colors.transparent,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Visionneuse Certifiée', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0247AA))),
                      IconButton(icon: const Icon(Icons.close_rounded, size: 24), onPressed: () => Navigator.pop(c)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  Expanded(child: ClipRRect(borderRadius: BorderRadius.circular(16), child: HtmlElementView(viewType: viewId))),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: () => Navigator.pop(c),
                      icon: const Icon(Icons.check_circle_outline_rounded, size: 18),
                      label: const Text('TERMINER LA LECTURE', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0247AA),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
                        elevation: 0
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    } else {
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
              const Icon(Icons.picture_as_pdf_rounded, size: 64, color: Color(0xFFEF4444)),
              const SizedBox(height: 24),
              Text(
                'Facture ${f['invoice_number']}',
                style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Souhaitez-vous ouvrir ou télécharger ce document ?',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () async {
                        Navigator.pop(context);
                        final uri = Uri.parse(url);
                        try {
                          await launchUrl(uri);
                        } catch (e) {
                          if (mounted) UiUtils.showError(context, 'Impossible d\'ouvrir la facture : $e');
                        }
                      },
                      icon: const Icon(Icons.open_in_new_rounded, size: 16),
                      label: const Text('OUVRIR', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF0247AA),
                        side: const BorderSide(color: Color(0xFF0247AA)),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.pop(context);
                        _downloadSelected([f['id'] as int]);
                      },
                      icon: const Icon(Icons.download_rounded, size: 16),
                      label: const Text('TÉLÉCHARGER', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0247AA),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        elevation: 0,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                    ),
                  ),
                ],
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
