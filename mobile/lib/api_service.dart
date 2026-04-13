import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'main.dart';

class ApiService {
  static String get baseUrl {
    // Le serveur est maintenant hébergé sur le VPS OVH.
    return 'https://medicasign.medicacom.tn/api';
  }

  static String get googleAuthUrl => '$baseUrl/auth/google';

  static ApiService? _instance;
  final Dio _dio;
  final CookieJar? _cookieJar;
  String? _token;

  ApiService._(this._dio, this._cookieJar);

  factory ApiService() {
    if (_instance == null) {
      final dio = Dio(BaseOptions(
        baseUrl: baseUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 10),
      ));

      CookieJar? cookieJar;
      if (kIsWeb) {
        dio.options.extra['withCredentials'] = true;
      } else {
        cookieJar = CookieJar();
        dio.interceptors.add(CookieManager(cookieJar));
      }

      // Intercepteur pour injecter le token
      dio.interceptors.add(InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _instance?._token;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            final prefs = await SharedPreferences.getInstance();
            await prefs.remove('has_session');
            await prefs.remove('session_token');
            _instance?._token = null;
            MyApp.navigatorKey.currentState?.pushNamedAndRemoveUntil('/login', (route) => false);
          }
          return handler.next(e);
        },
      ));

      _instance = ApiService._(dio, cookieJar);
      // On charge le token de manière asynchrone, mais on ne l'écrase que s'il n'a pas été défini entre-temps
      SharedPreferences.getInstance().then((p) {
        final savedToken = p.getString('session_token');
        if (_instance!._token == null && savedToken != null) {
          _instance!._token = savedToken;
        }
      });
    }
    return _instance!;
  }

  void setToken(String token) {
    _token = token;
    // Injection du token dans le CookieJar pour les flux qui l'exigent (ex: Google Auth)
    if (_cookieJar != null) {
      final uri = Uri.parse(baseUrl);
      // On définit le cookie 'token'
      _cookieJar!.saveFromResponse(uri, [
        Cookie('token', token)..path = '/'..httpOnly = true
      ]);
    }
  }


  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _dio.post('/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        _token = response.data['token'];
        final prefs = await SharedPreferences.getInstance();
        if (_token != null) {
          await prefs.setString('session_token', _token!);
          await prefs.setBool('has_session', true);
        }

        // On appelle getCurrentUser APRÈS avoir défini le token pour tester l'intercepteur
        final user = await getCurrentUser();
        return user;
      }

      throw Exception(response.data['message'] ?? 'Erreur de connexion');
    } on DioException catch (err) {
      if (err.response?.statusCode == 403 && err.response?.data is Map && err.response?.data['code'] == 'EMAIL_NOT_VERIFIED') {
        throw Exception('EMAIL_NOT_VERIFIED:${err.response?.data['email'] ?? ''}');
      }

      throw Exception(err.response?.data['message'] ?? 'Erreur de connexion');
    }
  }

  Future<Map<String, dynamic>> loginWithGoogle(String idToken) async {
    try {
      final response = await _dio.post('/auth/google-mobile', data: {'id_token': idToken});
      if (response.statusCode == 200) {
        final prefs = await SharedPreferences.getInstance();
        final token = response.data['token'];
        if (token != null) {
          _token = token;
          await prefs.setString('session_token', token);
        }
        await prefs.setBool('has_session', true);
        return Map<String, dynamic>.from(response.data);
      }
      throw Exception(response.data['message'] ?? 'Erreur Google Sign-In');
    } on DioException catch (err) {
      throw Exception(err.response?.data['message'] ?? 'Erreur Google Sign-In');
    }
  }

  Future<Map<String, dynamic>> register(String name, String email, String password, String phone, String address) async {
    if (name.trim().split(' ').length < 2) {
      throw Exception('Veuillez entrer votre nom complet (Prénom et Nom).');
    }

    if (password.length < 8) {
      throw Exception('Le mot de passe doit contenir au moins 8 caractères.');
    }

    final response = await _dio.post('/auth/register', data: {
      'name': name.trim(),
      'email': email.trim(),
      'password': password,
      'phone': phone.trim(),
      'address': address.trim(),
    });

    if (response.statusCode == 200 || response.statusCode == 201) {
      return response.data;
    }

    throw Exception(response.data['message'] ?? 'Erreur d\'inscription');
  }

  Future<Map<String, dynamic>> getCurrentUser() async {
    final response = await _dio.get('/auth/me');
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(response.data);
    }
    throw Exception('Impossible de récupérer les informations utilisateur');
  }

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('has_session');
      await prefs.remove('session_token');
      _token = null;
      if (_cookieJar != null) {
        await _cookieJar!.deleteAll();
      }
    } catch (_) {
      // Ignore
    }
  }

  Future<Map<String, dynamic>> getDashboardStats() async {
    final response = await _dio.get('/dashboard/stats');
    if (response.statusCode == 200) {
      return Map<String, dynamic>.from(response.data);
    }
    throw Exception('Erreur récupération stats');
  }

  Future<void> resendVerificationCode(String email) async {
    final response = await _dio.post('/auth/resend-verification-code', data: {'email': email});
    if (response.statusCode != 200) {
      throw Exception(response.data['message'] ?? 'Erreur envoi code de vérification');
    }
  }

  Future<void> verifyEmail(String email, String code) async {
    final response = await _dio.post('/auth/verify-email', data: {'email': email, 'code': code});
    if (response.statusCode != 200) {
      throw Exception(response.data['message'] ?? 'Code invalide');
    }
  }

  /* --- AUTH / PASSWORD RESET --- */
  Future<void> forgotPassword(String email) async {
    await _dio.post('/auth/forgot-password', data: {'email': email});
  }

  Future<void> verifyResetCode(String email, String code) async {
    await _dio.post('/auth/verify-reset-code', data: {'email': email, 'code': code});
  }

  Future<void> resetPassword(String email, String code, String newPassword) async {
    await _dio.post('/auth/reset-password', data: {'email': email, 'code': code, 'newPassword': newPassword});
  }

  /* --- NOTIFICATIONS --- */
  Future<List<dynamic>> getNotifications() async {
    final response = await _dio.get('/notifications');
    return response.data as List;
  }

  Future<void> markNotificationRead(int id) async {
    await _dio.put('/notifications/$id/read');
  }

  Future<void> markAllNotificationsRead() async {
    await _dio.put('/notifications/read-all');
  }

  Future<void> deleteNotification(int id) async {
    await _dio.delete('/notifications/$id');
  }

  /* --- PROFILE --- */
  Future<Map<String, dynamic>> updateProfile(Map<String, dynamic> data) async {
    final response = await _dio.put('/auth/profile', data: data);
    return response.data;
  }

  Future<Map<String, dynamic>> changePassword(String currentPassword, String newPassword) async {
    final response = await _dio.post('/auth/change-password', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
    return response.data;
  }

  Future<Map<String, dynamic>> getCertificationInfo() async {
    final response = await _dio.get('/auth/certification-info');
    return response.data;
  }

  Future<Map<String, dynamic>> certifyAccount(Map<String, dynamic> data) async {
    final response = await _dio.post('/auth/certify', data: data);
    return response.data;
  }

  /* --- SIGNATURE --- */
  Future<Map<String, dynamic>> getSignature() async {
    final response = await _dio.get('/auth/signature');
    return response.data;
  }

  Future<Map<String, dynamic>> createSignature() async {
    final response = await _dio.post('/auth/signature');
    return response.data;
  }

  /* --- ORGANIZATIONS --- */
  Future<List<dynamic>> getMyOrganizations() async {
    final response = await _dio.get('/organizations/mine');
    return response.data as List;
  }

  Future<Map<String, dynamic>> createOrganization(Map<String, dynamic> data) async {
    final response = await _dio.post('/organizations', data: data);
    return response.data;
  }

  Future<Map<String, dynamic>> getOrganizationDetail(int id) async {
    final response = await _dio.get('/organizations/$id');
    return response.data;
  }

  Future<void> updateOrganization(int id, Map<String, dynamic> data) async {
    await _dio.put('/organizations/$id', data: data);
  }

  Future<void> deleteOrganization(int id) async {
    await _dio.delete('/organizations/$id');
  }

  Future<void> leaveOrganization(int id) async {
    await _dio.delete('/organizations/$id/leave');
  }

  Future<Map<String, dynamic>> inviteToOrganization(int id, String email) async {
    final response = await _dio.post('/organizations/$id/invite', data: {'email': email});
    return response.data;
  }

  Future<void> removeMemberFromOrganization(int id, int userId) async {
    await _dio.delete('/organizations/$id/member/$userId');
  }

  Future<List<dynamic>> getOrganizationTransactions(int id) async {
    final response = await _dio.get('/organizations/$id/transactions');
    return response.data as List;
  }

  /* --- TRANSACTIONS --- */
  Future<List<dynamic>> getMyTransactions() async {
    final response = await _dio.get('/transactions');
    return response.data as List;
  }

  Future<void> deleteTransaction(int id) async {
    await _dio.delete('/transactions/$id');
  }

  Future<Map<String, dynamic>> getTransactionDetails(int id) async {
    final response = await _dio.get('/transactions/$id/details');
    return response.data;
  }

  Future<List<dynamic>> getTransactionDocs(int id) async {
    final response = await _dio.get('/transactions/$id/docs');
    return response.data as List;
  }

  Future<void> resendToTTN(int id) async {
    await _dio.post('/resend-ttn', data: {'transaction_id': id});
  }

  /* --- FACTURES --- */
  Future<List<dynamic>> getMyFactures() async {
    final response = await _dio.get('/my-transaction-factures');
    return response.data as List;
  }

  String getFacturePdfUrl(int id) {
    return '$baseUrl/my-transaction-factures/$id/pdf${_token != null ? "?token=$_token" : ""}';
  }

  String getTransactionZipUrl(int id) {
    return '$baseUrl/transactions/$id/zip${_token != null ? "?token=$_token" : ""}';
  }

  /* --- SUPPORT --- */
  Future<void> contactSupport(Map<String, dynamic> data) async {
    await _dio.post('/support/contact', data: data);
  }

  /* --- TOKENS --- */
  Future<void> buyTokens(Map<String, dynamic> data) async {
    await _dio.post('/jeton', data: data);
  }

  Future<void> submitPaymentProof(Map<String, dynamic> data) async {
    await _dio.post('/jeton/proof', data: data);
  }

  Future<List<dynamic>> getMyTokenRequests() async {
    final response = await _dio.get('/jeton/mine');
    return response.data as List;
  }

  Future<void> uploadPaymentProof(int requestId, dynamic file) async {
    // For mobile/web file upload with Dio
    // file is usually a MultipartFile
    final formData = FormData.fromMap({
      'payment_proof': file,
    });
    await _dio.put('/jeton/$requestId/payment-proof', data: formData);
  }

  String getTokenRequestProofUrl(int requestId) {
    return '$baseUrl/jeton/$requestId/proof${_token != null ? "?token=$_token" : ""}';
  }

  /* --- DEVELOPER (API TOKEN) --- */
  Future<String?> getApiToken() async {
    final response = await _dio.get('/my-api-token');
    return response.data['apiToken'];
  }

  Future<String> generateApiToken() async {
    final response = await _dio.post('/generate-api-token');
    return response.data['apiToken'];
  }

  Future<String> regenerateApiToken() async {
    final response = await _dio.post('/regenerate-api-token');
    return response.data['apiToken'];
  }

  /* --- STATISTICS --- */

  Future<Map<String, dynamic>> getUserStatistics() async {
    final response = await _dio.get('/statistiquesUSER');
    return response.data;
  }

  Future<Map<String, dynamic>> getAdminStats() async {
    final response = await _dio.get('/statistiqueadmin');
    return response.data;
  }

  /* --- ADMIN - USERS --- */
  Future<List<dynamic>> adminGetUsers({String name = '', String email = '', String phone = ''}) async {
    final response = await _dio.get('/admin/users', queryParameters: {'name': name, 'email': email, 'phone': phone});
    return response.data;
  }

  Future<void> adminUpdateUserRole(int userId, String role) async {
    await _dio.put('/admin/users/$userId/role', data: {'role': role});
  }

  Future<void> adminUpdateUserStatus(int userId, bool isActive) async {
    await _dio.put('/admin/users/$userId/status', data: {'statut': isActive ? 1 : 0});
  }

  Future<void> adminUpdateUserInfo(int userId, Map<String, dynamic> data) async {
    await _dio.put('/admin/users/$userId', data: data);
  }

  Future<void> adminChangeUserPassword(int userId, String newPassword) async {
    await _dio.put('/admin/users/$userId/password', data: {'newPassword': newPassword});
  }

  Future<void> adminDeleteUser(int userId) async {
    await _dio.delete('/admin/users/$userId');
  }

  /* --- ADMIN - TRANSACTIONS --- */
  Future<List<dynamic>> adminGetAllTransactions() async {
    final response = await _dio.get('/admin/transactions/all');
    return response.data;
  }

  /* --- ADMIN - ORGANIZATIONS --- */
  Future<List<dynamic>> adminGetAllOrganizations() async {
    final response = await _dio.get('/admin/organizations/all');
    return response.data;
  }

  Future<void> adminDeleteOrganization(int orgId) async {
    await _dio.delete('/admin/organizations/$orgId');
  }

  /* --- ADMIN - API ROUTES --- */
  Future<List<dynamic>> adminGetRoutes() async {
    final response = await _dio.get('/admin/routes');
    return response.data['routes'];
  }

  /* --- ADMIN - TOKEN REQUESTS --- */
  Future<List<dynamic>> adminGetTokenRequests({String? status}) async {
    final response = await _dio.get('/admin/jeton', queryParameters: status != null ? {'status': status} : null);
    return response.data;
  }

  Future<void> adminTokenDecision(int requestId, String decision, {String? note}) async {
    await _dio.put('/admin/jeton/$requestId/decision', data: {
      'decision': decision,
      'admin_note': note,
    });
  }

  String getTokenProofUrl(int requestId) {
    return '$baseUrl/admin/jeton/$requestId/proof${_token != null ? "?token=$_token" : ""}';
  }

  /* --- FCM / PUSH NOTIFICATIONS --- */
  /// Enregistre le token FCM de l'utilisateur auprès du serveur
  Future<void> registerFCMToken(String fcmToken) async {
    try {
      final response = await _dio.post('/notifications/register-fcm', data: {
        'fcm_token': fcmToken,
        'device_name': 'mobile_app',
      });
      if (response.statusCode == 200) {
        debugPrint('✅ Token FCM enregistré avec succès');
      }
    } catch (e) {
      debugPrint('⚠️ Erreur lors de l\'enregistrement du token FCM: $e');
    }
  }

  /// Envoie une notification de test
  Future<void> sendTestNotification() async {
    try {
      final response = await _dio.post('/notifications/test');
      if (response.statusCode == 200) {
        debugPrint('✅ Notification de test envoyée');
      }
    } catch (e) {
      throw Exception('Erreur lors de l\'envoi de notification de test: $e');
    }
  }

  /// Met à jour les préférences de notification
  Future<void> updateNotificationPreferences(Map<String, bool> preferences) async {
    try {
      await _dio.put('/notifications/preferences', data: preferences);
      debugPrint('✅ Préférences de notification mises à jour');
    } catch (e) {
      debugPrint('⚠️ Erreur mise à jour préférences: $e');
    }
  }
}
