import 'package:isar_plus/isar_plus.dart';
import '../../shared/utils/app_logger.dart';

/// A base class for Isar repositories to provide standard CRUD operations.
///
/// [T] is the model type.
abstract class BaseIsarRepository<T> {
  final Isar isar;

  BaseIsarRepository(this.isar);

  /// Returns the collection for the current Isar instance.
  IsarCollection<int, T> get collection => getCollection(isar);

  /// Must be implemented by subclasses to provide the collection from an Isar instance.
  /// This is used for supporting isolate-based writeAsync operations.
  IsarCollection<int, T> getCollection(Isar isar);

  /// Retrieves all items from the collection.
  Future<List<T>> getAll() async {
    try {
      return await collection.where().findAllAsync();
    } catch (e) {
      AppLogger.e('Error getting all items from collection', e);
      return [];
    }
  }

  /// Retrieves an item by its ID.
  Future<T?> getById(int id) async {
    try {
      return await collection.getAsync(id);
    } catch (e) {
      AppLogger.e('Error getting item $id from collection', e);
      return null;
    }
  }

  /// Saves or updates an item in the collection.
  Future<void> put(T item);

  /// Saves or updates multiple items in the collection.
  Future<void> putAll(List<T> items);

  /// Deletes an item by its ID.
  Future<void> delete(int id);

  /// Watches the entire collection for changes.
  Stream<List<T>> watch({bool fireImmediately = false}) {
    return collection.where().watch(fireImmediately: fireImmediately);
  }
}
