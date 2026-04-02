import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../api_service.dart';
import '../ui_utils.dart';
import 'package:intl/intl.dart';
import '../web_view_registry.dart';
import 'package:dio/dio.dart' as dio;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:universal_io/io.dart';
import 'package:file_picker/file_picker.dart';




class TokenRequestsScreen extends StatefulWidget {
  const TokenRequestsScreen({super.key});

  @override
  State<TokenRequestsScreen> createState() => _TokenRequestsScreenState();
}

class _TokenRequestsScreenState extends State<TokenRequestsScreen> {
  final ApiService api = ApiService();
  bool _loading = true;
  List<dynamic> _requests = [];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() => _loading = true);
    try {
      final res = await api.getMyTokenRequests();
      if (mounted) setState(() { _requests = res; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  String _getStatusLabel(String status) {
    switch (status) {
      case 'pending': return 'Analyse Administrative';
      case 'payment_pending': return 'Attente Versement';
      case 'payment_submitted': return 'Vérification Preuve';
      case 'approved': return 'Crédités';
      case 'rejected': return 'Refusée';
      default: return 'En cours';
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'pending': return Colors.orange;
      case 'payment_pending': return const Color(0xFF0247AA);
      case 'payment_submitted': return Colors.purple;
      case 'approved': return const Color(0xFF10B981);
      case 'rejected': return const Color(0xFFF43F5E);
      default: return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchRequests,
              child: CustomScrollView(
                slivers: [
                   _buildSliverHeader(),
                   SliverPadding(
                     padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                     sliver: SliverList(
                       delegate: SliverChildListDelegate([
                          if (_requests.isEmpty)
                            const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucune demande active.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13))))
                          else
                            ..._requests.map((item) => _buildRequestCard(item)).toList(),
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
      automaticallyImplyLeading: false,
      flexibleSpace: const FlexibleSpaceBar(
        titlePadding: EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        centerTitle: false,
        title: Text('Journal d\'Acquisition', style: TextStyle(fontWeight: FontWeight.w900, color: Colors.white, fontSize: 18, letterSpacing: -0.5)),
      ),
    );
  }

  Widget _buildRequestCard(dynamic item) {
    final status = item['status']?.toString() ?? 'pending';
    final color = _getStatusColor(status);
    final date = DateTime.tryParse(item['created_at'] ?? '');
    final dateStr = date != null ? DateFormat('dd MMM, yyyy HH:mm').format(date) : '-';

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(24), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              children: [
                Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: color.withOpacity(0.08), shape: BoxShape.circle), child: Icon(Icons.receipt_long_rounded, size: 20, color: color)),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(item['pack_name'] ?? 'Demande Jetons', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, color: Color(0xFF0247AA))),
                    Text(dateStr, style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
                  ]),
                ),
                _statusBadge(status, color),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: const BoxDecoration(color: Color(0xFFF8FAFC), borderRadius: BorderRadius.vertical(bottom: Radius.circular(24))),
            child: Column(
              children: [
                _dataRow('Quantité de Jetons', '${item['tokens']} UN'),
                _dataRow('Montant HT', '${item['price_tnd']} TND'),
                if (item['admin_note'] != null) _dataRow('Note Admin', item['admin_note']),
                const Padding(padding: EdgeInsets.symmetric(vertical: 12), child: Divider(height: 1, color: Color(0xFFE2E8F0))),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(_getStatusLabel(status), style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color)),
                    if (status == 'payment_pending')
                      ElevatedButton.icon(
                        onPressed: () => _showUploadModal(item['id']),
                        icon: const Icon(Icons.file_upload_outlined, size: 16),
                        label: const Text('ENVOYER PREUVE', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0247AA), 
                          foregroundColor: Colors.white, 
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12))
                        ),
                      )
                    else if (int.tryParse(item['has_payment_proof'].toString()) == 1)
                      IconButton(icon: const Icon(Icons.visibility_outlined, size: 18, color: Color(0xFF64748B)), onPressed: () => _openProofPreview(api.getTokenRequestProofUrl(item['id']))),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _dataRow(String l, String v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        Text(l, style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w600)),
        Text(v, style: const TextStyle(fontSize: 11, color: Color(0xFF1E293B), fontWeight: FontWeight.w900)),
      ]),
    );
  }

  Widget _statusBadge(String s, Color c) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: c.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
      child: Text(s.toUpperCase(), style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: c, letterSpacing: 0.5)),
    );
  }

  Future<void> _showUploadModal(int requestId) async {
    PlatformFile? selectedFile;
    bool isUploading = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
          ),
          padding: EdgeInsets.only(
            bottom: MediaQuery.of(context).viewInsets.bottom + 32,
            top: 32, left: 24, right: 24
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40, height: 4,
                decoration: BoxDecoration(color: const Color(0xFFE2E8F0), borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 24),
              const Text('Dépôt de Preuve', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF0247AA))),
              const SizedBox(height: 8),
              const Text('Sélectionnez votre reçu de paiement (PDF, Image)', style: TextStyle(color: Color(0xFF64748B), fontSize: 13)),
              const SizedBox(height: 32),
              
              GestureDetector(
                onTap: isUploading ? null : () async {
                  FilePickerResult? result = await FilePicker.platform.pickFiles(
                    type: FileType.custom,
                    allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png']
                  );
                  if (result != null) {
                    setModalState(() => selectedFile = result.files.single);
                  }
                },
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: selectedFile != null ? const Color(0xFF0247AA) : const Color(0xFFE2E8F0), width: 2, style: BorderStyle.solid),
                  ),
                  child: Column(
                    children: [
                      Icon(
                        selectedFile != null ? Icons.check_circle_rounded : Icons.cloud_upload_outlined,
                        size: 48, 
                        color: selectedFile != null ? const Color(0xFF10B981) : const Color(0xFF0247AA)
                      ),
                      const SizedBox(height: 16),
                      Text(
                        selectedFile?.name ?? 'Choisir un fichier',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: selectedFile != null ? const Color(0xFF0F172A) : const Color(0xFF64748B)
                        ),
                      ),
                      if (selectedFile != null)
                        Text(
                          '${(selectedFile!.size / 1024).toStringAsFixed(1)} KB',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF94A3B8)),
                        ),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 32),
              SizedBox(
                width: double.infinity,
                height: 56,
                child: ElevatedButton(
                  onPressed: (selectedFile == null || isUploading) ? null : () async {
                    setModalState(() => isUploading = true);
                    try {
                      dio.MultipartFile fileToUpload;
                      if (kIsWeb) {
                        fileToUpload = dio.MultipartFile.fromBytes(selectedFile!.bytes!, filename: selectedFile!.name);
                      } else {
                        fileToUpload = await dio.MultipartFile.fromFile(selectedFile!.path!, filename: selectedFile!.name);
                      }

                      await api.uploadPaymentProof(requestId, fileToUpload);
                      if (mounted) {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(this.context).showSnackBar(const SnackBar(
                          content: Text('✅ Preuve envoyée avec succès.'),
                          backgroundColor: Color(0xFF10B981),
                        ));
                        _fetchRequests();
                      }
                    } catch (e) {
                      if (mounted) {
                        setModalState(() => isUploading = false);
                        ScaffoldMessenger.of(this.context).showSnackBar(const SnackBar(
                          content: Text('❌ Échec de l\'envoi.'),
                          backgroundColor: Color(0xFFF43F5E),
                        ));
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF0247AA),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 0,
                  ),
                  child: isUploading 
                    ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('CONFIRMER L\'ENVOI', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openProofPreview(String url) {
    if (kIsWeb) {
      final String viewId = 'proof-view-${DateTime.now().millisecondsSinceEpoch}';
      registerWebViewFactory(viewId, url);
      showGeneralDialog(
        context: context,
        barrierDismissible: true,
        barrierLabel: 'PROOF',
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
                  Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                    const Text('Dépôt Certifié', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18, color: Color(0xFF0247AA))),
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
                      child: const Text('FERMER', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold))
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
              const Icon(Icons.verified_user_rounded, size: 64, color: Color(0xFF10B981)),
              const SizedBox(height: 24),
              const Text(
                'Justificatif de Paiement',
                style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20, color: Color(0xFF0F172A)),
              ),
              const SizedBox(height: 8),
              const Text(
                'Souhaitez-vous visualiser votre preuve de paiement soumise ?',
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
                  icon: const Icon(Icons.launch_rounded),
                  label: const Text('OUVRIR LE JUSTIFICATIF', style: TextStyle(fontWeight: FontWeight.bold)),
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
