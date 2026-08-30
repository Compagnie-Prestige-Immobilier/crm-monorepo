import 'dart:math';

import 'generated/models/atelier.dart' as g;
import 'generated/models/client.dart';
import 'generated/models/contact.dart';
import 'generated/models/order.dart';
import 'generated/models/payment.dart';
import 'generated/models/review.dart';
import 'generated/models/user.dart' as g;

export 'generated/models/beneficiary.dart';
export 'generated/models/client.dart';
export 'generated/models/contact.dart';
export 'generated/models/order.dart';
export 'generated/models/payment.dart';
export 'generated/models/promotion.dart';
export 'generated/models/review.dart';

class Page<T> {
  const Page(this.items, this.hasMore);
  final List<T> items;
  final bool hasMore;
  factory Page.fromJson(Map<String, dynamic> j, T Function(Map<String, dynamic>) f) =>
      Page((j['data'] as List).cast<Map<String, dynamic>>().map(f).toList(), j['next_page_url'] != null);
}

class User {
  const User({required this.id, required this.name, required this.role, this.phone, this.email, this.atelier});
  final int id;
  final String name, role;
  final String? phone, email;
  final Atelier? atelier;
  String get identifier => phone ?? email ?? '';
  bool get isAtelier => role == 'atelier';
  factory User.fromJson(Map<String, dynamic> j) {
    final u = g.User.fromJson(j);
    return User(id: u.id, name: u.name, role: u.role ?? '', phone: u.phone, email: u.email, atelier: j['atelier'] == null ? null : Atelier.fromJson(j['atelier']));
  }
  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'role': role, 'phone': phone, 'email': email, 'atelier': atelier?.raw};
}

// Garde le JSON brut : le wizard et le profil renvoient logo_path/cover_path tels quels.
class Atelier {
  Atelier(this.raw) : _g = g.Atelier.fromJson(raw);
  final Map<String, dynamic> raw;
  final g.Atelier _g;
  int get id => _g.id;
  String get name => _g.name;
  String? get description => _g.description;
  String? get phone => _g.phone;
  String? get region => _g.region;
  String? get address => _g.address;
  String? get registreCommerce => _g.registreCommerce;
  double? get latitude => _g.latitude?.toDouble();
  double? get longitude => _g.longitude?.toDouble();
  List<String> get specialties => _g.specialties;
  String? get logoUrl => _g.logoUrl;
  String? get coverUrl => _g.coverUrl;
  String? get logoThumbUrl => raw['logo_thumb_url'] as String? ?? logoUrl;
  String? get coverThumbUrl => raw['cover_thumb_url'] as String? ?? coverUrl;
  String? get tiktok => _g.tiktok;
  String? get instagram => _g.instagram;
  String? get facebook => _g.facebook;
  int get wizardStep => _g.wizardStep;
  bool get completed => _g.completedAt != null;
  bool get verified => _g.verifiedAt != null;
  String? get verificationNote => raw['verification_note'] as String?;
  double? get distanceKm => _g.distanceKm?.toDouble();
  double? get rating => double.tryParse(_g.reviewsAvgRating ?? '');
  int get reviewsCount => _g.reviewsCount;
  bool get isFavorite => _g.isFavorite;
  List<String> get photos => _g.photos.map((p) => p.url).toList();
  // Lu dans le JSON brut : le modèle généré ignore thumb_url.
  List<Map<String, dynamic>> get photoRows => (raw['photos'] as List?)?.cast<Map<String, dynamic>>() ?? const [];
  List<String> get photoThumbs => [for (final p in photoRows) (p['thumb_url'] ?? p['url']) as String];
  List<Review> get reviews => _g.reviews;
  factory Atelier.fromJson(Map<String, dynamic> j) => Atelier(j);
}

// Le modèle généré jette les clés inconnues : le JSON reste à côté de la commande et du client.
final _orderJson = Expando<Map<String, dynamic>>();
final _clientJson = Expando<Map<String, dynamic>>();

/// La liste des commandes n'envoie que `id` et `label` du bénéficiaire, que le modèle généré refuserait.
/// Un montant encore inconnu vaut 0 dans le modèle ; `hasTotal` dit s'il a été fixé.
Order decodeOrder(Map<String, dynamic> j) {
  final o = Order.fromJson({...j, 'beneficiary': null, 'total_cfa': j['total_cfa'] ?? 0, 'remaining_cfa': j['remaining_cfa'] ?? 0});
  _orderJson[o] = j;
  return o;
}

Client decodeClient(Map<String, dynamic> j) {
  final c = Client.fromJson(j);
  _clientJson[c] = j;
  return c;
}

extension OrderX on Order {
  bool get isLate => isOpen && daysUntil(dueAt) < 0;
  bool get isOpen => status == 'en_cours' || status == 'pret';
  String get clientName => client?.name ?? '';
  String? get clientPhone => client?.phone;
  Map<String, dynamic>? get raw => _orderJson[this];
  String? get beneficiaryLabel => (raw?['beneficiary'] as Map?)?['label'] as String? ?? beneficiary?.label;
  String? get measurementsPhotoPath => raw?['measurements_photo_path'] as String?;
  String? get measurementsPhotoUrl => raw?['measurements_photo_url'] as String?;
  String? get voiceNotePath => raw?['voice_note_path'] as String?;
  String? get voiceNoteUrl => raw?['voice_note_url'] as String?;
  DateTime? get deliveredAt => DateTime.tryParse((raw?['delivered_at'] ?? '').toString())?.toLocal();
  /// Le montant reste facultatif tant que la commande n'est pas livrée.
  bool get hasTotal => raw?['total_cfa'] != null;
  /// Depuis combien de jours la commande est prête, d'après sa dernière mise à jour.
  int get readyDays => status != 'pret' || updatedAt == null ? 0 : DateTime.now().difference(updatedAt!).inDays;

  List<Payment> get paymentsChrono => [...payments]..sort((a, b) => a.at == b.at ? a.id.compareTo(b.id) : a.at.compareTo(b.at));
  /// L'API refuse de corriger une correction ; le journal brut porte `correction_of`.
  bool isCorrection(Payment p) => p.amountCfa < 0 || (raw?['payments'] as List? ?? const []).any((r) => (r as Map)['id'] == p.id && r['correction_of'] != null);
}

extension ClientX on Client {
  DateTime? get lastOrderAt => DateTime.tryParse((_clientJson[this]?['last_order_at'] ?? '').toString())?.toLocal();
}

extension PaymentX on Payment {
  DateTime get at => createdAt;
}

// Le modèle généré jette les clés inconnues : le JSON reste à côté du contact, pour la vignette de l'atelier.
final _contactJson = Expando<Map<String, dynamic>>();

Contact decodeContact(Map<String, dynamic> j) {
  final c = Contact.fromJson(j);
  _contactJson[c] = j;
  return c;
}

extension ContactX on Contact {
  DateTime get at => createdAt;
  bool get handled => handledAt != null;
  String get atelierName => atelier?.name ?? '';
  String? get atelierCover => (_contactJson[this]?['atelier'] as Map?)?['cover_thumb_url'] as String? ?? atelier?.coverUrl;
  String? get region => atelier?.region;
  String get userName => user?.name ?? '';
  String? get userPhone => user?.phone;
}

extension ReviewX on Review {
  DateTime get at => createdAt;
  String get userName => user?.name ?? '';
}

DateTime today() { final n = DateTime.now(); return DateTime(n.year, n.month, n.day); }

/// Nombre de jours calendaires jusqu'à [d] : négatif si la date est passée.
int daysUntil(DateTime d) => DateTime(d.year, d.month, d.day).difference(today()).inDays;

/// Clé d'idempotence : renvoyée à l'identique en cas de réessai, l'API rend l'enregistrement déjà créé.
String clientToken() => '${DateTime.now().microsecondsSinceEpoch}-${Random().nextInt(1 << 32)}';

const regions = ['Dakar', 'Diourbel', 'Fatick', 'Kaffrine', 'Kaolack', 'Kédougou', 'Kolda', 'Louga', 'Matam', 'Saint-Louis', 'Sédhiou', 'Tambacounda', 'Thiès', 'Ziguinchor'];
const specialties = {'homme': 'Homme', 'femme': 'Femme', 'enfant': 'Enfant'};
const orderStatuses = {'en_cours': 'En cours', 'pret': 'Prêt', 'livre': 'Livré', 'annule': 'Annulé'};
