//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_time_bucket_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankTimeBucketDto {
  /// Returns a new [BankTimeBucketDto] instance.
  BankTimeBucketDto({

    required  this.bucket,

    required  this.cases,

    required  this.amountXof,
  });

  @JsonKey(
    
    name: r'bucket',
    required: true,
    includeIfNull: false,
  )


  final DateTime bucket;



  @JsonKey(
    
    name: r'cases',
    required: true,
    includeIfNull: false,
  )


  final num cases;



      /// Montant du seau, en chaîne. « 0 » hors encaissement.
  @JsonKey(
    
    name: r'amountXof',
    required: true,
    includeIfNull: false,
  )


  final String amountXof;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankTimeBucketDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            bucket,
            cases,
            amountXof,
        ],
        [
            other.bucket,
            other.cases,
            other.amountXof,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        bucket,
        cases,
        amountXof,
    ],);

  factory BankTimeBucketDto.fromJson(Map<String, dynamic> json) => _$BankTimeBucketDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankTimeBucketDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

