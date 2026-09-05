//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'lot_export_preview_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LotExportPreviewDto {
  /// Returns a new [LotExportPreviewDto] instance.
  LotExportPreviewDto({

    required  this.eligible,

    required  this.scopeLabel,

    required  this.places,

    required  this.retenues,

    required  this.parTeleconseiller,
  });

  @JsonKey(
    
    name: r'eligible',
    required: true,
    includeIfNull: false,
  )


  final num eligible;



  @JsonKey(
    
    name: r'scopeLabel',
    required: true,
    includeIfNull: false,
  )


  final String scopeLabel;



  @JsonKey(
    
    name: r'places',
    required: true,
    includeIfNull: false,
  )


  final num places;



  @JsonKey(
    
    name: r'retenues',
    required: true,
    includeIfNull: false,
  )


  final num retenues;



  @JsonKey(
    
    name: r'parTeleconseiller',
    required: true,
    includeIfNull: false,
  )


  final num parTeleconseiller;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is LotExportPreviewDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            eligible,
            scopeLabel,
            places,
            retenues,
            parTeleconseiller,
        ],
        [
            other.eligible,
            other.scopeLabel,
            other.places,
            other.retenues,
            other.parTeleconseiller,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        eligible,
        scopeLabel,
        places,
        retenues,
        parTeleconseiller,
    ],);

  factory LotExportPreviewDto.fromJson(Map<String, dynamic> json) => _$LotExportPreviewDtoFromJson(json);

  Map<String, dynamic> toJson() => _$LotExportPreviewDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

