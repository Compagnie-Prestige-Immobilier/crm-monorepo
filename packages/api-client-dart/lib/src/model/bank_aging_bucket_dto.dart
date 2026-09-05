//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_age_bucket.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_aging_bucket_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankAgingBucketDto {
  /// Returns a new [BankAgingBucketDto] instance.
  BankAgingBucketDto({

    required  this.bucket,

    required  this.label,

    required  this.dossiers,

    required  this.share,
  });

  @JsonKey(
    
    name: r'bucket',
    required: true,
    includeIfNull: false,
  unknownEnumValue: BankAgeBucket.unknownDefaultOpenApi,
  )


  final BankAgeBucket bucket;



      /// Libellé prêt à afficher.
  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'dossiers',
    required: true,
    includeIfNull: false,
  )


  final num dossiers;



      /// Part du total, en pourcentage. Nul quand le dénominateur est vide : un taux calculé sur zéro observation n’existe pas, et le publier comme 0 le rendrait indistinguable d’un vrai 0 %.
  @JsonKey(
    
    name: r'share',
    required: true,
    includeIfNull: true,
  )


  final num? share;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankAgingBucketDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            bucket,
            label,
            dossiers,
            share,
        ],
        [
            other.bucket,
            other.label,
            other.dossiers,
            other.share,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        bucket,
        label,
        dossiers,
        share,
    ],);

  factory BankAgingBucketDto.fromJson(Map<String, dynamic> json) => _$BankAgingBucketDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankAgingBucketDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

