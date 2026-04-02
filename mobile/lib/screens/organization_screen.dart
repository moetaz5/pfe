import 'package:flutter/material.dart';
import '../api_service.dart';
import '../ui_utils.dart';
import 'transaction_detail_screen.dart';

class OrganizationScreen extends StatefulWidget {
  final Map<String, dynamic>? user;
  final String subPage;
  const OrganizationScreen({super.key, this.user, required this.subPage});

  @override
  State<OrganizationScreen> createState() => _OrganizationScreenState();
}

class _OrganizationScreenState extends State<OrganizationScreen> {
  final ApiService api = ApiService();
  bool _loading = true;

  Map<String, dynamic>? _organization;
  List<dynamic> _members = [];
  String _myRole = '';
  bool _isOwner = false;

  final _nameController = TextEditingController();
  final _matriculeController = TextEditingController();
  final _addressController = TextEditingController();
  final _villeController = TextEditingController();
  final _postalController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _faxController = TextEditingController();
  
  final _inviteEmailController = TextEditingController();
  final List<String> _pendingInvites = [];
  List<dynamic> _transactions = [];
  final _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _initPage();
  }

  @override
  void didUpdateWidget(OrganizationScreen oldWidget) {
    if (oldWidget.subPage != widget.subPage) _initPage();
    super.didUpdateWidget(oldWidget);
  }

  void _initPage() {
    if (mounted) setState(() { _loading = true; _organization = null; _members = []; _transactions = []; });
    if (widget.subPage == 'create') _fetchMyOrganization();
    else if (widget.subPage == 'transactions') _loadOrganizationTransactions();
  }

  Future<void> _fetchMyOrganization() async {
    try {
      final orgs = await api.getMyOrganizations();
      if (orgs.isNotEmpty) _loadDetail(orgs[0]['id']);
      else if (mounted) setState(() => _loading = false);
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _loadDetail(int id) async {
    try {
      final data = await api.getOrganizationDetail(id);
      if (mounted) {
        setState(() {
          _organization = data['organization'];
          _members = data['members'] ?? [];
          _myRole = data['myRole'] ?? '';
          _isOwner = _myRole.toUpperCase() == 'OWNER';
          _nameController.text = _organization?['name'] ?? '';
          _matriculeController.text = _organization?['matricule_fiscale'] ?? '';
          _addressController.text = _organization?['adresse'] ?? '';
          _villeController.text = _organization?['ville'] ?? '';
          _postalController.text = _organization?['code_postal'] ?? '';
          _phoneController.text = _organization?['telephone'] ?? '';
          _emailController.text = _organization?['email'] ?? '';
          _faxController.text = _organization?['fax'] ?? '';
          _loading = false;
        });
      }
    } catch (e) { 
      if (mounted) {
        UiUtils.showError(context, 'Échec du chargement des détails de l\'entité.');
        setState(() => _loading = false); 
      }
    }
  }

  Future<void> _loadOrganizationTransactions() async {
    try {
      final orgs = await api.getMyOrganizations();
      if (orgs.isEmpty) { 
        if (mounted) {
          UiUtils.showInfo(context, 'Aucune organisation professionnelle détectée.');
          setState(() => _loading = false); 
        }
        return; 
      }
      final res = await api.getOrganizationTransactions(orgs[0]['id']);
      if (mounted) setState(() { _transactions = res; _loading = false; });
    } catch (_) { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _handleCreate() async {
    if (_nameController.text.isEmpty) {
        UiUtils.showError(context, 'La désignation sociale est obligatoire.');
        return;
    }
    setState(() => _loading = true);
    try {
      final res = await api.createOrganization({
        'name': _nameController.text.trim(), 
        'matricule_fiscale': _matriculeController.text.trim(), 
        'adresse': _addressController.text.trim(), 
        'ville': _villeController.text.trim(), 
        'code_postal': _postalController.text.trim(), 
        'telephone': _phoneController.text.trim(), 
        'email': _emailController.text.trim(), 
        'fax': _faxController.text.trim()
      });
      final id = res['organizationId'];
      for (var email in _pendingInvites) try { await api.inviteToOrganization(id, email); } catch (_) {}
      if (mounted) UiUtils.showSuccess(context, 'Structure professionnelle créée avec succès.');
      _loadDetail(id);
    } catch (e) { 
      if (mounted) {
        UiUtils.showError(context, 'Erreur lors de la création de l\'entité.');
        setState(() => _loading = false); 
      }
    }
  }

  List<dynamic> get _filteredTransactions {
    final search = _searchController.text.toLowerCase();
    return _transactions.where((t) {
      final idMatch = t['id'].toString().contains(search);
      final userMatch = (t['user_name']?.toString() ?? '').toLowerCase().contains(search);
      return idMatch || userMatch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: CircularProgressIndicator(color: Color(0xFF0247AA)));
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        child: Column(
          children: [
            _buildHeader(),
            const SizedBox(height: 28),
            if (widget.subPage == 'create') (_organization == null ? _creationForm() : _detailView()),
            if (widget.subPage == 'transactions') _transactionsView(),
            const SizedBox(height: 80),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    String t = "Espace de Travail";
    String s = "Gérez votre entité professionnelle en toute sécurité.";
    if (widget.subPage == 'transactions') { t = "Flux Collaboratif"; s = "Historique des signatures partagées au sein de l'entité."; }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(t, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1)),
        Text(s, style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
      ],
    );
  }

  Widget _creationForm() {
    return Column(
      children: [
        _section('IDENTITÉ CORPORATE', [
          _input('Désignation Sociale Officielle', _nameController, Icons.business_rounded),
          _input('Matricule Fiscale', _matriculeController, Icons.assignment_turned_in_rounded),
          _input('Siège Social / Adresse Postale', _addressController, Icons.map_rounded),
          Row(children: [
            Expanded(child: _input('Ville / Gouvernorat', _villeController, Icons.location_city_rounded)),
            const SizedBox(width: 12),
            Expanded(child: _input('Code Postal', _postalController, Icons.local_post_office_rounded)),
          ]),
        ]),
        const SizedBox(height: 24),
        _section('COORDONNÉES ADMINISTRATIVES', [
          _input('Contact Mobile Corporatif', _phoneController, Icons.phone_android_rounded),
          _input('Adresse Email Bureau', _emailController, Icons.alternate_email_rounded),
        ]),
        const SizedBox(height: 24),
        _primaryBtn('INITIER LA STRUCTURE', _handleCreate),
      ],
    );
  }

  Widget _detailView() {
    return Column(
      children: [
        _section('DÉTAILS DE L\'ENTITÉ CERTIFIÉE', [
          _input('Désignation', _nameController, Icons.business_rounded, enabled: _isOwner),
          _input('Matricule Fiscale', _matriculeController, Icons.assignment_turned_in_rounded, enabled: _isOwner),
          if (_isOwner) ...[
            const SizedBox(height: 12),
            _primaryBtn('ACTUALISER L\'IDENTITÉ', () async { 
               setState(() => _loading = true); 
               try { 
                 await api.updateOrganization(_organization!['id'], {
                    'name': _nameController.text.trim(), 
                    'matricule_fiscale': _matriculeController.text.trim()
                 }); 
                 if (mounted) UiUtils.showSuccess(context, 'Mise à jour effectuée.');
                 _loadDetail(_organization!['id']); 
               } catch (_) { 
                 if (mounted) {
                   UiUtils.showError(context, 'Échec de la mise à jour.');
                   setState(() => _loading = false); 
                 }
               }
            }),
          ],
        ]),
        const SizedBox(height: 24),
        _section('COLLABORATEURS AUTORISÉS', [
          ..._members.map((m) => _memberRow(m)).toList(),
          if (_isOwner) ...[
            const SizedBox(height: 24),
            _input('Email du nouveau collaborateur', _inviteEmailController, Icons.person_add_rounded),
            _primaryBtn('INVITER AU RÉSEAU', () async {
              if (_inviteEmailController.text.isEmpty) return;
              setState(() => _loading = true); 
              try { 
                await api.inviteToOrganization(_organization!['id'], _inviteEmailController.text.trim()); 
                _inviteEmailController.clear(); 
                if (mounted) UiUtils.showSuccess(context, 'Invitation transmise au collaborateur.');
                _loadDetail(_organization!['id']); 
              } catch (_) { 
                if (mounted) {
                   UiUtils.showError(context, 'Impossible d\'inviter ce membre.');
                   setState(() => _loading = false); 
                }
              }
            }),
          ]
        ]),
        const SizedBox(height: 48),
        _primaryBtn(_isOwner ? 'SUPPRIMER DÉFINITIVEMENT L\'ENTITÉ' : 'QUITTER CET ESPACE DE TRAVAIL', () {
            UiUtils.showInfo(context, 'Action de résiliation non autorisée via mobile.');
        }, danger: true),
      ],
    );
  }

  Widget _memberRow(dynamic m) {
    final bool owner = m['role'].toString().toUpperCase() == 'OWNER';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Row(
        children: [
          Container(padding: const EdgeInsets.all(10), decoration: BoxDecoration(color: (owner ? const Color(0xFF10B981) : const Color(0xFF0247AA)).withOpacity(0.1), shape: BoxShape.circle), child: Icon(owner ? Icons.verified_user_rounded : Icons.person_rounded, size: 18, color: owner ? const Color(0xFF10B981) : const Color(0xFF0247AA))),
          const SizedBox(width: 16),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(m['name'] ?? 'Collaborateur', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0247AA))),
            Text(m['email'] ?? '-', style: const TextStyle(fontSize: 10, color: Color(0xFF94A3B8), fontWeight: FontWeight.bold)),
          ])),
          if (owner) const Text('GÉRANT', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w900, color: Color(0xFF10B981), letterSpacing: 1))
          else if (_isOwner) IconButton(icon: const Icon(Icons.person_remove_rounded, color: Color(0xFFF43F5E), size: 18), onPressed: () {
             UiUtils.showInfo(context, 'Retrait de membre non disponible.');
          }),
        ],
      ),
    );
  }

  Widget _transactionsView() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0)), boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10)]),
          child: TextField(
            controller: _searchController,
            onChanged: (v) => setState(() {}),
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search_rounded, size: 20, color: Color(0xFF94A3B8)),
              hintText: 'Rechercher un flux ou initiateur...',
              hintStyle: TextStyle(fontSize: 13, color: Color(0xFF94A3B8)),
              border: InputBorder.none,
            ),
          ),
        ),
        const SizedBox(height: 32),
        const Text('JOURNAL COLLABORATIF CERTIFIÉ', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.5, color: Color(0xFF94A3B8))),
        const SizedBox(height: 16),
        if (_filteredTransactions.isEmpty) const Center(child: Padding(padding: EdgeInsets.symmetric(vertical: 80), child: Text('Aucun flux professionnel trouvé.', style: TextStyle(color: Color(0xFF64748B), fontSize: 13, fontWeight: FontWeight.w500))))
        else ..._filteredTransactions.map((t) => _txRow(t)).toList(),
      ],
    );
  }

  Widget _txRow(dynamic t) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (c) => TransactionDetailScreen(transactionId: t['id']))),
        child: Row(
          children: [
             const Icon(Icons.description_outlined, color: Color(0xFF0247AA), size: 20),
             const SizedBox(width: 16),
             Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
               Text('FLUX D\'ENTITÉ #${t['id']}', style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 13, color: Color(0xFF0247AA))),
               Text('Initié par: ${t['user_name']}', style: const TextStyle(fontSize: 11, color: Color(0xFF94A3B8), fontWeight: FontWeight.w500)),
             ])),
             const Icon(Icons.arrow_forward_ios_rounded, size: 12, color: Color(0xFFCBD5E1)),
          ],
        ),
      ),
    );
  }

  Widget _section(String title, List<Widget> children) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(32), border: Border.all(color: const Color(0xFFE2E8F0))),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(title, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 2, color: Color(0xFF94A3B8))),
        const SizedBox(height: 24),
        ...children,
      ]),
    );
  }

  Widget _input(String label, TextEditingController ctrl, IconData i, {bool enabled = true}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: ctrl, enabled: enabled,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        decoration: InputDecoration(
          prefixIcon: Icon(i, size: 20, color: const Color(0xFF94A3B8)),
          hintText: label,
          filled: true, fillColor: enabled ? const Color(0xFFF8FAFC) : const Color(0xFFF1F5F9),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
        ),
      ),
    );
  }

  Widget _primaryBtn(String t, VoidCallback fn, {bool danger = false}) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : fn,
        style: ElevatedButton.styleFrom(backgroundColor: danger ? const Color(0xFFE11D48) : const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 20), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
        child: _loading ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text(t, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
