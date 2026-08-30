import 'package:isar_plus/isar_plus.dart';

part 'business_profile_model.g.dart';

@collection
class BusinessProfileModel {
  int id = 0; // Single instance, ID 0 always

  String? businessName;
  String? address;
  String? phone;
  String? email;
  String? logoPath;
  String? footerNote;
  int? brandColorValue; // Persisted brand color from logo

  // Tax ID or NINEA (common in Senegal/West Africa)
  String? taxId;

  BusinessProfileModel({
    this.businessName,
    this.address,
    this.phone,
    this.email,
    this.logoPath,
    this.footerNote,
    this.taxId,
    this.brandColorValue,
  });
}
