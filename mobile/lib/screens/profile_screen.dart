import 'package:flutter/material.dart';
import '../api_service.dart';
import '../ui_utils.dart';

class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic>? user;
  final String subPage;
  final Function(String)? onNavigate;
  final VoidCallback? onRefreshUser;
  const ProfileScreen({super.key, this.user, required this.subPage, this.onNavigate, this.onRefreshUser});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService api = ApiService();
  bool _loading = false;

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();

  final _currentPwdController = TextEditingController();
  final _newPwdController = TextEditingController();
  final _confirmPwdController = TextEditingController();

  final _matriculeController = TextEditingController();
  final _certAddressController = TextEditingController();
  final _villeController = TextEditingController();
  final _postalController = TextEditingController();
  final _ttnLoginController = TextEditingController();
  final _ttnPwdController = TextEditingController();
  bool _isCertified = false;

  String? _signature;

  @override
  void initState() {
    super.initState();
    _initSubPage();
  }

  @override
  void didUpdateWidget(ProfileScreen oldWidget) {
    if (oldWidget.subPage != widget.subPage) _initSubPage();
    super.didUpdateWidget(oldWidget);
  }

  void _initSubPage() {
    if (widget.subPage == 'edit') {
      _nameController.text = widget.user?['name'] ?? '';
      _phoneController.text = widget.user?['phone'] ?? '';
      _addressController.text = widget.user?['address'] ?? '';
    } else if (widget.subPage == 'certification') {
      _loadCertificationInfo();
    } else if (widget.subPage == 'signature') {
      _loadSignature();
    }
  }

  Future<void> _loadCertificationInfo() async {
    setState(() => _loading = true);
    try {
      final data = await api.getCertificationInfo();
      setState(() {
        _matriculeController.text = data['matricule_fiscale'] ?? '';
        _certAddressController.text = data['adresse'] ?? '';
        _villeController.text = data['ville'] ?? '';
        _postalController.text = data['code_postal'] ?? '';
        _ttnLoginController.text = data['ttn_login'] ?? '';
        _isCertified = data['certified'] == 1;
      });
    } catch (_) {}
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _loadSignature() async {
    setState(() => _loading = true);
    try {
      final res = await api.getSignature();
      setState(() => _signature = res['signature']);
    } catch (_) {}
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _updateProfile() async {
    setState(() => _loading = true);
    try {
      await api.updateProfile({
        'name': _nameController.text.trim(),
        'phone': _phoneController.text.trim(),
        'address': _addressController.text.trim()
      });
      if (mounted) UiUtils.showSuccess(context, 'Profil mis à jour avec succès.');
    } catch (e) {
      if (mounted) UiUtils.showError(context, 'Échec de la mise à jour du profil.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _changePassword() async {
    if (_newPwdController.text != _confirmPwdController.text) {
      UiUtils.showError(context, 'Les mots de passe ne correspondent pas.');
      return;
    }
    if (_newPwdController.text.length < 8) {
      UiUtils.showError(context, 'Le nouveau mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setState(() => _loading = true);
    try {
      await api.changePassword(_currentPwdController.text, _newPwdController.text);
      if (mounted) {
        UiUtils.showSuccess(context, 'Mot de passe modifié avec succès.');
        _currentPwdController.clear(); _newPwdController.clear(); _confirmPwdController.clear();
      }
    } catch (e) {
      if (mounted) UiUtils.showError(context, 'Ancien mot de passe incorrect.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _certifyAccount() async {
    setState(() => _loading = true);
    try {
      await api.certifyAccount({
        'matricule_fiscale': _matriculeController.text.trim(),
        'adresse': _certAddressController.text.trim(),
        'ville': _villeController.text.trim(),
        'code_postal': _postalController.text.trim(),
        'ttn_login': _ttnLoginController.text.trim(),
        'ttn_password': _ttnPwdController.text.trim()
      });
      if (mounted) {
        UiUtils.showSuccess(context, 'Informations de certification enregistrées.');
        _isCertified = true;
        widget.onRefreshUser?.call();
      }
    } catch (e) {
      if (mounted) UiUtils.showError(context, 'Erreur lors de la certification TTN.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _createSignature() async {
    setState(() => _loading = true);
    try {
      final res = await api.createSignature();
      setState(() => _signature = res['signature']);
      if (mounted) UiUtils.showSuccess(context, 'Signature électronique générée avec succès.');
    } catch (e) {
      if (mounted) UiUtils.showError(context, 'Impossible de générer l\'empreinte numérique.');
    } finally { if (mounted) setState(() => _loading = false); }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFFF8FAFC),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
        children: [
          _buildHeader(),
          const SizedBox(height: 32),
          _buildContent(),
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
             Column(
               crossAxisAlignment: CrossAxisAlignment.start,
               children: [
                 Text(_title(widget.subPage), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF0247AA), letterSpacing: -1)),
                 Text(_subtitle(widget.subPage), style: const TextStyle(fontSize: 13, color: Color(0xFF64748B), fontWeight: FontWeight.w500)),
               ],
             ),
             if (_isCertified && widget.subPage == 'certification')
               const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 32),
          ],
        ),
      ],
    );
  }

  String _title(String s) {
    if (s == 'info') return 'Mon Identité';
    if (s == 'edit') return 'Édition Profil';
    if (s == 'password') return 'Sécurité';
    if (s == 'certification') return 'Certification';
    if (s == 'signature') return 'Signature HQ';
    return 'Profil';
  }

  String _subtitle(String s) {
    if (s == 'info') return 'Aperçu de vos accès sécurisés.';
    if (s == 'edit') return 'Maintenez vos données à jour.';
    if (s == 'password') return 'Protégez votre compte Medica-Sign.';
    if (s == 'certification') return 'Liaison avec les services TTN.';
    if (s == 'signature') return 'Empreinte numérique certifiée.';
    return '';
  }

  Widget _buildContent() {
    switch (widget.subPage) {
      case 'info': return _infoView();
      case 'edit': return _editView();
      case 'password': return _passwordView();
      case 'certification': return _certificationView();
      case 'signature': return _signatureView();
      default: return const Center(child: Text('...'));
    }
  }

  Widget _infoView() {
    bool isC = (widget.user?['is_certified'] ?? 0) == 1;
    return Column(
      children: [
        _section('PROFIL PROFESSIONNEL', [
          _infoRow(Icons.person_outline_rounded, 'Nom & Prénom', widget.user?['name']),
          _infoRow(Icons.alternate_email_rounded, 'Email de contact', widget.user?['email']),
          _infoRow(Icons.phone_iphone_rounded, 'Mobile GSM', widget.user?['phone']),
          _infoRow(Icons.map_outlined, 'Localisation Bureau', widget.user?['address']),
        ]),
        const SizedBox(height: 24),
        _section('AUTORISATIONS & ÉTAT', [
          _infoRow(Icons.vpn_lock_rounded, 'Rôle Système', widget.user?['role']),
          _infoRow(Icons.verified_user_rounded, 'Niveau de sécurité', isC ? 'Certifié Haute Qualité' : 'Standard'),
        ]),
        const SizedBox(height: 32),
        _primaryBtn('Mettre à jour le profil', () => widget.onNavigate?.call('Modifier profil')),
        const SizedBox(height: 12),
        _outlinedBtn('Sécuriser mon accès (Passe)', () => widget.onNavigate?.call('Changer mot de passe')),
      ],
    );
  }

  Widget _editView() {
    return _section('MODIFICATION DES DONNÉES', [
      _input('Nom complet', _nameController, Icons.person_rounded),
      _input('Téléphone mobile', _phoneController, Icons.phone_rounded),
      _input('Adresse physique', _addressController, Icons.location_on_rounded),
      const SizedBox(height: 24),
      _primaryBtn('Enregistrer les modifications', _updateProfile),
    ]);
  }

  Widget _passwordView() {
    return _section('CONTRÔLE D\'ACCÈS', [
      _input('Mot de passe actuel', _currentPwdController, Icons.lock_open_rounded, obscure: true),
      _input('Nouveau secret', _newPwdController, Icons.lock_outline_rounded, obscure: true),
      _input('Confirmation du secret', _confirmPwdController, Icons.verified_user_outlined, obscure: true),
      const SizedBox(height: 24),
      _primaryBtn('Confirmer le changement', _changePassword),
    ]);
  }

  Widget _certificationView() {
    return _section('DONNÉES TTN CERTIFIÉES', [
      _input('Matricule Fiscale', _matriculeController, Icons.business_rounded),
      _input('Siège Social', _certAddressController, Icons.apartment_rounded),
      Row(children: [
        Expanded(child: _input('Gouvernorat', _villeController, Icons.location_city_rounded)),
        const SizedBox(width: 12),
        Expanded(child: _input('Code Postal', _postalController, Icons.local_post_office_rounded)),
      ]),
      _input('Identifiant TTN API', _ttnLoginController, Icons.admin_panel_settings_rounded),
      _input('Clé TTN (Secret)', _ttnPwdController, Icons.password_rounded, obscure: true, hint: 'Laisser vide si inchangé'),
      const SizedBox(height: 24),
      _primaryBtn(_isCertified ? 'Actualiser la certification' : 'Lancer l\'enrôlement TTN', _certifyAccount),
    ]);
  }

  Widget _signatureView() {
    return _section('VOTRE EMPREINTE NUMÉRIQUE', [
      Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 40, horizontal: 20),
        decoration: BoxDecoration(color: const Color(0xFF0247AA), borderRadius: BorderRadius.circular(32), boxShadow: [BoxShadow(color: const Color(0xFF0247AA).withOpacity(0.2), blurRadius: 20, offset: const Offset(0, 10))]),
        child: Column(
          children: [
            const Icon(Icons.fingerprint_rounded, color: Colors.white, size: 64),
            const SizedBox(height: 24),
            const Text('EMPREINTE DE SIGNATURE', style: TextStyle(color: Colors.white, fontSize: 10, letterSpacing: 2, fontWeight: FontWeight.w900)),
            const SizedBox(height: 12),
            if (_signature == null)
              const Text('AUCUNE EMPREINTE', style: TextStyle(color: Colors.white30, fontSize: 24, fontWeight: FontWeight.w900))
            else
              Text(_signature!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, letterSpacing: 1)),
            const SizedBox(height: 48),
            const Divider(color: Colors.white10),
            const SizedBox(height: 16),
            const Text('AUTHENTIFIÉ PAR MEDICA-SIGN NETWORK', style: TextStyle(color: Colors.white38, fontSize: 8, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
      const SizedBox(height: 32),
      Row(children: [
        Expanded(child: OutlinedButton(onPressed: _loading ? null : _loadSignature, style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), foregroundColor: const Color(0xFF0247AA), side: const BorderSide(color: Color(0xFF0247AA))), child: const Text('ACTUALISER'))),
        const SizedBox(width: 12),
        Expanded(child: _primaryBtn('GÉNÉRER L\'EMPREINTE', _createSignature)),
      ]),
    ]);
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

  Widget _infoRow(IconData i, String l, dynamic v) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(children: [
        Container(padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(14)), child: Icon(i, color: const Color(0xFF0247AA), size: 20)),
        const SizedBox(width: 16),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(l, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF94A3B8))),
          Text(v?.toString() ?? '-', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF0247AA))),
        ]),
      ]),
    );
  }

  Widget _input(String label, TextEditingController ctrl, IconData i, {bool obscure = false, String? hint}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: ctrl,
        obscureText: obscure,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
        decoration: InputDecoration(
          prefixIcon: Icon(i, size: 20, color: const Color(0xFF94A3B8)),
          hintText: hint ?? label,
          filled: true, fillColor: const Color(0xFFF8FAFC),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFF0247AA), width: 2)),
        ),
      ),
    );
  }

  Widget _primaryBtn(String t, VoidCallback fn) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _loading ? null : fn,
        style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF0247AA), foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(vertical: 18), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
        child: _loading ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : Text(t, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _outlinedBtn(String t, VoidCallback fn) {
    return SizedBox(
      width: double.infinity,
      child: OutlinedButton(
        onPressed: _loading ? null : fn,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
          side: const BorderSide(color: Color(0xFF0247AA)),
          foregroundColor: const Color(0xFF0247AA),
        ),
        child: Text(t, style: const TextStyle(fontWeight: FontWeight.bold)),
      ),
    );
  }
}
