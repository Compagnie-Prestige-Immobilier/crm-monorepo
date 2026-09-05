//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:crm_api_client/src/model/page_meta_dto.dart';
import 'package:crm_api_client/src/model/bank_case_dto.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_case_list_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankCaseListDto {
  /// Returns a new [BankCaseListDto] instance.
  BankCaseListDto({

    required  this.items,

    required  this.meta,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<BankCaseDto> items;



  @JsonKey(
    
    name: r'meta',
    required: true,
    includeIfNull: false,
  )


  final PageMetaDto meta;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankCaseListDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            items,
            meta,
        ],
        [
            other.items,
            other.meta,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        items,
        meta,
    ],);

  factory BankCaseListDto.fromJson(Map<String, dynamic> json) => _$BankCaseListDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankCaseListDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

