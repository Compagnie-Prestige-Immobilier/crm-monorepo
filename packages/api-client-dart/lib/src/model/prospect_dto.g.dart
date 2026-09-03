// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'prospect_dto.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ProspectDtoCWProxy {
  ProspectDto id(String id);

  ProspectDto nom(String nom);

  ProspectDto prenom(String prenom);

  ProspectDto phoneE164(String phoneE164);

  ProspectDto rev(num rev);

  ProspectDto statut(ProspectStatut statut);

  ProspectDto projet(Projet projet);

  ProspectDto banqueId(String? banqueId);

  ProspectDto banqueName(String? banqueName);

  ProspectDto syndicatId(String? syndicatId);

  ProspectDto syndicatSigle(String? syndicatSigle);

  ProspectDto representantId(String? representantId);

  ProspectDto representantName(String? representantName);

  ProspectDto representantPhoneE164(String? representantPhoneE164);

  ProspectDto departementId(String? departementId);

  ProspectDto departementName(String? departementName);

  ProspectDto ownedByCommercialId(String ownedByCommercialId);

  ProspectDto ownedByCommercialName(String ownedByCommercialName);

  ProspectDto type(ProspectType? type);

  ProspectDto profession(String? profession);

  ProspectDto professionId(String? professionId);

  ProspectDto professionIsTeaching(bool? professionIsTeaching);

  ProspectDto incomeBandId(String? incomeBandId);

  ProspectDto incomeBandLabel(String? incomeBandLabel);

  ProspectDto paymentMode(PaymentMode? paymentMode);

  ProspectDto employeurId(String? employeurId);

  ProspectDto employeur(String? employeur);

  ProspectDto typeContrat(TypeContrat? typeContrat);

  ProspectDto ancienneteMois(num? ancienneteMois);

  ProspectDto lieuActivite(String? lieuActivite);

  ProspectDto modeEpargne(ModeEpargne? modeEpargne);

  ProspectDto paysResidenceId(String? paysResidenceId);

  ProspectDto paysResidenceLabel(String? paysResidenceLabel);

  ProspectDto villeResidence(String? villeResidence);

  ProspectDto whatsappE164(String? whatsappE164);

  ProspectDto relaisNom(String? relaisNom);

  ProspectDto relaisPhoneE164(String? relaisPhoneE164);

  ProspectDto journeys(List<ProspectJourneyDto> journeys);

  ProspectDto dureeSystemeMois(num? dureeSystemeMois);

  ProspectDto canalProvenanceId(String? canalProvenanceId);

  ProspectDto canalProvenanceLabel(String? canalProvenanceLabel);

  ProspectDto segment(BddSegment? segment);

  ProspectDto phase2Status(Phase2Status phase2Status);

  ProspectDto enrollmentMethod(EnrollmentMethod? enrollmentMethod);

  ProspectDto enrollmentCapturedById(String? enrollmentCapturedById);

  ProspectDto enrollmentCapturedByName(String? enrollmentCapturedByName);

  ProspectDto enrollmentCapturedAt(DateTime? enrollmentCapturedAt);

  ProspectDto lastOutcome(CallOutcome? lastOutcome);

  ProspectDto lastComment(String? lastComment);

  ProspectDto lastAttemptAt(DateTime? lastAttemptAt);

  ProspectDto callAttemptCount(num callAttemptCount);

  ProspectDto lastCallOutcome(CallOutcome? lastCallOutcome);

  ProspectDto lastCallAt(DateTime? lastCallAt);

  ProspectDto lastCallById(String? lastCallById);

  ProspectDto lastCallByName(String? lastCallByName);

  ProspectDto origin(String? origin);

  ProspectDto originLabel(String? originLabel);

  ProspectDto clientCreatedAt(DateTime clientCreatedAt);

  ProspectDto createdAt(DateTime createdAt);

  ProspectDto updatedAt(DateTime updatedAt);

  ProspectDto deletedAt(DateTime? deletedAt);

  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectDto call({
    String id,
    String nom,
    String prenom,
    String phoneE164,
    num rev,
    ProspectStatut statut,
    Projet projet,
    String? banqueId,
    String? banqueName,
    String? syndicatId,
    String? syndicatSigle,
    String? representantId,
    String? representantName,
    String? representantPhoneE164,
    String? departementId,
    String? departementName,
    String ownedByCommercialId,
    String ownedByCommercialName,
    ProspectType? type,
    String? profession,
    String? professionId,
    bool? professionIsTeaching,
    String? incomeBandId,
    String? incomeBandLabel,
    PaymentMode? paymentMode,
    String? employeurId,
    String? employeur,
    TypeContrat? typeContrat,
    num? ancienneteMois,
    String? lieuActivite,
    ModeEpargne? modeEpargne,
    String? paysResidenceId,
    String? paysResidenceLabel,
    String? villeResidence,
    String? whatsappE164,
    String? relaisNom,
    String? relaisPhoneE164,
    List<ProspectJourneyDto> journeys,
    num? dureeSystemeMois,
    String? canalProvenanceId,
    String? canalProvenanceLabel,
    BddSegment? segment,
    Phase2Status phase2Status,
    EnrollmentMethod? enrollmentMethod,
    String? enrollmentCapturedById,
    String? enrollmentCapturedByName,
    DateTime? enrollmentCapturedAt,
    CallOutcome? lastOutcome,
    String? lastComment,
    DateTime? lastAttemptAt,
    num callAttemptCount,
    CallOutcome? lastCallOutcome,
    DateTime? lastCallAt,
    String? lastCallById,
    String? lastCallByName,
    String? origin,
    String? originLabel,
    DateTime clientCreatedAt,
    DateTime createdAt,
    DateTime updatedAt,
    DateTime? deletedAt,
  });
}

/// Proxy class for `copyWith` functionality. This is a callable class and can be used as follows: `instanceOfProspectDto.copyWith(...)`. Additionally contains functions for specific fields e.g. `instanceOfProspectDto.copyWith.fieldName(...)`
class _$ProspectDtoCWProxyImpl implements _$ProspectDtoCWProxy {
  const _$ProspectDtoCWProxyImpl(this._value);

  final ProspectDto _value;

  @override
  ProspectDto id(String id) => this(id: id);

  @override
  ProspectDto nom(String nom) => this(nom: nom);

  @override
  ProspectDto prenom(String prenom) => this(prenom: prenom);

  @override
  ProspectDto phoneE164(String phoneE164) => this(phoneE164: phoneE164);

  @override
  ProspectDto rev(num rev) => this(rev: rev);

  @override
  ProspectDto statut(ProspectStatut statut) => this(statut: statut);

  @override
  ProspectDto projet(Projet projet) => this(projet: projet);

  @override
  ProspectDto banqueId(String? banqueId) => this(banqueId: banqueId);

  @override
  ProspectDto banqueName(String? banqueName) => this(banqueName: banqueName);

  @override
  ProspectDto syndicatId(String? syndicatId) => this(syndicatId: syndicatId);

  @override
  ProspectDto syndicatSigle(String? syndicatSigle) =>
      this(syndicatSigle: syndicatSigle);

  @override
  ProspectDto representantId(String? representantId) =>
      this(representantId: representantId);

  @override
  ProspectDto representantName(String? representantName) =>
      this(representantName: representantName);

  @override
  ProspectDto representantPhoneE164(String? representantPhoneE164) =>
      this(representantPhoneE164: representantPhoneE164);

  @override
  ProspectDto departementId(String? departementId) =>
      this(departementId: departementId);

  @override
  ProspectDto departementName(String? departementName) =>
      this(departementName: departementName);

  @override
  ProspectDto ownedByCommercialId(String ownedByCommercialId) =>
      this(ownedByCommercialId: ownedByCommercialId);

  @override
  ProspectDto ownedByCommercialName(String ownedByCommercialName) =>
      this(ownedByCommercialName: ownedByCommercialName);

  @override
  ProspectDto type(ProspectType? type) => this(type: type);

  @override
  ProspectDto profession(String? profession) => this(profession: profession);

  @override
  ProspectDto professionId(String? professionId) =>
      this(professionId: professionId);

  @override
  ProspectDto professionIsTeaching(bool? professionIsTeaching) =>
      this(professionIsTeaching: professionIsTeaching);

  @override
  ProspectDto incomeBandId(String? incomeBandId) =>
      this(incomeBandId: incomeBandId);

  @override
  ProspectDto incomeBandLabel(String? incomeBandLabel) =>
      this(incomeBandLabel: incomeBandLabel);

  @override
  ProspectDto paymentMode(PaymentMode? paymentMode) =>
      this(paymentMode: paymentMode);

  @override
  ProspectDto employeurId(String? employeurId) =>
      this(employeurId: employeurId);

  @override
  ProspectDto employeur(String? employeur) => this(employeur: employeur);

  @override
  ProspectDto typeContrat(TypeContrat? typeContrat) =>
      this(typeContrat: typeContrat);

  @override
  ProspectDto ancienneteMois(num? ancienneteMois) =>
      this(ancienneteMois: ancienneteMois);

  @override
  ProspectDto lieuActivite(String? lieuActivite) =>
      this(lieuActivite: lieuActivite);

  @override
  ProspectDto modeEpargne(ModeEpargne? modeEpargne) =>
      this(modeEpargne: modeEpargne);

  @override
  ProspectDto paysResidenceId(String? paysResidenceId) =>
      this(paysResidenceId: paysResidenceId);

  @override
  ProspectDto paysResidenceLabel(String? paysResidenceLabel) =>
      this(paysResidenceLabel: paysResidenceLabel);

  @override
  ProspectDto villeResidence(String? villeResidence) =>
      this(villeResidence: villeResidence);

  @override
  ProspectDto whatsappE164(String? whatsappE164) =>
      this(whatsappE164: whatsappE164);

  @override
  ProspectDto relaisNom(String? relaisNom) => this(relaisNom: relaisNom);

  @override
  ProspectDto relaisPhoneE164(String? relaisPhoneE164) =>
      this(relaisPhoneE164: relaisPhoneE164);

  @override
  ProspectDto journeys(List<ProspectJourneyDto> journeys) =>
      this(journeys: journeys);

  @override
  ProspectDto dureeSystemeMois(num? dureeSystemeMois) =>
      this(dureeSystemeMois: dureeSystemeMois);

  @override
  ProspectDto canalProvenanceId(String? canalProvenanceId) =>
      this(canalProvenanceId: canalProvenanceId);

  @override
  ProspectDto canalProvenanceLabel(String? canalProvenanceLabel) =>
      this(canalProvenanceLabel: canalProvenanceLabel);

  @override
  ProspectDto segment(BddSegment? segment) => this(segment: segment);

  @override
  ProspectDto phase2Status(Phase2Status phase2Status) =>
      this(phase2Status: phase2Status);

  @override
  ProspectDto enrollmentMethod(EnrollmentMethod? enrollmentMethod) =>
      this(enrollmentMethod: enrollmentMethod);

  @override
  ProspectDto enrollmentCapturedById(String? enrollmentCapturedById) =>
      this(enrollmentCapturedById: enrollmentCapturedById);

  @override
  ProspectDto enrollmentCapturedByName(String? enrollmentCapturedByName) =>
      this(enrollmentCapturedByName: enrollmentCapturedByName);

  @override
  ProspectDto enrollmentCapturedAt(DateTime? enrollmentCapturedAt) =>
      this(enrollmentCapturedAt: enrollmentCapturedAt);

  @override
  ProspectDto lastOutcome(CallOutcome? lastOutcome) =>
      this(lastOutcome: lastOutcome);

  @override
  ProspectDto lastComment(String? lastComment) =>
      this(lastComment: lastComment);

  @override
  ProspectDto lastAttemptAt(DateTime? lastAttemptAt) =>
      this(lastAttemptAt: lastAttemptAt);

  @override
  ProspectDto callAttemptCount(num callAttemptCount) =>
      this(callAttemptCount: callAttemptCount);

  @override
  ProspectDto lastCallOutcome(CallOutcome? lastCallOutcome) =>
      this(lastCallOutcome: lastCallOutcome);

  @override
  ProspectDto lastCallAt(DateTime? lastCallAt) => this(lastCallAt: lastCallAt);

  @override
  ProspectDto lastCallById(String? lastCallById) =>
      this(lastCallById: lastCallById);

  @override
  ProspectDto lastCallByName(String? lastCallByName) =>
      this(lastCallByName: lastCallByName);

  @override
  ProspectDto origin(String? origin) => this(origin: origin);

  @override
  ProspectDto originLabel(String? originLabel) =>
      this(originLabel: originLabel);

  @override
  ProspectDto clientCreatedAt(DateTime clientCreatedAt) =>
      this(clientCreatedAt: clientCreatedAt);

  @override
  ProspectDto createdAt(DateTime createdAt) => this(createdAt: createdAt);

  @override
  ProspectDto updatedAt(DateTime updatedAt) => this(updatedAt: updatedAt);

  @override
  ProspectDto deletedAt(DateTime? deletedAt) => this(deletedAt: deletedAt);

  @override
  /// This function **does support** nullification of nullable fields. All `null` values passed to `non-nullable` fields will be ignored. You can also use `ProspectDto(...).copyWith.fieldName(...)` to override fields one at a time with nullification support.
  ///
  /// Usage
  /// ```dart
  /// ProspectDto(...).copyWith(id: 12, name: "My name")
  /// ````
  ProspectDto call({
    Object? id = const $CopyWithPlaceholder(),
    Object? nom = const $CopyWithPlaceholder(),
    Object? prenom = const $CopyWithPlaceholder(),
    Object? phoneE164 = const $CopyWithPlaceholder(),
    Object? rev = const $CopyWithPlaceholder(),
    Object? statut = const $CopyWithPlaceholder(),
    Object? projet = const $CopyWithPlaceholder(),
    Object? banqueId = const $CopyWithPlaceholder(),
    Object? banqueName = const $CopyWithPlaceholder(),
    Object? syndicatId = const $CopyWithPlaceholder(),
    Object? syndicatSigle = const $CopyWithPlaceholder(),
    Object? representantId = const $CopyWithPlaceholder(),
    Object? representantName = const $CopyWithPlaceholder(),
    Object? representantPhoneE164 = const $CopyWithPlaceholder(),
    Object? departementId = const $CopyWithPlaceholder(),
    Object? departementName = const $CopyWithPlaceholder(),
    Object? ownedByCommercialId = const $CopyWithPlaceholder(),
    Object? ownedByCommercialName = const $CopyWithPlaceholder(),
    Object? type = const $CopyWithPlaceholder(),
    Object? profession = const $CopyWithPlaceholder(),
    Object? professionId = const $CopyWithPlaceholder(),
    Object? professionIsTeaching = const $CopyWithPlaceholder(),
    Object? incomeBandId = const $CopyWithPlaceholder(),
    Object? incomeBandLabel = const $CopyWithPlaceholder(),
    Object? paymentMode = const $CopyWithPlaceholder(),
    Object? employeurId = const $CopyWithPlaceholder(),
    Object? employeur = const $CopyWithPlaceholder(),
    Object? typeContrat = const $CopyWithPlaceholder(),
    Object? ancienneteMois = const $CopyWithPlaceholder(),
    Object? lieuActivite = const $CopyWithPlaceholder(),
    Object? modeEpargne = const $CopyWithPlaceholder(),
    Object? paysResidenceId = const $CopyWithPlaceholder(),
    Object? paysResidenceLabel = const $CopyWithPlaceholder(),
    Object? villeResidence = const $CopyWithPlaceholder(),
    Object? whatsappE164 = const $CopyWithPlaceholder(),
    Object? relaisNom = const $CopyWithPlaceholder(),
    Object? relaisPhoneE164 = const $CopyWithPlaceholder(),
    Object? journeys = const $CopyWithPlaceholder(),
    Object? dureeSystemeMois = const $CopyWithPlaceholder(),
    Object? canalProvenanceId = const $CopyWithPlaceholder(),
    Object? canalProvenanceLabel = const $CopyWithPlaceholder(),
    Object? segment = const $CopyWithPlaceholder(),
    Object? phase2Status = const $CopyWithPlaceholder(),
    Object? enrollmentMethod = const $CopyWithPlaceholder(),
    Object? enrollmentCapturedById = const $CopyWithPlaceholder(),
    Object? enrollmentCapturedByName = const $CopyWithPlaceholder(),
    Object? enrollmentCapturedAt = const $CopyWithPlaceholder(),
    Object? lastOutcome = const $CopyWithPlaceholder(),
    Object? lastComment = const $CopyWithPlaceholder(),
    Object? lastAttemptAt = const $CopyWithPlaceholder(),
    Object? callAttemptCount = const $CopyWithPlaceholder(),
    Object? lastCallOutcome = const $CopyWithPlaceholder(),
    Object? lastCallAt = const $CopyWithPlaceholder(),
    Object? lastCallById = const $CopyWithPlaceholder(),
    Object? lastCallByName = const $CopyWithPlaceholder(),
    Object? origin = const $CopyWithPlaceholder(),
    Object? originLabel = const $CopyWithPlaceholder(),
    Object? clientCreatedAt = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? updatedAt = const $CopyWithPlaceholder(),
    Object? deletedAt = const $CopyWithPlaceholder(),
  }) {
    return ProspectDto(
      id: id == const $CopyWithPlaceholder()
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      nom: nom == const $CopyWithPlaceholder()
          ? _value.nom
          // ignore: cast_nullable_to_non_nullable
          : nom as String,
      prenom: prenom == const $CopyWithPlaceholder()
          ? _value.prenom
          // ignore: cast_nullable_to_non_nullable
          : prenom as String,
      phoneE164: phoneE164 == const $CopyWithPlaceholder()
          ? _value.phoneE164
          // ignore: cast_nullable_to_non_nullable
          : phoneE164 as String,
      rev: rev == const $CopyWithPlaceholder()
          ? _value.rev
          // ignore: cast_nullable_to_non_nullable
          : rev as num,
      statut: statut == const $CopyWithPlaceholder()
          ? _value.statut
          // ignore: cast_nullable_to_non_nullable
          : statut as ProspectStatut,
      projet: projet == const $CopyWithPlaceholder()
          ? _value.projet
          // ignore: cast_nullable_to_non_nullable
          : projet as Projet,
      banqueId: banqueId == const $CopyWithPlaceholder()
          ? _value.banqueId
          // ignore: cast_nullable_to_non_nullable
          : banqueId as String?,
      banqueName: banqueName == const $CopyWithPlaceholder()
          ? _value.banqueName
          // ignore: cast_nullable_to_non_nullable
          : banqueName as String?,
      syndicatId: syndicatId == const $CopyWithPlaceholder()
          ? _value.syndicatId
          // ignore: cast_nullable_to_non_nullable
          : syndicatId as String?,
      syndicatSigle: syndicatSigle == const $CopyWithPlaceholder()
          ? _value.syndicatSigle
          // ignore: cast_nullable_to_non_nullable
          : syndicatSigle as String?,
      representantId: representantId == const $CopyWithPlaceholder()
          ? _value.representantId
          // ignore: cast_nullable_to_non_nullable
          : representantId as String?,
      representantName: representantName == const $CopyWithPlaceholder()
          ? _value.representantName
          // ignore: cast_nullable_to_non_nullable
          : representantName as String?,
      representantPhoneE164:
          representantPhoneE164 == const $CopyWithPlaceholder()
          ? _value.representantPhoneE164
          // ignore: cast_nullable_to_non_nullable
          : representantPhoneE164 as String?,
      departementId: departementId == const $CopyWithPlaceholder()
          ? _value.departementId
          // ignore: cast_nullable_to_non_nullable
          : departementId as String?,
      departementName: departementName == const $CopyWithPlaceholder()
          ? _value.departementName
          // ignore: cast_nullable_to_non_nullable
          : departementName as String?,
      ownedByCommercialId: ownedByCommercialId == const $CopyWithPlaceholder()
          ? _value.ownedByCommercialId
          // ignore: cast_nullable_to_non_nullable
          : ownedByCommercialId as String,
      ownedByCommercialName:
          ownedByCommercialName == const $CopyWithPlaceholder()
          ? _value.ownedByCommercialName
          // ignore: cast_nullable_to_non_nullable
          : ownedByCommercialName as String,
      type: type == const $CopyWithPlaceholder()
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as ProspectType?,
      profession: profession == const $CopyWithPlaceholder()
          ? _value.profession
          // ignore: cast_nullable_to_non_nullable
          : profession as String?,
      professionId: professionId == const $CopyWithPlaceholder()
          ? _value.professionId
          // ignore: cast_nullable_to_non_nullable
          : professionId as String?,
      professionIsTeaching: professionIsTeaching == const $CopyWithPlaceholder()
          ? _value.professionIsTeaching
          // ignore: cast_nullable_to_non_nullable
          : professionIsTeaching as bool?,
      incomeBandId: incomeBandId == const $CopyWithPlaceholder()
          ? _value.incomeBandId
          // ignore: cast_nullable_to_non_nullable
          : incomeBandId as String?,
      incomeBandLabel: incomeBandLabel == const $CopyWithPlaceholder()
          ? _value.incomeBandLabel
          // ignore: cast_nullable_to_non_nullable
          : incomeBandLabel as String?,
      paymentMode: paymentMode == const $CopyWithPlaceholder()
          ? _value.paymentMode
          // ignore: cast_nullable_to_non_nullable
          : paymentMode as PaymentMode?,
      employeurId: employeurId == const $CopyWithPlaceholder()
          ? _value.employeurId
          // ignore: cast_nullable_to_non_nullable
          : employeurId as String?,
      employeur: employeur == const $CopyWithPlaceholder()
          ? _value.employeur
          // ignore: cast_nullable_to_non_nullable
          : employeur as String?,
      typeContrat: typeContrat == const $CopyWithPlaceholder()
          ? _value.typeContrat
          // ignore: cast_nullable_to_non_nullable
          : typeContrat as TypeContrat?,
      ancienneteMois: ancienneteMois == const $CopyWithPlaceholder()
          ? _value.ancienneteMois
          // ignore: cast_nullable_to_non_nullable
          : ancienneteMois as num?,
      lieuActivite: lieuActivite == const $CopyWithPlaceholder()
          ? _value.lieuActivite
          // ignore: cast_nullable_to_non_nullable
          : lieuActivite as String?,
      modeEpargne: modeEpargne == const $CopyWithPlaceholder()
          ? _value.modeEpargne
          // ignore: cast_nullable_to_non_nullable
          : modeEpargne as ModeEpargne?,
      paysResidenceId: paysResidenceId == const $CopyWithPlaceholder()
          ? _value.paysResidenceId
          // ignore: cast_nullable_to_non_nullable
          : paysResidenceId as String?,
      paysResidenceLabel: paysResidenceLabel == const $CopyWithPlaceholder()
          ? _value.paysResidenceLabel
          // ignore: cast_nullable_to_non_nullable
          : paysResidenceLabel as String?,
      villeResidence: villeResidence == const $CopyWithPlaceholder()
          ? _value.villeResidence
          // ignore: cast_nullable_to_non_nullable
          : villeResidence as String?,
      whatsappE164: whatsappE164 == const $CopyWithPlaceholder()
          ? _value.whatsappE164
          // ignore: cast_nullable_to_non_nullable
          : whatsappE164 as String?,
      relaisNom: relaisNom == const $CopyWithPlaceholder()
          ? _value.relaisNom
          // ignore: cast_nullable_to_non_nullable
          : relaisNom as String?,
      relaisPhoneE164: relaisPhoneE164 == const $CopyWithPlaceholder()
          ? _value.relaisPhoneE164
          // ignore: cast_nullable_to_non_nullable
          : relaisPhoneE164 as String?,
      journeys: journeys == const $CopyWithPlaceholder()
          ? _value.journeys
          // ignore: cast_nullable_to_non_nullable
          : journeys as List<ProspectJourneyDto>,
      dureeSystemeMois: dureeSystemeMois == const $CopyWithPlaceholder()
          ? _value.dureeSystemeMois
          // ignore: cast_nullable_to_non_nullable
          : dureeSystemeMois as num?,
      canalProvenanceId: canalProvenanceId == const $CopyWithPlaceholder()
          ? _value.canalProvenanceId
          // ignore: cast_nullable_to_non_nullable
          : canalProvenanceId as String?,
      canalProvenanceLabel: canalProvenanceLabel == const $CopyWithPlaceholder()
          ? _value.canalProvenanceLabel
          // ignore: cast_nullable_to_non_nullable
          : canalProvenanceLabel as String?,
      segment: segment == const $CopyWithPlaceholder()
          ? _value.segment
          // ignore: cast_nullable_to_non_nullable
          : segment as BddSegment?,
      phase2Status: phase2Status == const $CopyWithPlaceholder()
          ? _value.phase2Status
          // ignore: cast_nullable_to_non_nullable
          : phase2Status as Phase2Status,
      enrollmentMethod: enrollmentMethod == const $CopyWithPlaceholder()
          ? _value.enrollmentMethod
          // ignore: cast_nullable_to_non_nullable
          : enrollmentMethod as EnrollmentMethod?,
      enrollmentCapturedById:
          enrollmentCapturedById == const $CopyWithPlaceholder()
          ? _value.enrollmentCapturedById
          // ignore: cast_nullable_to_non_nullable
          : enrollmentCapturedById as String?,
      enrollmentCapturedByName:
          enrollmentCapturedByName == const $CopyWithPlaceholder()
          ? _value.enrollmentCapturedByName
          // ignore: cast_nullable_to_non_nullable
          : enrollmentCapturedByName as String?,
      enrollmentCapturedAt: enrollmentCapturedAt == const $CopyWithPlaceholder()
          ? _value.enrollmentCapturedAt
          // ignore: cast_nullable_to_non_nullable
          : enrollmentCapturedAt as DateTime?,
      lastOutcome: lastOutcome == const $CopyWithPlaceholder()
          ? _value.lastOutcome
          // ignore: cast_nullable_to_non_nullable
          : lastOutcome as CallOutcome?,
      lastComment: lastComment == const $CopyWithPlaceholder()
          ? _value.lastComment
          // ignore: cast_nullable_to_non_nullable
          : lastComment as String?,
      lastAttemptAt: lastAttemptAt == const $CopyWithPlaceholder()
          ? _value.lastAttemptAt
          // ignore: cast_nullable_to_non_nullable
          : lastAttemptAt as DateTime?,
      callAttemptCount: callAttemptCount == const $CopyWithPlaceholder()
          ? _value.callAttemptCount
          // ignore: cast_nullable_to_non_nullable
          : callAttemptCount as num,
      lastCallOutcome: lastCallOutcome == const $CopyWithPlaceholder()
          ? _value.lastCallOutcome
          // ignore: cast_nullable_to_non_nullable
          : lastCallOutcome as CallOutcome?,
      lastCallAt: lastCallAt == const $CopyWithPlaceholder()
          ? _value.lastCallAt
          // ignore: cast_nullable_to_non_nullable
          : lastCallAt as DateTime?,
      lastCallById: lastCallById == const $CopyWithPlaceholder()
          ? _value.lastCallById
          // ignore: cast_nullable_to_non_nullable
          : lastCallById as String?,
      lastCallByName: lastCallByName == const $CopyWithPlaceholder()
          ? _value.lastCallByName
          // ignore: cast_nullable_to_non_nullable
          : lastCallByName as String?,
      origin: origin == const $CopyWithPlaceholder()
          ? _value.origin
          // ignore: cast_nullable_to_non_nullable
          : origin as String?,
      originLabel: originLabel == const $CopyWithPlaceholder()
          ? _value.originLabel
          // ignore: cast_nullable_to_non_nullable
          : originLabel as String?,
      clientCreatedAt: clientCreatedAt == const $CopyWithPlaceholder()
          ? _value.clientCreatedAt
          // ignore: cast_nullable_to_non_nullable
          : clientCreatedAt as DateTime,
      createdAt: createdAt == const $CopyWithPlaceholder()
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      updatedAt: updatedAt == const $CopyWithPlaceholder()
          ? _value.updatedAt
          // ignore: cast_nullable_to_non_nullable
          : updatedAt as DateTime,
      deletedAt: deletedAt == const $CopyWithPlaceholder()
          ? _value.deletedAt
          // ignore: cast_nullable_to_non_nullable
          : deletedAt as DateTime?,
    );
  }
}

extension $ProspectDtoCopyWith on ProspectDto {
  /// Returns a callable class that can be used as follows: `instanceOfProspectDto.copyWith(...)` or like so:`instanceOfProspectDto.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ProspectDtoCWProxy get copyWith => _$ProspectDtoCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ProspectDto _$ProspectDtoFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ProspectDto', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'nom',
      'prenom',
      'phoneE164',
      'rev',
      'statut',
      'projet',
      'banqueId',
      'banqueName',
      'syndicatId',
      'syndicatSigle',
      'representantId',
      'representantName',
      'representantPhoneE164',
      'departementId',
      'departementName',
      'ownedByCommercialId',
      'ownedByCommercialName',
      'type',
      'profession',
      'professionId',
      'professionIsTeaching',
      'incomeBandId',
      'incomeBandLabel',
      'paymentMode',
      'employeurId',
      'employeur',
      'typeContrat',
      'ancienneteMois',
      'lieuActivite',
      'modeEpargne',
      'paysResidenceId',
      'paysResidenceLabel',
      'villeResidence',
      'whatsappE164',
      'relaisNom',
      'relaisPhoneE164',
      'journeys',
      'dureeSystemeMois',
      'canalProvenanceId',
      'canalProvenanceLabel',
      'segment',
      'phase2Status',
      'enrollmentMethod',
      'enrollmentCapturedById',
      'enrollmentCapturedByName',
      'enrollmentCapturedAt',
      'lastOutcome',
      'lastComment',
      'lastAttemptAt',
      'callAttemptCount',
      'lastCallOutcome',
      'lastCallAt',
      'lastCallById',
      'lastCallByName',
      'origin',
      'originLabel',
      'clientCreatedAt',
      'createdAt',
      'updatedAt',
      'deletedAt',
    ],
  );
  final val = ProspectDto(
    id: $checkedConvert('id', (v) => v as String),
    nom: $checkedConvert('nom', (v) => v as String),
    prenom: $checkedConvert('prenom', (v) => v as String),
    phoneE164: $checkedConvert('phoneE164', (v) => v as String),
    rev: $checkedConvert('rev', (v) => v as num),
    statut: $checkedConvert(
      'statut',
      (v) => $enumDecode(
        _$ProspectStatutEnumMap,
        v,
        unknownValue: ProspectStatut.unknownDefaultOpenApi,
      ),
    ),
    projet: $checkedConvert(
      'projet',
      (v) => $enumDecode(
        _$ProjetEnumMap,
        v,
        unknownValue: Projet.unknownDefaultOpenApi,
      ),
    ),
    banqueId: $checkedConvert('banqueId', (v) => v as String?),
    banqueName: $checkedConvert('banqueName', (v) => v as String?),
    syndicatId: $checkedConvert('syndicatId', (v) => v as String?),
    syndicatSigle: $checkedConvert('syndicatSigle', (v) => v as String?),
    representantId: $checkedConvert('representantId', (v) => v as String?),
    representantName: $checkedConvert('representantName', (v) => v as String?),
    representantPhoneE164: $checkedConvert(
      'representantPhoneE164',
      (v) => v as String?,
    ),
    departementId: $checkedConvert('departementId', (v) => v as String?),
    departementName: $checkedConvert('departementName', (v) => v as String?),
    ownedByCommercialId: $checkedConvert(
      'ownedByCommercialId',
      (v) => v as String,
    ),
    ownedByCommercialName: $checkedConvert(
      'ownedByCommercialName',
      (v) => v as String,
    ),
    type: $checkedConvert(
      'type',
      (v) => $enumDecodeNullable(
        _$ProspectTypeEnumMap,
        v,
        unknownValue: ProspectType.unknownDefaultOpenApi,
      ),
    ),
    profession: $checkedConvert('profession', (v) => v as String?),
    professionId: $checkedConvert('professionId', (v) => v as String?),
    professionIsTeaching: $checkedConvert(
      'professionIsTeaching',
      (v) => v as bool?,
    ),
    incomeBandId: $checkedConvert('incomeBandId', (v) => v as String?),
    incomeBandLabel: $checkedConvert('incomeBandLabel', (v) => v as String?),
    paymentMode: $checkedConvert(
      'paymentMode',
      (v) => $enumDecodeNullable(
        _$PaymentModeEnumMap,
        v,
        unknownValue: PaymentMode.unknownDefaultOpenApi,
      ),
    ),
    employeurId: $checkedConvert('employeurId', (v) => v as String?),
    employeur: $checkedConvert('employeur', (v) => v as String?),
    typeContrat: $checkedConvert(
      'typeContrat',
      (v) => $enumDecodeNullable(
        _$TypeContratEnumMap,
        v,
        unknownValue: TypeContrat.unknownDefaultOpenApi,
      ),
    ),
    ancienneteMois: $checkedConvert('ancienneteMois', (v) => v as num?),
    lieuActivite: $checkedConvert('lieuActivite', (v) => v as String?),
    modeEpargne: $checkedConvert(
      'modeEpargne',
      (v) => $enumDecodeNullable(
        _$ModeEpargneEnumMap,
        v,
        unknownValue: ModeEpargne.unknownDefaultOpenApi,
      ),
    ),
    paysResidenceId: $checkedConvert('paysResidenceId', (v) => v as String?),
    paysResidenceLabel: $checkedConvert(
      'paysResidenceLabel',
      (v) => v as String?,
    ),
    villeResidence: $checkedConvert('villeResidence', (v) => v as String?),
    whatsappE164: $checkedConvert('whatsappE164', (v) => v as String?),
    relaisNom: $checkedConvert('relaisNom', (v) => v as String?),
    relaisPhoneE164: $checkedConvert('relaisPhoneE164', (v) => v as String?),
    journeys: $checkedConvert(
      'journeys',
      (v) => (v as List<dynamic>)
          .map((e) => ProspectJourneyDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
    dureeSystemeMois: $checkedConvert('dureeSystemeMois', (v) => v as num?),
    canalProvenanceId: $checkedConvert(
      'canalProvenanceId',
      (v) => v as String?,
    ),
    canalProvenanceLabel: $checkedConvert(
      'canalProvenanceLabel',
      (v) => v as String?,
    ),
    segment: $checkedConvert(
      'segment',
      (v) => $enumDecodeNullable(
        _$BddSegmentEnumMap,
        v,
        unknownValue: BddSegment.unknownDefaultOpenApi,
      ),
    ),
    phase2Status: $checkedConvert(
      'phase2Status',
      (v) => $enumDecode(
        _$Phase2StatusEnumMap,
        v,
        unknownValue: Phase2Status.unknownDefaultOpenApi,
      ),
    ),
    enrollmentMethod: $checkedConvert(
      'enrollmentMethod',
      (v) => $enumDecodeNullable(
        _$EnrollmentMethodEnumMap,
        v,
        unknownValue: EnrollmentMethod.unknownDefaultOpenApi,
      ),
    ),
    enrollmentCapturedById: $checkedConvert(
      'enrollmentCapturedById',
      (v) => v as String?,
    ),
    enrollmentCapturedByName: $checkedConvert(
      'enrollmentCapturedByName',
      (v) => v as String?,
    ),
    enrollmentCapturedAt: $checkedConvert(
      'enrollmentCapturedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    lastOutcome: $checkedConvert(
      'lastOutcome',
      (v) => $enumDecodeNullable(
        _$CallOutcomeEnumMap,
        v,
        unknownValue: CallOutcome.unknownDefaultOpenApi,
      ),
    ),
    lastComment: $checkedConvert('lastComment', (v) => v as String?),
    lastAttemptAt: $checkedConvert(
      'lastAttemptAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    callAttemptCount: $checkedConvert('callAttemptCount', (v) => v as num),
    lastCallOutcome: $checkedConvert(
      'lastCallOutcome',
      (v) => $enumDecodeNullable(
        _$CallOutcomeEnumMap,
        v,
        unknownValue: CallOutcome.unknownDefaultOpenApi,
      ),
    ),
    lastCallAt: $checkedConvert(
      'lastCallAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    lastCallById: $checkedConvert('lastCallById', (v) => v as String?),
    lastCallByName: $checkedConvert('lastCallByName', (v) => v as String?),
    origin: $checkedConvert('origin', (v) => v as String?),
    originLabel: $checkedConvert('originLabel', (v) => v as String?),
    clientCreatedAt: $checkedConvert(
      'clientCreatedAt',
      (v) => DateTime.parse(v as String),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    updatedAt: $checkedConvert('updatedAt', (v) => DateTime.parse(v as String)),
    deletedAt: $checkedConvert(
      'deletedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$ProspectDtoToJson(ProspectDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'nom': instance.nom,
      'prenom': instance.prenom,
      'phoneE164': instance.phoneE164,
      'rev': instance.rev,
      'statut': _$ProspectStatutEnumMap[instance.statut]!,
      'projet': _$ProjetEnumMap[instance.projet]!,
      'banqueId': instance.banqueId,
      'banqueName': instance.banqueName,
      'syndicatId': instance.syndicatId,
      'syndicatSigle': instance.syndicatSigle,
      'representantId': instance.representantId,
      'representantName': instance.representantName,
      'representantPhoneE164': instance.representantPhoneE164,
      'departementId': instance.departementId,
      'departementName': instance.departementName,
      'ownedByCommercialId': instance.ownedByCommercialId,
      'ownedByCommercialName': instance.ownedByCommercialName,
      'type': _$ProspectTypeEnumMap[instance.type],
      'profession': instance.profession,
      'professionId': instance.professionId,
      'professionIsTeaching': instance.professionIsTeaching,
      'incomeBandId': instance.incomeBandId,
      'incomeBandLabel': instance.incomeBandLabel,
      'paymentMode': _$PaymentModeEnumMap[instance.paymentMode],
      'employeurId': instance.employeurId,
      'employeur': instance.employeur,
      'typeContrat': _$TypeContratEnumMap[instance.typeContrat],
      'ancienneteMois': instance.ancienneteMois,
      'lieuActivite': instance.lieuActivite,
      'modeEpargne': _$ModeEpargneEnumMap[instance.modeEpargne],
      'paysResidenceId': instance.paysResidenceId,
      'paysResidenceLabel': instance.paysResidenceLabel,
      'villeResidence': instance.villeResidence,
      'whatsappE164': instance.whatsappE164,
      'relaisNom': instance.relaisNom,
      'relaisPhoneE164': instance.relaisPhoneE164,
      'journeys': instance.journeys.map((e) => e.toJson()).toList(),
      'dureeSystemeMois': instance.dureeSystemeMois,
      'canalProvenanceId': instance.canalProvenanceId,
      'canalProvenanceLabel': instance.canalProvenanceLabel,
      'segment': _$BddSegmentEnumMap[instance.segment],
      'phase2Status': _$Phase2StatusEnumMap[instance.phase2Status]!,
      'enrollmentMethod': _$EnrollmentMethodEnumMap[instance.enrollmentMethod],
      'enrollmentCapturedById': instance.enrollmentCapturedById,
      'enrollmentCapturedByName': instance.enrollmentCapturedByName,
      'enrollmentCapturedAt': instance.enrollmentCapturedAt?.toIso8601String(),
      'lastOutcome': _$CallOutcomeEnumMap[instance.lastOutcome],
      'lastComment': instance.lastComment,
      'lastAttemptAt': instance.lastAttemptAt?.toIso8601String(),
      'callAttemptCount': instance.callAttemptCount,
      'lastCallOutcome': _$CallOutcomeEnumMap[instance.lastCallOutcome],
      'lastCallAt': instance.lastCallAt?.toIso8601String(),
      'lastCallById': instance.lastCallById,
      'lastCallByName': instance.lastCallByName,
      'origin': instance.origin,
      'originLabel': instance.originLabel,
      'clientCreatedAt': instance.clientCreatedAt.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
      'updatedAt': instance.updatedAt.toIso8601String(),
      'deletedAt': instance.deletedAt?.toIso8601String(),
    };

const _$ProspectStatutEnumMap = {
  ProspectStatut.NOUVEAU: 'NOUVEAU',
  ProspectStatut.CONTACTE: 'CONTACTE',
  ProspectStatut.CONVERTI: 'CONVERTI',
  ProspectStatut.PERDU: 'PERDU',
  ProspectStatut.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProjetEnumMap = {
  Projet.CHUES: 'CHUES',
  Projet.GRAND_PUBLIC: 'GRAND_PUBLIC',
  Projet.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ProspectTypeEnumMap = {
  ProspectType.FONCTIONNAIRE: 'FONCTIONNAIRE',
  ProspectType.SECTEUR_PRIVE: 'SECTEUR_PRIVE',
  ProspectType.INFORMEL: 'INFORMEL',
  ProspectType.DIASPORA: 'DIASPORA',
  ProspectType.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$PaymentModeEnumMap = {
  PaymentMode.COMPTANT: 'COMPTANT',
  PaymentMode.ECHELONNE: 'ECHELONNE',
  PaymentMode.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$TypeContratEnumMap = {
  TypeContrat.CDI: 'CDI',
  TypeContrat.CDD: 'CDD',
  TypeContrat.AUTRE: 'AUTRE',
  TypeContrat.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$ModeEpargneEnumMap = {
  ModeEpargne.TONTINE: 'TONTINE',
  ModeEpargne.MOBILE_MONEY: 'MOBILE_MONEY',
  ModeEpargne.BANQUE: 'BANQUE',
  ModeEpargne.AUCUN: 'AUCUN',
  ModeEpargne.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$BddSegmentEnumMap = {
  BddSegment.BDD1: 'BDD1',
  BddSegment.BDD2: 'BDD2',
  BddSegment.BDD3: 'BDD3',
  BddSegment.BDD4: 'BDD4',
  BddSegment.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$Phase2StatusEnumMap = {
  Phase2Status.PENDING: 'PENDING',
  Phase2Status.METHOD_OBTAINED: 'METHOD_OBTAINED',
  Phase2Status.REFUSED: 'REFUSED',
  Phase2Status.WRONG_NUMBER: 'WRONG_NUMBER',
  Phase2Status.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$EnrollmentMethodEnumMap = {
  EnrollmentMethod.PLATFORM: 'PLATFORM',
  EnrollmentMethod.PHYSICAL: 'PHYSICAL',
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING:
      'VOICE_OR_ELECTRONIC_MESSAGING',
  EnrollmentMethod.APPOINTMENT: 'APPOINTMENT',
  EnrollmentMethod.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$CallOutcomeEnumMap = {
  CallOutcome.METHOD_OBTAINED: 'METHOD_OBTAINED',
  CallOutcome.UNREACHABLE: 'UNREACHABLE',
  CallOutcome.CALLBACK: 'CALLBACK',
  CallOutcome.REFUSED: 'REFUSED',
  CallOutcome.WRONG_NUMBER: 'WRONG_NUMBER',
  CallOutcome.OTHER: 'OTHER',
  CallOutcome.unknownDefaultOpenApi: 'unknown_default_open_api',
};
