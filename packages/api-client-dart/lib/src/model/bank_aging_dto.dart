//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_aging_bucket_dto.dart';
import 'package:crm_api_client/src/model/bank_aging_stage_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_aging_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankAgingDto {
  /// Returns a new [BankAgingDto] instance.
  BankAgingDto({

    required  this.buckets,

    required  this.stages,

    required  this.total,
  });

      /// Ancienneté, toutes étapes confondues.
  @JsonKey(
    
    name: r'buckets',
    required: true,
    includeIfNull: false,
  )


  final List<BankAgingBucketDto> buckets;



      /// Une entrée par étape occupée, dans l’ordre du référentiel.
  @JsonKey(
    
    name: r'stages',
    required: true,
    includeIfNull: false,
  )


  final List<BankAgingStageDto> stages;



      /// Dossiers observés : non supprimés et stationnant à une étape NON TERMINALE. Un dossier encaissé ou rejeté est sorti du portefeuille, et son ancienneté ne se pilote plus.
  @JsonKey(
    
    name: r'total',
    required: true,
    includeIfNull: false,
  )


  final num total;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankAgingDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            buckets,
            stages,
            total,
        ],
        [
            other.buckets,
            other.stages,
            other.total,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        buckets,
        stages,
        total,
    ],);

  factory BankAgingDto.fromJson(Map<String, dynamic> json) => _$BankAgingDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankAgingDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

