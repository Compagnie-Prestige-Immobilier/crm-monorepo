//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/bank_case_dto.dart';
import 'package:crm_api_client/src/model/bank_case_transition_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_detail_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseDetailDto {
  /// Returns a new [BankCaseDetailDto] instance.
  BankCaseDetailDto({

    required  this.bankCase,

    required  this.history,
  });

  @JsonKey(
    
    name: r'bankCase',
    required: true,
    includeIfNull: false,
  )


  final BankCaseDto bankCase;



      /// Historique complet, du plus ancien au plus récent. Append-only.
  @JsonKey(
    
    name: r'history',
    required: true,
    includeIfNull: false,
  )


  final List<BankCaseTransitionDto> history;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankCaseDetailDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            bankCase,
            history,
        ],
        [
            other.bankCase,
            other.history,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        bankCase,
        history,
    ],);

  factory BankCaseDetailDto.fromJson(Map<String, dynamic> json) => _$BankCaseDetailDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseDetailDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

