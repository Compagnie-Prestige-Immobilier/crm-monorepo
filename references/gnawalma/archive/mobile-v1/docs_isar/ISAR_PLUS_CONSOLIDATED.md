import { Steps } from 'fumadocs-ui/components/steps';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { Cards, Card } from 'fumadocs-ui/components/card';

# Isar Plus Documentation (Consolidated)

This document consolidates the contents of the `docs_isar/` folder into a single file.
All source content is preserved in full. Import statements have been consolidated at the top for MDX compatibility.

## Table of Contents

- [Source: `docs_isar/ISAR_PLUS_DOCS.md`](#source-docs_isar-isar_plus_docs-md)
- [Source: `docs_isar/isar_plus_quick_start.md`](#source-docs_isar-isar_plus_quick_start-md)
- [Source: `docs_isar/isar_plus_schema.md`](#source-docs_isar-isar_plus_schema-md)
- [Source: `docs_isar/isar_plus_crud.md`](#source-docs_isar-isar_plus_crud-md)
- [Source: `docs_isar/isar_plus_queries.md`](#source-docs_isar-isar_plus_queries-md)
- [Source: `docs_isar/isar_plus_indexes.md`](#source-docs_isar-isar_plus_indexes-md)
- [Source: `docs_isar/isar_plus_performance.md`](#source-docs_isar-isar_plus_performance-md)

---

<a id="source-docs_isar-isar_plus_docs-md"></a>
## Source: `docs_isar/ISAR_PLUS_DOCS.md`

# Isar Plus Documentation (AI-Optimized)

> **CRITICAL CONTEXT**: This documentation is for **Isar Plus (v4+)**. 
> - **Legacy Isar (v3) is DEPRECATED.** 
> - **IsarLinks** are removed in favor of Embedded Objects or Manual ID management.
> - **@enumerated** is removed in favor of native Enums or `@enumValue`.

## 1. Installation & Setup

### Dependencies (`pubspec.yaml`)
```yaml
dependencies:
  isar_plus: ^1.2.0
  isar_plus_flutter_libs: ^1.2.0 # Flutter only
  path_provider: ^2.1.5

dev_dependencies:
  build_runner: ^2.10.4
```

### Initialization (`main.dart`)
```dart
import 'package:isar_plus/isar_plus.dart';
import 'package:path_provider/path_provider.dart';

void main() async {
  final dir = await getApplicationDocumentsDirectory();
  
  // Open Instance
  final isar = Isar.open(
    schemas: [UserSchema, PostSchema], // Generated schemas
    directory: dir.path,
    name: 'default', // Optional
    maxSizeMiB: 2048, // Optional
    // directory: Isar.sqliteInMemory, // For testing/in-memory
  );
  
  runApp(MyApp(isar: isar));
}
```

---

## 2. Schema Definition

### Basic Collection
- Use `@collection` annotation.
- **Must** have an `Id` field (usually `int`).
- Use `part 'filename.g.dart';`

```dart
import 'package:isar_plus/isar_plus.dart';

part 'user.g.dart';

@collection
class User {
  User({required this.id});

  final int id; // 64-bit integer

  late String name;
  
  int? age; // Nullable
  
  @ignore
  String? tempValue; // Not persisted
  
  @Name("db_email")
  String? email; // Renamed in DB
}
```

### Data Types
- **Primitives**: `bool`, `int`, `double`, `DateTime`, `String`
- **Lists**: `List<int>`, `List<String>`, etc. (No nulls inside lists)
- **Enums**:
  - **Ordinal (Default)**: `0, 1, 2` based on index.
  - **Custom Value**: Use `@enumValue` on a field inside the enum.

```dart
enum Status {
  active(1),
  inactive(2);

  const Status(this.code);
  
  @enumValue
  final int code; // Stored as 1 or 2
}
```

### Embedded Objects (Replacements for Links)
Use `@embedded` for nested data structures.

```dart
@embedded
class Address {
  String? city;
  String? street;
}

@collection
class User {
  Id? id;
  Address? homeAddress;
  List<Address>? locations;
}
```

---

## 3. CRUD Operations

**Rule**: All write operations **MUST** be inside a write transaction.

### Create / Insert
```dart
await isar.writeAsync((isar) async {
  final user = User(id: isar.users.autoIncrement())
    ..name = 'Jane';
  
  isar.users.put(user); // Insert or Update (Upsert)
});

// Bulk Insert
await isar.writeAsync((isar) async {
  isar.users.putAll([user1, user2]);
});
```

### Read
```dart
// By ID
final user = await isar.users.get(1);

// Bulk Read
final users = await isar.users.getAll([1, 2, 3]);
```

### Update
Updates are just `put()` with an existing ID.
```dart
await isar.writeAsync((isar) async {
  final user = await isar.users.get(1);
  if (user != null) {
    user.age = 30;
    isar.users.put(user);
  }
});
```

### Delete
```dart
await isar.writeAsync((isar) async {
  isar.users.delete(1); // Delete by ID
  isar.users.deleteAll([1, 2]); // Bulk delete
  isar.users.clear(); // Delete ALL in collection
});
```

---

## 4. Querying

### Filter vs Where Clause
- **Where Clause**: Uses indexes (Fastest).
- **Filter**: Scans all records (Slower).
- Unified API: Both start with `.where()`.

### Basic Queries
```dart
// Equality
await isar.users.where().ageEqualTo(25).findAllAsync();

// Range
await isar.users.where().ageBetween(20, 30).findAllAsync();

// String ops (Defaults to case-sensitive)
await isar.users.where().nameStartsWith('J', caseSensitive: false).findAllAsync();
```

### Logical Operators
```dart
await isar.users.where()
  .ageGreaterThan(18)
  .and() // Implicit
  .nameContains('Smith')
  .or()
  .group((q) => q.ageLessThan(10)) // Grouping
  .findAllAsync();
```

### Modifiers
```dart
// Sorting
.sortByAge()
.sortByAgeDesc()

// Pagination
.offset(10).limit(20)

// Aggregation
.countAsync()
.isEmptyAsync()
.findFirstAsync()
```

---

## 5. Indexing (Performance)

**Rule**: Add indexes to fields used in `where()` clauses or for sorting.

### Types
- `@Index()`: Default, full value storage. Supports range/sorting.
- `@Index(type: IndexType.hash)`: Hash storage. Equality checks only. Smaller.
- `@Index(type: IndexType.hashElements)`: For Lists. Matches "array contains".
- `@Index(composite: ['field2'])`: Composite index.

### Examples
```dart
@collection
class Product {
  Id? id;

  @Index() // Fast range/sort
  int? price;

  @Index(type: IndexType.hash) // Fast equality, small size
  String? sku;
  
  @Index(composite: ['age']) // Composite: name + age
  String? name;
  int? age;
  
  @Index(type: IndexType.value, caseSensitive: false) // Full-text-ish prefix search
  List<String>? keywords;
}
```

---

## 6. Relationships (New in Isar Plus)

**DEPRECATION WARNING**: `IsarLinks` are gone.

### Strategy 1: Embedded Objects
Best for strict ownership (Parent owns Child).
```dart
@collection
class Order {
  Id? id;
  List<OrderItem>? items; // Embedded class
}
```

### Strategy 2: Manual IDs
Best for loose relationships or many-to-many.
```dart
@collection
class Teacher {
  Id? id;
  String? name;
}

@collection
class Student {
  Id? id;
  
  // Store IDs manually
  List<int> teacherIds; 
}

// Querying
final student = await isar.students.get(1);
final teachers = await isar.teachers.getAll(student.teacherIds);
```

---

## 7. Recipes & Patterns

### Full-Text Search
Use `Isar.splitWords()` and a list index.
```dart
@collection
class Post {
  Id? id;
  String? content;

  @Index(type: IndexType.value, caseSensitive: false)
  List<String> get contentWords => Isar.splitWords(content ?? '');
}

// Query
isar.posts.where().contentWordsAnyStartsWith('flut').findAllAsync();
```

### String IDs
Isar requires `int` IDs. Use FastHash to convert Strings (UUIDs) to Ints.
```dart
@collection
class User {
  String? uuid;

  Id get isarId => fastHash(uuid!);
}

int fastHash(String string) {
  var hash = 0xcbf29ce484222325;
  var i = 0;
  while (i < string.length) {
    final codeUnit = string.codeUnitAt(i++);
    hash ^= codeUnit >> 8;
    hash *= 0x100000001b3;
    hash ^= codeUnit & 0xFF;
    hash *= 0x100000001b3;
  }
  return hash;
}
```

---

## 8. Anti-Patterns to Avoid

1.  **Multiple Transactions in Loop**:
    *   **BAD**: Loop -> `writeAsync`.
    *   **GOOD**: `writeAsync` -> Loop -> `putAll`.
2.  **Over-Indexing**:
    *   Don't index everything. It slows down writes and increases size.
3.  **Blocking UI**:
    *   Always use `*Async` methods for DB operations.
4.  **Using `IsarLink`**:
    *   Do not use it. It is removed in v4.


---

<a id="source-docs_isar-isar_plus_quick_start-md"></a>
## Source: `docs_isar/isar_plus_quick_start.md`

# Quick Start (/en/docs/quickstart)



# Quick Start

This guide will help you get started with Isar Plus in just a few minutes.

<Callout type="success">
  Isar Plus works on iOS, Android, Desktop, and Web with persistent storage via OPFS/IndexedDB.
</Callout>

## Installation

<Steps>
  ### Add Dependencies

Add Isar Plus to your project:

<Tabs items={['Flutter', 'Dart CLI']}>
<Tab value="Flutter">
```yaml
dependencies:
isar_plus: ^1.2.0
isar_plus_flutter_libs: ^1.2.0
path_provider: ^2.1.5

      dev_dependencies:
        build_runner: ^2.10.4
      ```
    </Tab>

    <Tab value="Dart CLI">
      ```yaml
      dependencies:
        isar_plus: ^1.2.0

      dev_dependencies:
        build_runner: ^2.10.4
      ```
    </Tab>
  </Tabs>

### Define Your Schema

Create your first collection:

  ```dart title="lib/models/user.dart"
  import 'package:isar_plus/isar_plus.dart';

  part 'user.g.dart';

  @collection
  class User {
    User({required this.id});

    final int id;

    late String name;

    int? age;

    late String email;
  }
  ```

  <Callout>
    The `part` directive is required for code generation.
  </Callout>

### Generate Code

Run the code generator:

  ```bash
  flutter pub run build_runner build
  ```

Or watch for changes:

  ```bash
  flutter pub run build_runner watch
  ```

### Open Isar Instance

Initialize Isar in your app:

  ```dart title="lib/main.dart" {5-9}
  import 'package:isar_plus/isar_plus.dart';
  import 'package:path_provider/path_provider.dart';

  Future<void> main() async {
    WidgetsFlutterBinding.ensureInitialized();
    
    final dir = await getApplicationDocumentsDirectory();
    final isar = Isar.open(
      schemas: [UserSchema],
      directory: dir.path,
    );

    runApp(MyApp(isar: isar));
  }
  ```

### Use Your Database

Start storing and querying data:

  ```dart
  // Create
  await isar.writeAsync((isar) async {
    final user = User(id: isar.users.autoIncrement())
      ..name = 'John Doe'
      ..age = 25
      ..email = 'john@example.com';
    
    isar.users.put(user);
  });

  // Read
  final allUsers = await isar.users.where().findAllAsync();

  // Query
  final youngUsers = await isar.users
    .where()
    .ageLessThan(30)
    .findAllAsync();

  // Update
  await isar.writeAsync((isar) async {
    user.age = 26;
    isar.users.put(user);
  });

  // Delete
  await isar.writeAsync((isar) async {
    isar.users.delete(user.id);
  });
  ```
</Steps>

## Next Steps

<Cards>
  <Card title="Schema" href="/docs/schema">
    Learn about defining collections and fields
  </Card>

  <Card title="CRUD Operations" href="/docs/crud">
    Master data manipulation
  </Card>

  <Card title="Queries" href="/docs/queries">
    Build powerful queries
  </Card>

  <Card title="Indexes" href="/docs/indexes">
    Optimize query performance
  </Card>
</Cards>

<Callout type="warning">
  Remember to always use write transactions for modifying data!
</Callout>

---

<a id="source-docs_isar-isar_plus_schema-md"></a>
## Source: `docs_isar/isar_plus_schema.md`

# Schema (/en/docs/schema)



# Schema

When you use Isar to store your app's data, you're dealing with collections. A collection is like a database table and can only contain a single type of Dart object.

## Anatomy of a Collection

You define each Isar collection by annotating a class with `@collection` or `@Collection()`.

```dart
@collection
class User {
  Id? id;

  String? firstName;

  String? lastName;
}
```

<Callout>
  To persist a field, Isar must have access to it. Make it public or provide
  getter and setter methods.
</Callout>

## Data Types

Isar supports the following data types:

### Primitive Types

```dart
@collection
class PrimitiveTypes {
  PrimitiveTypes(this.id);

  final int id;

  bool? boolValue;
  int? intValue;
  double? doubleValue;
  DateTime? dateValue;
  String? stringValue;
}
```

### Lists

```dart
@collection
class ListTypes {
  ListTypes(this.id);

  final int id;

  List<bool>? boolList;
  List<int>? intList;
  List<double>? doubleList;
  List<DateTime>? dateList;
  List<String>? stringList;
}
```

<Callout type="warning">
  Lists cannot contain null values. Use nullable types instead.
</Callout>

### Enums

Isar Plus supports Dart enums with two storage strategies:

<Tabs items={['Ordinal (Default)', 'Custom Value']}>
<Tab value="Ordinal (Default)">
By default, enums are stored by their index (ordinal). Simply use the enum directly without any annotation:

    ```dart
    enum Status { active, inactive, pending }

    @collection
    class Task {
      Task(this.id);

      final int id;

      Status? status; // Stored as 0, 1, or 2
    }
    ```

    The stored values are:

    * `Status.active` → `0`
    * `Status.inactive` → `1`
    * `Status.pending` → `2`

    <Callout type="warning">
      If you reorder enum values, existing stored data will map to different enum values. Add new values at the end or use custom values for stability.
    </Callout>
  </Tab>

  <Tab value="Custom Value">
    For more control, define a field in your enum and annotate it with `@enumValue`. This field's value will be used for storage:

    ```dart
    enum Status {
      active(1),
      inactive(2),
      pending(3);

      const Status(this.code);

      @enumValue
      final int code;
    }

    @collection
    class Task {
      Task(this.id);

      final int id;

      Status? status; // Stored as 1, 2, or 3
    }
    ```

    Supported types for `@enumValue`:

    * `byte` - stored as single byte
    * `short` - stored as 16-bit integer
    * `int` - stored as 32-bit integer
    * `String` - stored as text

    ```dart
    // String-based enum example
    enum Priority {
      low('LOW'),
      medium('MEDIUM'),
      high('HIGH');

      const Priority(this.name);

      @enumValue
      final String name;
    }
    ```
  </Tab>
</Tabs>

<Callout type="info" title="Migration from Isar v3">
  The `@enumerated` and `@Enumerated(EnumType.ordinal/name)` annotations from
  Isar v3 are no longer available. Use plain enums for ordinal storage or
  `@enumValue` for custom values.
</Callout>

### Embedded Objects

```dart
@embedded
class Address {
  String? street;
  String? city;
  String? country;
}

@collection
class Person {
  Person(this.id);

  final int id;

  String? name;

  Address? address;

  List<Address>? addresses;
}
```

## Ids

Every collection needs an `Id` field to uniquely identify objects.

```dart
@collection
class User {
  User(this.id);

  final int id;

  String? name;
}
```

<Callout type="info">
  For auto-incrementing IDs, use the `collection.autoIncrement()` method when inserting:

  ```dart
  isar.write((isar) {
    final user = User(isar.users.autoIncrement());
    isar.users.put(user);
  });
  ```
</Callout>

### Custom IDs

```dart
@collection
class User {
  User(this.id);

  final int id; // You manage the ID

  String? name;
}
```

## Field Annotations

### @Index

Create indexes for better query performance:

```dart
@collection
class User {
  User(this.id);

  final int id;

  @Index()
  String? email;

  @Index(type: IndexType.value)
  String? username;

  @Index(caseSensitive: false)
  String? name;
}
```

### @Ignore

Exclude fields from storage:

```dart
@collection
class User {
  User(this.id);

  final int id;

  String? name;

  @ignore
  String? temporaryData; // Not stored
}
```

### @Name

Rename fields in the database:

```dart
@collection
class User {
  User(this.id);

  final int id;

  @Name("user_name")
  String? name;
}
```

### @Size

Limit string size:

```dart
@collection
class User {
  User(this.id);

  final int id;

  @Size(max: 100)
  String? shortText;

  @Size(max: 1000)
  String? longText;
}
```

## Composite Indexes

Create indexes on multiple fields:

```dart
@collection
@Index(composite: ['lastName', 'age'])
class User {
  User(this.id);

  final int id;

  String? firstName;

  String? lastName;

  int? age;
}
```

## Modeling Relationships

Isar Plus v4 models relationships with embedded objects or manual ID fields instead of runtime link types. See the dedicated [Relationships](./relationships) page for concrete examples lifted from the codebase.

## Migration

Isar handles schema migrations automatically in most cases:

* Adding new fields
* Removing fields
* Changing field types (with data loss)
* Adding/removing indexes

<Callout type="error">
  Changing the type of an existing field will result in data loss for that
  field.
</Callout>

## Next Steps

<Cards>
  <Card title="CRUD Operations" href="/docs/crud">
    Learn how to create, read, update, and delete data
  </Card>

  <Card title="Indexes" href="/docs/indexes">
    Optimize your queries with indexes
  </Card>

  <Card title="Queries" href="/docs/queries">
    Build powerful queries
  </Card>
</Cards>

---

<a id="source-docs_isar-isar_plus_crud-md"></a>
## Source: `docs_isar/isar_plus_crud.md`

# Create, Read, Update, Delete (/en/docs/crud)



# Create, Read, Update, Delete

Learn how to manipulate your Isar collections with CRUD operations.

## Opening Isar

Before you can do anything, you need an Isar instance. Each instance requires a directory with write permission.

```dart title="main.dart" {5-9}
import 'package:isar_plus/isar_plus.dart';
import 'package:path_provider/path_provider.dart';

void main() async {
  final dir = await getApplicationDocumentsDirectory();
  final isar = Isar.open(
    schemas: [RecipeSchema, UserSchema],
    directory: dir.path,
  );
}
```

<Callout>
  You can open multiple instances with different names using the `name` parameter.
</Callout>

### Configuration Options

| Config              | Description                                                        |
| ------------------- | ------------------------------------------------------------------ |
| `name`              | Open multiple instances with distinct names. Default: `"default"`  |
| `directory`         | Storage location. Use `Isar.sqliteInMemory` for in-memory database |
| `maxSizeMib`        | Maximum size in MiB. Default: `2048`                               |
| `relaxedDurability` | Trade durability for performance                                   |

<Tabs items={['Default Config', 'Custom Config', 'In-Memory']}>
<Tab value="Default Config">
```dart
final isar = Isar.open(schemas: [UserSchema]);
```
</Tab>

  <Tab value="Custom Config">
    ```dart
    final isar = Isar.open(
      schemas: [UserSchema],
      name: 'myInstance',
      directory: '/custom/path',
      maxSizeMiB: 512,
    );
    ```
  </Tab>

  <Tab value="In-Memory">
    ```dart
    final isar = Isar.open(
      schemas: [UserSchema],
      directory: Isar.sqliteInMemory,
    );
    ```
  </Tab>
</Tabs>

## Create (Insert)

<Steps>
  ### Create an Object

  ```dart
  final user = User()
    ..name = 'Jane Doe'
    ..age = 28
    ..email = 'jane@example.com';
  ```

### Insert with Write Transaction

  ```dart
  await isar.writeAsync((isar) async {
    isar.users.put(user);
  });
  ```

  <Callout type="success">
    Use `collection.autoIncrement()` to get an auto-incrementing ID when creating objects.
  </Callout>

### Bulk Insert

  ```dart
  final users = [
    User()..name = 'Alice'..age = 25,
    User()..name = 'Bob'..age = 30,
    User()..name = 'Charlie'..age = 35,
  ];

  await isar.writeAsync((isar) async {
    isar.users.putAll(users);
  });
  ```
</Steps>

<Callout type="warning">
  Always use write transactions for data modifications!
</Callout>

## Read (Query)

### Get by ID

```dart
final user = await isar.users.get(1);
if (user != null) {
  print('Found: ${user.name}');
}
```

### Get Multiple by IDs

```dart
final users = await isar.users.getAll([1, 2, 3]);
```

### Get All

```dart
final allUsers = await isar.users.where().findAllAsync();
```

### Find First

```dart
final firstUser = await isar.users.where().findFirstAsync();
```

### Count

```dart
final count = await isar.users.countAsync();
print('Total users: $count');
```

## Update

<Tabs items={['Update Object', 'Update Fields', 'Conditional Update']}>
<Tab value="Update Object">
```dart
// Get the object
final user = await isar.users.get(1);

    if (user != null) {
      // Modify it
      user.name = 'Updated Name';
      user.age = 30;
      
      // Save changes
      await isar.writeAsync((isar) async {
        isar.users.put(user);
      });
    }
    ```
  </Tab>

  <Tab value="Update Fields">
    ```dart
    await isar.writeAsync((isar) async {
      final user = await isar.users.get(1);
      if (user != null) {
        user.age = (user.age ?? 0) + 1;
        isar.users.put(user);
      }
    });
    ```
  </Tab>

  <Tab value="Conditional Update">
    ```dart
    await isar.writeAsync((isar) async {
      final adults = isar.users
        .where()
        .ageGreaterThan(18)
        .findAll();

      for (var user in adults) {
        user.verified = true;
        isar.users.put(user);
      }
    });
    ```
  </Tab>
</Tabs>

<Callout type="info">
  The `put` method acts as upsert - it inserts if the ID doesn't exist, updates if it does.
</Callout>

## Delete

### Delete by ID

```dart
await isar.writeAsync((isar) async {
  final success = isar.users.delete(1);
  print('Deleted: $success');
});
```

### Delete Multiple by IDs

```dart
await isar.writeAsync((isar) async {
  final count = isar.users.deleteAll([1, 2, 3]);
  print('Deleted $count users');
});
```

### Delete Object

```dart
await isar.writeAsync((isar) async {
  final user = await isar.users.get(1);
  if (user != null) {
    isar.users.delete(user.id);
  }
});
```

### Delete All

```dart
await isar.writeAsync((isar) async {
  isar.users.clear();
});
```

<Callout type="error">
  Be careful with `clear()` - it deletes all records in the collection!
</Callout>

### Delete with Filter

```dart
await isar.writeAsync((isar) async {
  final deletedCount = isar.users
    .where()
    .ageLessThan(18)
    .deleteAll();
  print('Deleted $deletedCount users');
});
```

## Transactions

All write operations must be wrapped in a transaction:

```dart
await isar.writeAsync((isar) async {
  // Create
  final user = User()..name = 'Test';
  isar.users.put(user);
  
  // Update
  user.name = 'Updated';
  isar.users.put(user);
  
  // Delete
  isar.users.delete(user.id);
  
  // All operations are atomic
});
```

<Callout type="success">
  If an error occurs, all changes in the transaction are rolled back automatically.
</Callout>

### Read Transactions

For better performance with multiple reads:

```dart
final results = await isar.readAsync((isar) async {
  final users = isar.users.where().findAll();
  final count = isar.users.count();
  return {'users': users, 'count': count};
});
```

## Best Practices

1. **Use Bulk Operations**
   ```dart
   // ✅ Good - Single transaction
   await isar.writeAsync((isar) async {
     isar.users.putAll(manyUsers);
   });

   // ❌ Bad - Multiple transactions
   for (var user in manyUsers) {
     await isar.writeAsync((isar) async {
       isar.users.put(user);
     });
   }
   ```

2. **Minimize Transaction Scope**
   ```dart
   // ✅ Good
   final data = prepareData();
   await isar.writeAsync((isar) async {
     isar.users.putAll(data);
   });

   // ❌ Bad
   await isar.writeAsync((isar) async {
     final data = prepareData(); // Heavy operation in transaction
     isar.users.putAll(data);
   });
   ```

3. **Check Before Delete**
   ```dart
   await isar.writeAsync((isar) async {
     final exists = await isar.users.get(id) != null;
     if (exists) {
       isar.users.delete(id);
     }
   });
   ```

## Error Handling

```dart
try {
  await isar.writeAsync((isar) async {
    isar.users.put(user);
  });
} catch (e) {
  print('Error: $e');
  // Transaction is automatically rolled back
}
```

## Next Steps

<Cards>
  <Card title="Queries" href="/docs/queries">
    Learn how to query your data efficiently
  </Card>

  <Card title="Indexes" href="/docs/indexes">
    Optimize query performance with indexes
  </Card>

  <Card title="Transactions" href="/docs/transactions">
    Deep dive into transactions
  </Card>

  <Card title="Watchers" href="/docs/watchers">
    React to data changes in real-time
  </Card>
</Cards>

---

<a id="source-docs_isar-isar_plus_queries-md"></a>
## Source: `docs_isar/isar_plus_queries.md`

# Queries (/en/docs/queries)



# Queries

Querying is how you find records that match certain conditions. Learn how to build powerful queries and optimize them with indexes.

<Callout type="info">
  Queries are executed on the database, not in Dart, making them incredibly fast!
</Callout>

## Overview

There are two different methods of filtering your records. Both start with `.where()` but work differently under the hood:

1. **Filters** - Easy to use, work on any property (scans all records)
2. **Where clauses** - More powerful, require indexes (extremely fast)

The API is unified: you always start with `.where()`. If you use a condition on an indexed property, it automatically becomes a fast "Where clause". If you use a condition on a non-indexed property, it becomes a "Filter".

## Filters

Filters evaluate an expression for every object in the collection. If the expression resolves to `true`, the object is included in the results.

### Example Model

```dart
@collection
class Shoe {
  Id? id;

  int? size;

  late String model;

  late bool isUnisex;
}
```

### Query Conditions

<Tabs items={['Equality', 'Comparison', 'Range', 'Null Check']}>
<Tab value="Equality">
```dart
// Find size 46 shoes
final result = await isar.shoes.where()
  .sizeEqualTo(46)
  .findAllAsync();
```
</Tab>

  <Tab value="Comparison">
    ```dart
    // Find shoes smaller than size 40
    final result = await isar.shoes.where()
      .sizeLessThan(40)
      .findAllAsync(); // -> [39, null]

    // Include the boundary
    final result2 = await isar.shoes.where()
      .sizeLessThan(40, include: true)
      .findAllAsync(); // -> [39, null, 40]
    ```
  </Tab>

  <Tab value="Range">
    ```dart
    // Find shoes between size 39 and 46
    final result = await isar.shoes.where()
      .sizeBetween(39, 46)
      .findAllAsync();

    // Exclude lower bound
    final result2 = await isar.shoes.where()
      .sizeBetween(39, 46, includeLower: false)
      .findAllAsync(); // -> [40, 46]
    ```
  </Tab>

  <Tab value="Null Check">
    ```dart
    // Find shoes with null size
    final nullSizes = await isar.shoes.where()
      .sizeIsNull()
      .findAllAsync();

    // Find shoes with non-null size
    final withSizes = await isar.shoes.where()
      .sizeIsNotNull()
      .findAllAsync();
    ```
  </Tab>
</Tabs>

### Available Conditions

| Condition                | Description                             |
| ------------------------ | --------------------------------------- |
| `.equalTo(value)`        | Matches values equal to specified value |
| `.between(lower, upper)` | Matches values between lower and upper  |
| `.greaterThan(bound)`    | Matches values greater than bound       |
| `.lessThan(bound)`       | Matches values less than bound          |
| `.isNull()`              | Matches null values                     |
| `.isNotNull()`           | Matches non-null values                 |
| `.length()`              | Query based on list/string length       |

## Logical Operators

Combine multiple conditions using logical operators:

```dart
// AND operator (implicit)
final result = await isar.shoes.where()
  .sizeEqualTo(46)
  .and() // Optional
  .isUnisexEqualTo(true)
  .findAllAsync();
// Equivalent to: size == 46 && isUnisex == true
```

<Tabs items={['AND', 'OR', 'NOT', 'GROUP']}>
<Tab value="AND">
```dart
final result = await isar.shoes.where()
  .sizeEqualTo(46)
  .and()
  .isUnisexEqualTo(true)
  .findAllAsync();
```
</Tab>

  <Tab value="OR">
    ```dart
    final result = await isar.shoes.where()
      .sizeEqualTo(46)
      .or()
      .sizeEqualTo(40)
      .findAllAsync();
    ```
  </Tab>

  <Tab value="NOT">
    ```dart
    final result = await isar.shoes.where()
      .not().sizeEqualTo(46)
      .and()
      .not().isUnisexEqualTo(true)
      .findAllAsync();
    // Equivalent to: size != 46 && isUnisex != true
    ```
  </Tab>

  <Tab value="GROUP">
    ```dart
    final result = await isar.shoes.where()
      .sizeBetween(43, 46)
      .and()
      .group((q) => q
        .modelContains('Nike')
        .or()
        .isUnisexEqualTo(false)
      )
      .findAllAsync();
    // Equivalent to: size >= 43 && size <= 46 && 
    // (model.contains('Nike') || isUnisex == false)
    ```
  </Tab>
</Tabs>

## String Conditions

Strings have additional powerful query conditions:

```dart
@collection
class Product {
  Id? id;
  late String name;
}
```

<Tabs items={['StartsWith', 'Contains', 'EndsWith', 'Matches']}>
<Tab value="StartsWith">
```dart
final products = await isar.products.where()
.nameStartsWith('iPhone')
.findAllAsync();

    // Case insensitive
    final products2 = await isar.products.where()
      .nameStartsWith('iphone', caseSensitive: false)
      .findAllAsync();
    ```
  </Tab>

  <Tab value="Contains">
    ```dart
    final products = await isar.products.where()
      .nameContains('Pro')
      .findAllAsync();
    ```
  </Tab>

  <Tab value="EndsWith">
    ```dart
    final products = await isar.products.where()
      .nameEndsWith('Max')
      .findAllAsync();
    ```
  </Tab>

  <Tab value="Matches">
    ```dart
    // Wildcard patterns: * (zero or more), ? (one char)
    final products = await isar.products.where()
      .nameMatches('iPhone *Pro')
      .findAllAsync();
    // Matches: "iPhone 14 Pro", "iPhone 15 Pro", etc.
    ```
  </Tab>
</Tabs>

<Callout>
  All string operations have an optional `caseSensitive` parameter that defaults to `true`.
</Callout>

## Query Modifiers

Build dynamic queries based on conditions:

### Optional Queries

```dart
Future<List<Shoe>> findShoes(int? sizeFilter) {
  return isar.shoes.where()
    .optional(
      sizeFilter != null,
      (q) => q.sizeEqualTo(sizeFilter!),
    )
    .findAllAsync();
}
```

### AnyOf Modifier

```dart
// Find shoes with size 38, 40, or 42
final shoes = await isar.shoes.where()
  .anyOf(
    [38, 40, 42],
    (q, int size) => q.sizeEqualTo(size)
  )
  .findAllAsync();

// Equivalent to:
final shoes2 = await isar.shoes.where()
  .sizeEqualTo(38)
  .or()
  .sizeEqualTo(40)
  .or()
  .sizeEqualTo(42)
  .findAllAsync();
```

### AllOf Modifier

```dart
final shoes = await isar.shoes.where()
  .allOf(
    ['Nike', 'Adidas'],
    (q, brand) => q.modelContains(brand)
  )
  .findAllAsync();
```

## Advanced: Custom Queries

For complex scenarios where you need to build queries dynamically at runtime, you can use `buildQuery`. This is useful for creating custom query languages or dynamic filtering UIs.

```dart
// Manually construct a Filter
final filter = AndGroup([
  EqualCondition(property: 1, value: 46), // property 1 is 'size'
  GreaterCondition(property: 2, value: 100), // property 2 is 'price'
]);

final query = isar.shoes.buildQuery(
  filter: filter,
  sortBy: [
    SortProperty(property: 1, sort: Sort.desc), // Sort by size desc
  ],
);

final results = await query.findAllAsync();
```

<Callout type="warning">
  Using `buildQuery` requires intimate knowledge of your schema's property indices. It is recommended to use the generated `.where()` API whenever possible.
</Callout>

## List Queries

Query based on list properties:

```dart
@collection
class Tweet {
  Id? id;
  String? text;
  List<String> hashtags = [];
}
```

<Tabs items={['Length', 'Contains', 'Empty']}>
<Tab value="Length">
```dart
// Tweets with many hashtags
final tweets = await isar.tweets.where()
  .hashtagsLengthGreaterThan(5)
  .findAllAsync();
```
</Tab>

  <Tab value="Contains">
    ```dart
    // Find tweets with specific hashtag
    final flutterTweets = await isar.tweets.where()
      .hashtagsElementEqualTo('flutter')
      .findAllAsync();
    // Equivalent to: tweets.where((t) => 
    //   t.hashtags.contains('flutter'))
    ```
  </Tab>

  <Tab value="Empty">
    ```dart
    // Find tweets without hashtags
    final tweets = await isar.tweets.where()
      .hashtagsIsEmpty()
      .findAllAsync();
    ```
  </Tab>
</Tabs>

## Embedded Objects

Query nested embedded objects efficiently:

```dart
@collection
class Car {
  Id? id;
  Brand? brand;
}

@embedded
class Brand {
  String? name;
  String? country;
}
```

```dart
// Find BMW cars from Germany
final germanCars = await isar.cars.where()
  .brand((q) => q
    .nameEqualTo('BMW')
    .and()
    .countryEqualTo('Germany')
  )
  .findAllAsync();
```

<Callout type="success">
  Always group nested queries for better performance!
</Callout>

## Link Queries

Query based on linked objects:

```dart
@collection
class Teacher {
  Id? id;
  late String subject;
}

@collection
class Student {
  Id? id;
  late String name;
  final teachers = IsarLinks<Teacher>();
}
```

```dart
// Find students with math or English teacher
final students = await isar.students.where()
  .teachers((q) => q
    .subjectEqualTo('Math')
    .or()
    .subjectEqualTo('English')
  )
  .findAllAsync();

// Query by link count
final studentsWithManyTeachers = await isar.students.where()
  .teachersLengthGreaterThan(3)
  .findAllAsync();
```

<Callout type="warning">
  Link queries can be expensive. Consider using embedded objects for better performance.
</Callout>

## Where Clauses

Where clauses use indexes for ultra-fast queries:

```dart
@collection
class Product {
  Id? id;
  
  @Index()
  late String name;
  
  @Index()
  late int price;
}
```

```dart
// Use index for fast query
final products = await isar.products
  .where()
  .nameEqualTo('iPhone')
  .findAllAsync();

// Combine with filters
final expensiveIPhones = await isar.products
  .where()
  .nameEqualTo('iPhone')
  .where()
  .priceGreaterThan(1000)
  .findAllAsync();
```

<Callout type="info">
  Where clauses are much faster than filters but require indexes.
</Callout>

## Query Operations

### Find Operations

<Tabs items={['findAll', 'findFirst', 'count', 'isEmpty']}>
<Tab value="findAll">
```dart
final allShoes = await isar.shoes
  .where()
  .sizeGreaterThan(40)
  .findAllAsync();
```
</Tab>

  <Tab value="findFirst">
    ```dart
    final firstShoe = await isar.shoes
      .where()
      .sizeEqualTo(46)
      .findFirstAsync();
    ```
  </Tab>

  <Tab value="count">
    ```dart
    final count = await isar.shoes
      .where()
      .sizeGreaterThan(40)
      .countAsync();
    ```
  </Tab>

  <Tab value="isEmpty">
    ```dart
    final isEmpty = await isar.shoes
      .where()
      .sizeEqualTo(99)
      .isEmptyAsync();
    ```
  </Tab>
</Tabs>

### Delete Operations

```dart
// Delete matching objects
await isar.writeAsync((isar) async {
  final count = isar.shoes
    .where()
    .sizeLessThan(35)
    .deleteAll();
  print('Deleted $count shoes');
});
```

## Sorting

Sort results by any property:

```dart
// Ascending
final sorted = await isar.shoes
  .where()
  .sortBySize()
  .findAllAsync();

// Descending
final sortedDesc = await isar.shoes
  .where()
  .sortBySizeDesc()
  .findAllAsync();

// Multiple sorts
final multiSort = await isar.shoes
  .where()
  .sortBySize()
  .thenByModel()
  .findAllAsync();
```

<Callout type="warning">
  Sorting without indexes is expensive for large datasets. Use indexed where clauses for sorting when possible.
</Callout>

## Limit & Offset

```dart
// Get first 10 results
final first10 = await isar.shoes
  .where()
  .limit(10)
  .findAllAsync();

// Skip first 20, get next 10
final paginated = await isar.shoes
  .where()
  .offset(20)
  .limit(10)
  .findAllAsync();
```

## Distinct

```dart
// Get unique sizes
final uniqueSizes = await isar.shoes
  .where()
  .distinctBySize()
  .findAllAsync();
```

## Best Practices

1. **Use Where Clauses with Indexes**
   ```dart
   // ✅ Fast - uses index (price is indexed)
   await isar.products.where().priceEqualTo(500).findAllAsync();

   // ❌ Slow - scans all records (name is not indexed)
   await isar.products.where().nameEqualTo('iPhone').findAllAsync();
   ```

2. **Combine Where and Filter**
   ```dart
   // ✅ Optimal - index + filter
   await isar.products
     .where()
     .nameEqualTo('iPhone')
     .where()
     .priceGreaterThan(500)
     .findAllAsync();
   ```

3. **Group Nested Queries**
   ```dart
   // ✅ Efficient
   .brand((q) => q.nameEqualTo('BMW').and().countryEqualTo('Germany'))

   // ❌ Inefficient
   .brand((q) => q.nameEqualTo('BMW'))
   .and()
   .brand((q) => q.countryEqualTo('Germany'))
   ```

## Next Steps

<Cards>
  <Card title="Indexes" href="/docs/indexes">
    Learn how to create and use indexes
  </Card>

  <Card title="Transactions" href="/docs/transactions">
    Understand transactions
  </Card>

  <Card title="Watchers" href="/docs/watchers">
    React to query changes
  </Card>
</Cards>

---

<a id="source-docs_isar-isar_plus_indexes-md"></a>
## Source: `docs_isar/isar_plus_indexes.md`

# Indexes (/en/docs/indexes)



# Indexes

Indexes are Isar's most powerful feature for query optimization. Learn how to use single, composite, and multi-entry indexes effectively.

<Callout type="success">
  Understanding indexes is essential to optimize query performance!
</Callout>

## What are Indexes?

Without indexes, queries must scan through every object linearly. With indexes, queries can jump directly to the relevant data.

### Example Without Index

```dart
@collection
class Product {
  Id? id;
  late String name;
  late int price;
}
```

**Unindexed Data:**

| id | name      | price |
| -- | --------- | ----- |
| 1  | Book      | 15    |
| 2  | Table     | 55    |
| 3  | Chair     | 25    |
| 4  | Pencil    | 3     |
| 5  | Lightbulb | 12    |
| 6  | Carpet    | 60    |
| 7  | Pillow    | 30    |
| 8  | Computer  | 650   |
| 9  | Soap      | 2     |

To find products > €30, Isar must check all 9 rows:

```dart
final expensive = await isar.products.where()
  .priceGreaterThan(30)
  .findAll();
```

### With Index

Add an index to the `price` field:

```dart
@collection
class Product {
  Id? id;
  late String name;
  
  @Index()
  late int price;
}
```

**Generated Index (sorted):**

| price   | id    |
| ------- | ----- |
| 2       | 9     |
| 3       | 4     |
| 12      | 5     |
| 15      | 1     |
| 25      | 3     |
| 30      | 7     |
| **55**  | **2** |
| **60**  | **6** |
| **650** | **8** |

Now the query jumps directly to the relevant rows! ⚡

## Creating Indexes

### Single Property Index

```dart
@collection
class User {
  Id? id;

  @Index()
  late String email;

  @Index(type: IndexType.value)
  late String username;
}
```

<Tabs items={['IndexType.value', 'IndexType.hash', 'IndexType.hashElements']}>
<Tab value="IndexType.value">
**Default** - Stores the actual value. Supports all where clauses.

    ```dart
    @Index(type: IndexType.value)
    late String email;

    // Supports: equalTo, between, startsWith, etc.
    await isar.users.where()
      .emailStartsWith('john')
      .findAll();
    ```
  </Tab>

  <Tab value="IndexType.hash">
    Stores hash of value. Only supports equality checks. Uses less space.

    ```dart
    @Index(type: IndexType.hash)
    late String email;

    // Only supports: equalTo
    await isar.users.where()
      .emailEqualTo('john@example.com')
      .findAll();
    ```
  </Tab>

  <Tab value="IndexType.hashElements">
    For Lists only. Hashes each element individually.

    ```dart
    @Index(type: IndexType.hashElements)
    late List<String> tags;

    await isar.posts.where()
      .tagsElementEqualTo('flutter')
      .findAll();
    ```
  </Tab>
</Tabs>

### Composite Indexes

Index multiple properties together for complex queries:

```dart
@collection
class Person {
  Id? id;

  late String firstName;

  @Index(composite: ['firstName'])
  late String lastName;

  late int age;
}
```

```dart
// Uses composite index efficiently
final people = await isar.persons
  .where()
  .lastNameFirstNameEqualTo('Doe', 'John')
  .findAll();
```

<Callout type="info">
  Composite indexes can also use only the first property: `.lastNameEqualTo('Doe')`
</Callout>

### Multi-Property Composite

```dart
@collection
@Index(composite: ['lastName', 'age'])
class Person {
  Id? id;
  late String firstName;
  late String lastName;
  late int age;
}
```

```dart
// All of these use the composite index:
.firstNameEqualTo('John')
.firstNameLastNameEqualTo('John', 'Doe')
.firstNameLastNameAgeEqualTo('John', 'Doe', 25)
```

## Multi-Entry Indexes

Create indexes for list elements:

```dart
@collection
class Post {
  Id? id;

  late String title;

  @Index(type: IndexType.value)
  late List<String> tags;
}
```

```dart
// Fast lookup by any tag
final flutterPosts = await isar.posts
  .where()
  .tagsElementEqualTo('flutter')
  .findAll();
```

<Callout type="warning">
  Multi-entry indexes can significantly increase database size for lists with many elements.
</Callout>

## Unique Indexes

Enforce uniqueness constraints:

```dart
@collection
class User {
  Id? id;

  @Index(unique: true)
  late String username;

  late int age;
}
```

```dart
await isar.writeAsync((isar) async {
  final user1 = User()
    ..id = 1
    ..username = 'john_doe'
    ..age = 25;
  await isar.users.put(user1); // ✅ inserted

  final user2 = User()
    ..id = 2
    ..username = 'john_doe'
    ..age = 30;
  await isar.users.put(user2); // ✅ overwrites the previous row

  final current = await isar.users
      .where()
      .usernameEqualTo('john_doe')
      .findFirst();
  print(current);
  // => {id: 2, username: john_doe, age: 30}
});
```

<Callout type="warning" title="Unique indexes always replace">
  v4 keeps the most recent write for a unique key combination. If you need to
  **reject** duplicates instead of overwriting, query first and throw your own
  error:

  ```dart
  await isar.writeAsync((isar) async {
    final exists = await isar.users
        .where()
        .usernameEqualTo('john_doe')
        .findFirst();
    if (exists != null) {
      throw StateError('username already taken');
    }

    final user = User()
      ..id = 42
      ..username = 'john_doe'
      ..age = 30;

    await isar.users.put(user);
  });
  ```
</Callout>

## Case Sensitivity

Control case sensitivity for string indexes:

```dart
@collection
class User {
  Id? id;

  @Index(caseSensitive: false)
  late String email;
}
```

```dart
// Both find the same user
await isar.users.where().emailEqualTo('JOHN@example.com').findAll();
await isar.users.where().emailEqualTo('john@example.com').findAll();
```

<Callout>
  Case-insensitive indexes take slightly more space but provide flexible queries.
</Callout>

## Index for Sorting

Indexes provide super-fast sorting:

```dart
@collection
class Product {
  Id? id;

  late String name;

  @Index()
  late int price;
}
```

<Tabs items={['Without Index', 'With Index']}>
<Tab value="Without Index">
```dart
// ❌ Slow - loads all, then sorts
final cheapest = await isar.products
  .where()
  .sortByPrice()
  .limit(4)
  .findAll();
```
</Tab>

  <Tab value="With Index">
    ```dart
    // ✅ Fast - uses sorted index
    final cheapest = await isar.products
      .where()
      .anyPrice()
      .limit(4)
      .findAll();
    ```
  </Tab>
</Tabs>

<Callout type="success">
  Using indexed sorting avoids loading and sorting all results in memory!
</Callout>

## Where Clauses

Use indexes with where clauses for maximum performance:

```dart
@collection
class Product {
  Id? id;

  late String name;

  @Index()
  late int price;
}
```

```dart
// Fast - uses index
final products = await isar.products
  .where()
  .priceBetween(10, 100)
  .findAll();

// Fast - index + sort
final sorted = await isar.products
  .where()
  .anyPrice()
  .limit(10)
  .findAll();

// Fast - index + filter
final filtered = await isar.products
  .where()
  .priceGreaterThan(50)
  .where()
  .nameStartsWith('iPhone')
  .findAll();
```

## Index Types Comparison

| Type                     | Size   | Where Clauses | Use Case                    |
| ------------------------ | ------ | ------------- | --------------------------- |
| `IndexType.value`        | Large  | All           | Full text search, ranges    |
| `IndexType.hash`         | Small  | Equality only | Unique constraints, lookups |
| `IndexType.hashElements` | Medium | List elements | Tag systems, categories     |

## Best Practices

<Steps>
  ### Choose the Right Properties

Index properties used frequently in where clauses:

  ```dart
  @collection
  class User {
    Id? id;

    @Index() // Frequently queried
    late String email;

    late String name; // Not indexed - rarely queried alone
  }
  ```

### Don't Over-Index

Each index increases write time and storage:

  ```dart
  // ❌ Too many indexes
  @collection
  class User {
    @Index() Id? id; // Id is already indexed!
    @Index() late String email;
    @Index() late String name;
    @Index() late String phone;
    @Index() late int age;
  }

  // ✅ Index only what you query
  @collection
  class User {
    Id? id;
    @Index(unique: true) late String email;
    late String name;
    late String phone;
    late int age;
  }
  ```

### Use Composite Indexes Wisely

  ```dart
  // ✅ Good - queries firstName + lastName together
    @Index(composite: ['lastName'])
  late String firstName;

  // ❌ Bad - separate queries
  @Index()
  late String firstName;
  @Index()
  late String lastName;
  ```

### Profile Your Queries

Use Isar Inspector to analyze query performance:

  ```dart
  // Enable inspector in debug mode
  final isar = Isar.open(
    schemas: [UserSchema],
    inspector: true, // Open inspector
  );
  ```
</Steps>

## Index Limitations

<Callout type="warning">
  * Only the first 1024 bytes of strings are indexed
  * Maximum of 3 properties in composite indexes (on web)
  * Indexes increase write operation time
  * Indexes consume additional storage
</Callout>

## Next Steps

<Cards>
  <Card title="Queries" href="/docs/queries">
    Learn how to use indexes in queries
  </Card>

  <Card title="Full-Text Search" href="/docs/recipes/full_text_search">
    Implement search functionality
  </Card>

  <Card title="Performance" href="/docs/recipes">
    Optimization techniques
  </Card>
</Cards>

---

<a id="source-docs_isar-isar_plus_performance-md"></a>
## Source: `docs_isar/isar_plus_performance.md`

# Recipes (/en/docs/recipes)



# Recipes

Explore practical guides and common patterns for using Isar Plus effectively in your applications.

## Available Recipes

<Cards>
  <Card title="Full-text Search" description="Implement powerful full-text search with word indexing" href="/docs/recipes/full_text_search" icon={<div>🔍</div>} />

<Card title="Multi-Isolate Usage" description="Use Isar across multiple Dart isolates" href="/docs/recipes/multi_isolate" icon={<div>⚡</div>} />

<Card title="Data Migration" description="Handle schema changes and version updates" href="/docs/recipes/data_migration" icon={<div>🔄</div>} />

<Card title="String IDs" description="Work with String UUIDs and maintain efficient integer IDs" href="/docs/recipes/string_ids" icon={<div>#️⃣</div>} />

<Card title="Migrate from Isar v3" description="Complete guide to migrating from Isar 3.x" href="/docs/recipes/migrate_from_isar3" icon={<div>📦</div>} />
</Cards>

## What are Recipes?

Recipes are practical, real-world solutions to common problems and use cases. Each recipe includes:

* **Problem Statement**: What challenge does it solve?
* **Step-by-step Guide**: How to implement the solution
* **Code Examples**: Working code you can use immediately
* **Best Practices**: Tips for optimal implementation

## Need More Help?

Can't find what you're looking for? Check out:

* [FAQ](/docs/faq) - Common questions and answers
* [Documentation](/docs) - Full API reference
* [GitHub Issues](https://github.com/isar/isar/issues) - Report bugs or request features
# Recipes (/en/docs/recipes)



# Recipes

Explore practical guides and common patterns for using Isar Plus effectively in your applications.

## Available Recipes

<Cards>
  <Card title="Full-text Search" description="Implement powerful full-text search with word indexing" href="/docs/recipes/full_text_search" icon={<div>🔍</div>} />

<Card title="Multi-Isolate Usage" description="Use Isar across multiple Dart isolates" href="/docs/recipes/multi_isolate" icon={<div>⚡</div>} />

<Card title="Data Migration" description="Handle schema changes and version updates" href="/docs/recipes/data_migration" icon={<div>🔄</div>} />

<Card title="String IDs" description="Work with String UUIDs and maintain efficient integer IDs" href="/docs/recipes/string_ids" icon={<div>#️⃣</div>} />

<Card title="Migrate from Isar v3" description="Complete guide to migrating from Isar 3.x" href="/docs/recipes/migrate_from_isar3" icon={<div>📦</div>} />
</Cards>

## What are Recipes?

Recipes are practical, real-world solutions to common problems and use cases. Each recipe includes:

* **Problem Statement**: What challenge does it solve?
* **Step-by-step Guide**: How to implement the solution
* **Code Examples**: Working code you can use immediately
* **Best Practices**: Tips for optimal implementation

## Need More Help?

Can't find what you're looking for? Check out:

* [FAQ](/docs/faq) - Common questions and answers
* [Documentation](/docs) - Full API reference
* [GitHub Issues](https://github.com/isar/isar/issues) - Report bugs or request features
# Full-text Search (/en/docs/recipes/full_text_search)



# Full-text Search

Full-text search is a powerful way to search text in the database. You should already be familiar with how [indexes](/docs/indexes) work, but let's go over the basics.

An index works like a lookup table, allowing the query engine to find records with a given value quickly. For example, if you have a `title` field in your object, you can create an index on that field to make it faster to find objects with a given title.

## Why is full-text search useful?

You can easily search text using filters. There are various string operations for example `.startsWith()`, `.contains()` and `.matches()`. The problem with filters is that their runtime is `O(n)` where `n` is the number of records in the collection. String operations like `.matches()` are especially expensive.

<Callout type="info" title="Performance Advantage">
  Full-text search is much faster than filters, but indexes have some limitations. In this recipe, we will explore how to work around these limitations.
</Callout>

## Basic example

The idea is always the same: Instead of indexing the whole text, we index the words in the text so we can search for them individually.

Let's create the most basic full-text index:

```dart title="message.dart"
class Message {
  Id? id;

  late String content;

  @Index()
  List<String> get contentWords => content.split(' ');
}
```

We can now search for messages with specific words in the content:

```dart
final posts = await isar.messages
  .where()
  .contentWordsAnyEqualTo('hello')
  .findAll();
```

This query is super fast, but there are some problems:

1. We can only search for entire words
2. We do not consider punctuation
3. We do not support other whitespace characters

## Splitting text the right way

Let's try to improve the previous example. We could try to develop a complicated regex to fix word splitting, but it will likely be slow and wrong for edge cases.

The [Unicode Annex #29](https://unicode.org/reports/tr29/) defines how to split text into words correctly for almost all languages. It is quite complicated, but fortunately, Isar does the heavy lifting for us:

<Tabs items={['Basic Examples', 'Advanced Examples']}>
<Tab value="Basic Examples">
```dart
Isar.splitWords('hello world'); 
// -> ['hello', 'world']
```
</Tab>

  <Tab value="Advanced Examples">
    ```dart
    Isar.splitWords('The quick ("brown") fox can't jump 32.3 feet, right?');
    // -> ['The', 'quick', 'brown', 'fox', 'can't', 'jump', '32.3', 'feet', 'right']
    ```
  </Tab>
</Tabs>

## Advanced matching control

Easy peasy! We can change our index also to support prefix matching and case-insensitive matching:

```dart title="post.dart"
class Post {
  Id? id;

  late String title;

  @Index(type: IndexType.value, caseSensitive: false)
  List<String> get titleWords => title.split(' ');
}
```

By default, Isar will store the words as hashed values which is fast and space efficient. But hashes can't be used for prefix matching. Using `IndexType.value`, we can change the index to use the words directly instead. It gives us the `.titleWordsAnyStartsWith()` where clause:

```dart
final posts = await isar.posts
  .where()
  .titleWordsAnyStartsWith('hel')
  .or()
  .titleWordsAnyStartsWith('welco')
  .or()
  .titleWordsAnyStartsWith('howd')
  .findAll();
```

## Suffix matching with `.endsWith()`

Sure thing! We will use a trick to achieve `.endsWith()` matching:

```dart title="post_with_suffix.dart"
class Post {
    Id? id;

    late String title;

    @Index(type: IndexType.value, caseSensitive: false)
    List<String> get revTitleWords {
        return Isar.splitWords(title).map(
          (word) => word.reversed).toList()
        );
    }
}
```

Don't forget reversing the ending you want to search for:

```dart
final posts = await isar.posts
  .where()
  .revTitleWordsAnyStartsWith('lcome'.reversed)
  .findAll();
```

## Stemming algorithms

Unfortunately, indexes do not support `.contains()` matching (this is true for other databases as well). But there are a few alternatives that are worth exploring. The choice highly depends on your use case. One example is indexing word stems instead of the whole word.

A stemming algorithm is a process of linguistic normalization in which the variant forms of a word are reduced to a common form:

<Tabs items={['Example', 'Variants']}>
<Tab value="Example">
```
connection
connections
connective          --->   connect
connected
connecting
```
</Tab>

  <Tab value="Variants">
    Popular stemming algorithms:

    * **Porter stemming algorithm**: Classic English stemmer
    * **Snowball stemming algorithms**: Multi-language support
    * **Lemmatization**: More advanced linguistic normalization
  </Tab>
</Tabs>

Popular algorithms are the [Porter stemming algorithm](https://tartarus.org/martin/PorterStemmer/) and the [Snowball stemming algorithms](https://snowballstem.org/algorithms/).

There are also more advanced forms like [lemmatization](https://en.wikipedia.org/wiki/Lemmatisation).

## Phonetic algorithms

A [phonetic algorithm](https://en.wikipedia.org/wiki/Phonetic_algorithm) is an algorithm for indexing words by their pronunciation. In other words, it allows you to find words that sound similar to the ones you are looking for.

<Callout type="warn" title="Language Limitation">
  Most phonetic algorithms only support a single language.
</Callout>

### Soundex

[Soundex](https://en.wikipedia.org/wiki/Soundex) is a phonetic algorithm for indexing names by sound, as pronounced in English. The goal is for homophones to be encoded to the same representation so they can be matched despite minor differences in spelling.

<Tabs items={['Examples', 'How It Works']}>
<Tab value="Examples">
```
"Robert"   -> "R163"
"Rupert"   -> "R163"
"Rubin"    -> "R150"
"Ashcraft" -> "A261"
"Ashcroft" -> "A261"
```
</Tab>

  <Tab value="How It Works">
    Using this algorithm, homophones are encoded to the same representation so they can be matched despite minor differences in spelling. It is a straightforward algorithm, and there are multiple improved versions.
  </Tab>
</Tabs>

### Double Metaphone

The [Double Metaphone](https://en.wikipedia.org/wiki/Metaphone) phonetic encoding algorithm is the second generation of this algorithm. It makes several fundamental design improvements over the original Metaphone algorithm.

Double Metaphone accounts for various irregularities in English of Slavic, Germanic, Celtic, Greek, French, Italian, Spanish, Chinese, and other origins.
# Data Migration (/en/docs/recipes/data_migration)



# Data Migration

Isar automatically migrates your database schemas if you add or remove collections, fields, or indexes. Sometimes you might want to migrate your data as well. Isar does not offer a built-in solution because it would impose arbitrary migration restrictions. It is easy to implement migration logic that fits your needs.

We want to use a single version for the entire database in this example. We use shared preferences to store the current version and compare it to the version we want to migrate to. If the versions do not match, we migrate the data and update the version.

<Callout type="info" title="Flexible Versioning">
  You could also give each collection its own version and migrate them individually.
</Callout>

## Schema Evolution Example

Imagine we have a user collection with a birthday field. In version 2 of our app, we need an additional birth year field to query users based on age.

<Tabs items={['Version 1', 'Version 2']}>
<Tab value="Version 1">
```dart title="user_v1.dart"
@collection
class User {
Id? id;

      late String name;

      late DateTime birthday;
    }
    ```
  </Tab>

  <Tab value="Version 2">
    ```dart title="user_v2.dart"
    @collection
    class User {
      Id? id;

      late String name;

      late DateTime birthday;

      short get birthYear => birthday.year;
    }
    ```
  </Tab>
</Tabs>

The problem is the existing user models will have an empty `birthYear` field because it did not exist in version 1. We need to migrate the data to set the `birthYear` field.

## Implementation

<Steps>
  ### Check Current Version

Use SharedPreferences to track the database version and determine if migration is needed.

### Perform Migration

Loop through all records and update them with the new field values.

### Update Version

Mark the migration as complete by updating the stored version number.
</Steps>

```dart title="main.dart"
import 'package:isar_plus/isar_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() async {
  final dir = await getApplicationDocumentsDirectory();
  
  final isar = Isar.open(
    schemas: [UserSchema],
    directory: dir.path,
  );

  await performMigrationIfNeeded(isar);

  runApp(MyApp(isar: isar));
}

Future<void> performMigrationIfNeeded(Isar isar) async {
  final prefs = await SharedPreferences.getInstance();
  final currentVersion = prefs.getInt('version') ?? 2;
  
  switch(currentVersion) {
    case 1:
      await migrateV1ToV2(isar);
      break;
    case 2:
      // If the version is not set (new installation) or already 2, 
      // we do not need to migrate
      return;
    default:
      throw Exception('Unknown version: $currentVersion');
  }

  // Update version
  await prefs.setInt('version', 2);
}

Future<void> migrateV1ToV2(Isar isar) async {
  final userCount = await isar.users.count();

  // We paginate through the users to avoid loading all users 
  // into memory at once
  for (var i = 0; i < userCount; i += 50) {
    final users = await isar.users
      .where()
      .offset(i)
      .limit(50)
      .findAll();
      
    await isar.writeAsync((isar) async {
      // We don't need to update anything since the birthYear 
      // getter is used
      await isar.users.putAll(users);
    });
  }
}
```

## Best Practices

<Callout type="warn" title="Performance Consideration">
  If you have to migrate a lot of data, consider using a background isolate to prevent strain on the UI thread.
</Callout>

### Pagination

Always process records in batches (50-100 records) to avoid memory issues:

```dart
for (var i = 0; i < totalCount; i += batchSize) {
  final batch = await collection.where().offset(i).limit(batchSize).findAll();
  // Process batch...
}
```

### Error Handling

Wrap migration logic in try-catch blocks and consider rollback strategies:

```dart
try {
  await migrateV1ToV2(isar);
  await prefs.setInt('version', 2);
} catch (e) {
  // Log error and keep old version
  print('Migration failed: $e');
  // Don't update version number
}
```

### Version Management

Consider using an enum for version tracking:

```dart
enum DatabaseVersion {
  v1(1),
  v2(2),
  v3(3);

  const DatabaseVersion(this.value);
  final int value;
}
```

### Testing Migrations

Test migration logic thoroughly before deployment:

```dart
void testMigration() async {
  // Create test database with v1 data
  // Run migration
  // Verify v2 data integrity
}
```
# String IDs (/en/docs/recipes/string_ids)



# String IDs

This is one of the most frequent requests I get, so here is a tutorial on using String ids.

Isar does not natively support String ids, and there is a good reason for it: integer ids are much more efficient and faster. Especially for links, the overhead of a String id is too significant.

<Callout type="info" title="Best of Both Worlds">
  I understand that sometimes you have to store external data that uses UUIDs or other non-integer ids. I recommend storing the String id as a property in your object and using a fast hash implementation to generate a 64-bit int that can be used as Id.
</Callout>

## Implementation

<Steps>
  ### Add String ID Field

Store your UUID or external ID as a regular string property.

### Generate Integer ID

Use a fast hash function to convert the string to a 64-bit integer.

### Use for Links

The integer ID will be used for efficient links and indexing.
</Steps>

```dart title="user.dart"
@collection
class User {
  String? id;

  Id get isarId => fastHash(id!);

  String? name;

  int? age;
}
```

With this approach, you get the best of both worlds: Efficient integer ids for links and the ability to use String ids.

## Fast Hash Function

Ideally, your hash function should have high quality (you don't want collisions) and be fast. I recommend using the following implementation:

```dart title="fast_hash.dart"
/// FNV-1a 64bit hash algorithm optimized for Dart Strings
int fastHash(String string) {
  var hash = 0xcbf29ce484222325;

  var i = 0;
  while (i < string.length) {
    final codeUnit = string.codeUnitAt(i++);
    hash ^= codeUnit >> 8;
    hash *= 0x100000001b3;
    hash ^= codeUnit & 0xFF;
    hash *= 0x100000001b3;
  }

  return hash;
}
```

### Hash Function Requirements

If you choose a different hash function, ensure it:

* Returns a 64-bit integer
* Has low collision rates
* Is fast (avoid cryptographic hashes)
* Is consistent across platforms

<Callout type="warn" title="Platform Stability">
  Avoid using `string.hashCode` because it is not guaranteed to be stable across different platforms and versions of Dart.
</Callout>

## Usage Example

```dart title="example.dart"
void main() async {
  final isar = Isar.open(schemas: [UserSchema]);

  // Create user with UUID
  final user = User()
    ..id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
    ..name = 'John Doe'
    ..age = 30;

  // The isarId getter automatically generates the integer ID
  await isar.writeAsync((isar) async {
    await isar.users.put(user);
  });

  // Query by string ID
  final foundUser = await isar.users
    .where()
    .idEqualTo('f47ac10b-58cc-4372-a567-0e02b2c3d479')
    .findFirst();

  // Or by integer ID for faster lookups
  final byIntId = await isar.users.get(fastHash(user.id!));
}
```

## Alternative Hash Functions

### MurmurHash3

```dart
int murmurHash3(String string) {
  var hash = 0x811c9dc5;
  for (var i = 0; i < string.length; i++) {
    hash ^= string.codeUnitAt(i);
    hash *= 0x01000193;
  }
  return hash;
}
```

### CityHash (for longer strings)

For longer UUIDs or strings, consider using CityHash which has better collision resistance for longer inputs.

## Performance Comparison

| Hash Function   | Speed | Collision Rate     | Best For     |
| --------------- | ----- | ------------------ | ------------ |
| FNV-1a          | ⚡⚡⚡   | Low                | General use  |
| MurmurHash3     | ⚡⚡    | Very Low           | UUID/GUID    |
| CityHash        | ⚡     | Very Low           | Long strings |
| String.hashCode | ⚡⚡⚡   | Platform dependent | ❌ Avoid      |

<Callout type="info" title="Recommendation">
  For most UUID/GUID scenarios, the FNV-1a implementation provided above offers the best balance of speed and collision resistance.
</Callout>
