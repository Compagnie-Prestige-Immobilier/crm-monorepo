import 'dart:io';
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

class ImageService {
  static final ImageService _instance = ImageService._internal();
  factory ImageService() => _instance;
  ImageService._internal();

  static const int _maxDimension = 1024;
  static const int _quality = 70;

  /// Save an image to the application documents directory
  /// Returns the permanent path of the saved image
  Future<String> saveImage(String sourcePath) async {
    final directory = await getApplicationDocumentsDirectory();
    final imagesDir = Directory(p.join(directory.path, 'images'));

    if (!await imagesDir.exists()) {
      await imagesDir.create(recursive: true);
    }

    final extension = p.extension(sourcePath);
    final isPng = extension.toLowerCase() == '.png';
    final targetExtension = isPng ? '.png' : '.jpg';
    final fileName = '${const Uuid().v4()}$targetExtension';
    final targetPath = p.join(imagesDir.path, fileName);

    final result = await FlutterImageCompress.compressAndGetFile(
      sourcePath,
      targetPath,
      quality: _quality,
      minWidth: _maxDimension,
      minHeight: _maxDimension,
      format: isPng ? CompressFormat.png : CompressFormat.jpeg,
    );

    if (result != null) {
      return result.path;
    }

    final fallbackName = '${const Uuid().v4()}$extension';
    final fallbackPath = p.join(imagesDir.path, fallbackName);
    final sourceFile = File(sourcePath);
    await sourceFile.copy(fallbackPath);
    return fallbackPath;
  }

  /// Delete an image from the filesystem
  Future<void> deleteImage(String path) async {
    final file = File(path);
    if (await file.exists()) {
      await file.delete();
    }
  }
}
