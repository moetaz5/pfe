import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:async';
import 'api_service.dart';
import 'package:universal_io/io.dart';

/// Service pour gérer les notifications système réelles
class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  static final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  
  static final ValueNotifier<int> unreadCount = ValueNotifier<int>(0);
  
  static Timer? _backgroundListener;
  static bool _isListening = false;
  static Set<int> _processedNotifIds = {};
  static const String _kProcessedIdsKey = 'notif_processed_ids';

  /// Initialise le service de notifications au démarrage
  static Future<void> initialize() async {
    const AndroidInitializationSettings initializationSettingsAndroid =
        AndroidInitializationSettings('@mipmap/launcher_icon');
    
    const InitializationSettings initializationSettings = InitializationSettings(
        android: initializationSettingsAndroid,
    );

    await _notificationsPlugin.initialize(
      initializationSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        debugPrint('Notification cliquée: ${response.payload}');
      },
    );

    // Charger les IDs déjà traités depuis le stockage
    final prefs = await SharedPreferences.getInstance();
    final savedIds = prefs.getStringList(_kProcessedIdsKey) ?? [];
    _processedNotifIds = savedIds.map((id) => int.parse(id)).toSet();

    debugPrint('🔔 NotificationService initialisé avec ${_processedNotifIds.length} IDs connus');
    _startBackgroundListener();
  }

  /// ✅ NEW: Affiche une vraie notification dans la barre système
  static Future<void> showLocalNotification({
    required int id,
    required String title,
    required String body,
    String? payload,
  }) async {
    const AndroidNotificationDetails androidPlatformChannelSpecifics =
        AndroidNotificationDetails(
      'medicasign_notifications',
      'Médica-Sign Alertes',
      channelDescription: 'Notifications pour les signatures et jetons',
      importance: Importance.max,
      priority: Priority.high,
      showWhen: true,
      enableVibration: true,
      playSound: true,
      styleInformation: BigTextStyleInformation(''),
    );
    
    const NotificationDetails platformChannelSpecifics =
        NotificationDetails(android: androidPlatformChannelSpecifics);
    
    await _notificationsPlugin.show(
      id,
      title,
      body,
      platformChannelSpecifics,
      payload: payload,
    );
  }

  /// Démarre un listener persistant en arrière-plan
  static void _startBackgroundListener() {
    if (_isListening) return;
    _isListening = true;
    
    // Polling plus rapide (10s) pour plus de réactivité comme demandé
    _backgroundListener = Timer.periodic(const Duration(seconds: 10), (_) async {
      try {
        final prefs = await SharedPreferences.getInstance();
        final hasSession = prefs.getBool('has_session') ?? false;
        if (!hasSession) return;

        // Récupérer les notifications depuis le serveur
        final notifList = await ApiService().getNotifications();
        
        // Mettre à jour le compteur global (seulement les non lues)
        final unreadNotifs = notifList.where((n) => n['is_read'] == 0).toList();
        unreadCount.value = unreadNotifs.length;
        
        bool newlyAdded = false;
        for (var notif in unreadNotifs) {
          final id = notif['id'] as int;
          
          if (!_processedNotifIds.contains(id)) {
            // Afficher dans la barre système
            await showLocalNotification(
              id: id,
              title: notif['title'] ?? 'Nouveau message',
              body: notif['message'] ?? '',
              payload: id.toString(),
            );
            
            _processedNotifIds.add(id);
            newlyAdded = true;
          }
        }

        // Sauvegarder si de nouveaux IDs ont été traités
        if (newlyAdded) {
          // On garde les 100 IDs les plus récents pour éviter que la liste ne s'allonge indéfiniment
          final listToSave = _processedNotifIds.toList();
          if (listToSave.length > 100) {
            listToSave.removeRange(0, listToSave.length - 100);
          }
          await prefs.setStringList(
            _kProcessedIdsKey, 
            listToSave.map((id) => id.toString()).toList(),
          );
        }
      } catch (e) {
        // Silencieux pour ne pas polluer les logs en arrière-plan
        if (e.toString().contains('401')) {
          _isListening = false;
          _backgroundListener?.cancel();
        }
      }
    });
  }

  /// Force le rafraîchissement immédiat des notifications
  static Future<void> refreshNotifications() async {
    try {
      final notifList = await ApiService().getNotifications();
      unreadCount.value = notifList.where((n) => n['is_read'] == 0).length;
    } catch (e) {
      debugPrint('⚠️ Erreur refresh notifs: $e');
    }
  }

  /// Demande la permission réelle du système Android/iOS
  static Future<void> requestPermissionIfNeeded(BuildContext context) async {
    if (Platform.isAndroid) {
      final AndroidFlutterLocalNotificationsPlugin? androidImplementation =
          _notificationsPlugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        await androidImplementation.requestNotificationsPermission();
      }
    }
    
    debugPrint('✅ Demande de permission système effectuée');
  }

  /// Teste une notification immédiatement
  static Future<void> sendTestNotification(BuildContext context) async {
    await showLocalNotification(
      id: 999,
      title: 'Test de Notification',
      body: 'Ceci est une notification réelle dans votre barre système !',
    );
  }
}
