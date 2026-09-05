//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'import_row_error_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ImportRowErrorDto {
  /// Returns a new [ImportRowErrorDto] instance.
  ImportRowErrorDto({

    required  this.line,

    required  this.code,

    required  this.message,

    required  this.value,
  });

      /// Numéro de ligne dans le fichier, en-tête compris.
  @JsonKey(
    
    name: r'line',
    required: true,
    includeIfNull: false,
  )


  final num line;



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



      /// Valeur fautive, telle que saisie.
  @JsonKey(
    
    name: r'value',
    required: true,
    includeIfNull: true,
  )


  final String? value;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is ImportRowErrorDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            line,
            code,
            message,
            value,
        ],
        [
            other.line,
            other.code,
            other.message,
            other.value,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        line,
        code,
        message,
        value,
    ],);

  factory ImportRowErrorDto.fromJson(Map<String, dynamic> json) => _$ImportRowErrorDtoFromJson(json);

  Map<String, dynamic> toJson() => _$ImportRowErrorDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

