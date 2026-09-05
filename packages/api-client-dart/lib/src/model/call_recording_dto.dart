//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:equatable/src/equatable_utils.dart';

part 'call_recording_dto.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CallRecordingDto {
  /// Returns a new [CallRecordingDto] instance.
  CallRecordingDto({

    required  this.attemptId,

    required  this.bytes,
  });

  @JsonKey(
    
    name: r'attemptId',
    required: true,
    includeIfNull: false,
  )


  final String attemptId;



  @JsonKey(
    
    name: r'bytes',
    required: true,
    includeIfNull: false,
  )


  final num bytes;




    bool operator ==(Object other) {
      return identical(this, other) ||
      other is CallRecordingDto &&
      runtimeType == other.runtimeType &&
      equals(
        [
            attemptId,
            bytes,
        ],
        [
            other.attemptId,
            other.bytes,
        ]
      );
    }


    @override
    int get hashCode => runtimeType.hashCode ^ mapPropsToHashCode([
        attemptId,
        bytes,
    ],);

  factory CallRecordingDto.fromJson(Map<String, dynamic> json) => _$CallRecordingDtoFromJson(json);

  Map<String, dynamic> toJson() => _$CallRecordingDtoToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

