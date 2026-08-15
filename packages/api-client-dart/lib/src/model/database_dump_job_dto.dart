//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'database_dump_job_dto.g.dart';

@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class DatabaseDumpJobDto {
  /// Returns a new [DatabaseDumpJobDto] instance.
  DatabaseDumpJobDto({
    required this.id,

    required this.status,

    required this.requestedByName,

    required this.requestedAt,

    required this.finishedAt,

    required this.fileSize,

    required this.sha256,

    required this.expiresAt,

    required this.failureReason,

    required this.noticeStatus,

    required this.noticeDetail,

    required this.downloadable,
  });

  /// Absent tant qu’aucun export n’a jamais été demandé.
  @JsonKey(name: r'id', required: true, includeIfNull: true)
  final String? id;

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonKey(
    name: r'status',
    required: true,
    includeIfNull: false,
    unknownEnumValue: DatabaseDumpJobDtoStatusEnum.unknownDefaultOpenApi,
  )
  final DatabaseDumpJobDtoStatusEnum status;

  @JsonKey(name: r'requestedByName', required: true, includeIfNull: true)
  final String? requestedByName;

  @JsonKey(name: r'requestedAt', required: true, includeIfNull: true)
  final DateTime? requestedAt;

  @JsonKey(name: r'finishedAt', required: true, includeIfNull: true)
  final DateTime? finishedAt;

  /// Taille de l’archive compressée, en octets.
  @JsonKey(name: r'fileSize', required: true, includeIfNull: true)
  final num? fileSize;

  /// Empreinte de l’archive, à vérifier après téléchargement.
  @JsonKey(name: r'sha256', required: true, includeIfNull: true)
  final String? sha256;

  /// Au-delà, le fichier est détruit. Il l’est aussi dès qu’il a été téléchargé.
  @JsonKey(name: r'expiresAt', required: true, includeIfNull: true)
  final DateTime? expiresAt;

  @JsonKey(name: r'failureReason', required: true, includeIfNull: true)
  final String? failureReason;

  /// Issue de l’avis de fin. `INBOX_ONLY` : l’avis est dans la boîte de réception du panel, et c’est le SEUL canal. Aucun e-mail n’est envoyé pour cet avis : la sélection des destinataires d’e-mail ne retient que les comptes COMMERCIAL, et le demandeur d’un export est toujours un ADMIN. `FAILED` : l’avis n’a pas pu être écrit, et l’export est prêt quand même. Un export prêt dont personne n’a été prévenu doit se voir, pas se deviner.
  @JsonKey(name: r'noticeStatus', required: true, includeIfNull: true)
  final String? noticeStatus;

  @JsonKey(name: r'noticeDetail', required: true, includeIfNull: true)
  final String? noticeDetail;

  /// Vrai quand le fichier est servi par GET /admin/database-dump/download. Le téléchargement le détruit.
  @JsonKey(name: r'downloadable', required: true, includeIfNull: false)
  final bool downloadable;

  bool operator ==(Object other) {
    return identical(this, other) ||
        other is DatabaseDumpJobDto &&
            runtimeType == other.runtimeType &&
            equals(
              [
                id,
                status,
                requestedByName,
                requestedAt,
                finishedAt,
                fileSize,
                sha256,
                expiresAt,
                failureReason,
                noticeStatus,
                noticeDetail,
                downloadable,
              ],
              [
                other.id,
                other.status,
                other.requestedByName,
                other.requestedAt,
                other.finishedAt,
                other.fileSize,
                other.sha256,
                other.expiresAt,
                other.failureReason,
                other.noticeStatus,
                other.noticeDetail,
                other.downloadable,
              ],
            );
  }

  @override
  int get hashCode =>
      runtimeType.hashCode ^
      mapPropsToHashCode([
        id,
        status,
        requestedByName,
        requestedAt,
        finishedAt,
        fileSize,
        sha256,
        expiresAt,
        failureReason,
        noticeStatus,
        noticeDetail,
        downloadable,
      ]);

  factory DatabaseDumpJobDto.fromJson(Map<String, dynamic> json) =>
      _$DatabaseDumpJobDtoFromJson(json);

  Map<String, dynamic> toJson() => _$DatabaseDumpJobDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }
}

/// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
enum DatabaseDumpJobDtoStatusEnum {
  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'idle')
  idle(r'idle'),

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'queued')
  queued(r'queued'),

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'running')
  running(r'running'),

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'ready')
  ready(r'ready'),

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'failed')
  failed(r'failed'),

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'expired')
  expired(r'expired'),

  /// `idle` : aucun export n’a jamais été demandé. `queued` puis `running` : le travail court, l’écran affiche son attente. `ready` : le fichier est téléchargeable. `failed` : le motif est dans `failureReason`. `expired` : le fichier a été détruit, par échéance ou après téléchargement ; ce n’est pas une erreur.
  @JsonValue(r'unknown_default_open_api')
  unknownDefaultOpenApi(r'unknown_default_open_api');

  const DatabaseDumpJobDtoStatusEnum(this.value);

  final String value;

  @override
  String toString() => value;
}
