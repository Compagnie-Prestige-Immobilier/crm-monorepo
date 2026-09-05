//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'import_job_error_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportJobErrorDto {
  /// Returns a new [ImportJobErrorDto] instance.
  ImportJobErrorDto({

    required  this.rowNumber,

    required  this.column,

    required  this.code,

    required  this.message,
  });

      /// Numéro de ligne DANS LE FICHIER, en-tête compris : ce qu’Excel affiche.
  @JsonKey(
    
    name: r'rowNumber',
    required: true,
    includeIfNull: false,
  )


  final num rowNumber;



      /// En-tête de la colonne fautive, quand le refus en désigne une.
  @JsonKey(
    
    name: r'column',
    required: true,
    includeIfNull: true,
  )


  final String? column;



      /// Code stable du motif, pour que l’interface puisse le traduire.
  @JsonKey(
    
    name: r'code',
    required: true,
    includeIfNull: false,
  )


  final String code;



      /// Motif lisible, prêt à afficher.
  @JsonKey(
    
    name: r'message',
    required: true,
    includeIfNull: false,
  )


  final String message;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ImportJobErrorDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            rowNumber,
            column,
            code,
            message,
        ],
        [
            other.rowNumber,
            other.column,
            other.code,
            other.message,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        rowNumber,
        column,
        code,
        message,
    ],);

  factory ImportJobErrorDto.fromJson(Map<String, dynamic> json) => _$ImportJobErrorDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ImportJobErrorDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

