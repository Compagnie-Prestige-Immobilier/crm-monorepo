//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'bank_bank_breakdown_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class BankBankBreakdownDto {
  /// Returns a new [BankBankBreakdownDto] instance.
  BankBankBreakdownDto({

    required  this.banqueId,

    required  this.label,

    required  this.cases,

    required  this.cashed,

    required  this.rejected,

    required  this.amountXof,

    required  this.share,

    required  this.meanProcessingHours,
  });

  @JsonKey(
    
    name: r'banqueId',
    required: true,
    includeIfNull: false,
  )


  final String banqueId;



  @JsonKey(
    
    name: r'label',
    required: true,
    includeIfNull: false,
  )


  final String label;



  @JsonKey(
    
    name: r'cases',
    required: true,
    includeIfNull: false,
  )


  final num cases;



  @JsonKey(
    
    name: r'cashed',
    required: true,
    includeIfNull: false,
  )


  final num cashed;



  @JsonKey(
    
    name: r'rejected',
    required: true,
    includeIfNull: false,
  )


  final num rejected;



  @JsonKey(
    
    name: r'amountXof',
    required: true,
    includeIfNull: false,
  )


  final String amountXof;



  @JsonKey(
    
    name: r'share',
    required: true,
    includeIfNull: false,
  )


  final num share;



      /// Durée moyenne de traitement en heures, création → étape terminale.
  @JsonKey(
    
    name: r'meanProcessingHours',
    required: true,
    includeIfNull: true,
  )


  final num? meanProcessingHours;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is BankBankBreakdownDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            banqueId,
            label,
            cases,
            cashed,
            rejected,
            amountXof,
            share,
            meanProcessingHours,
        ],
        [
            other.banqueId,
            other.label,
            other.cases,
            other.cashed,
            other.rejected,
            other.amountXof,
            other.share,
            other.meanProcessingHours,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        banqueId,
        label,
        cases,
        cashed,
        rejected,
        amountXof,
        share,
        meanProcessingHours,
    ],);

  factory BankBankBreakdownDto.fromJson(Map<String, dynamic> json) => _$BankBankBreakdownDtoFromJson(json);

  Map<String, dynamic> toJson() => _$BankBankBreakdownDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

