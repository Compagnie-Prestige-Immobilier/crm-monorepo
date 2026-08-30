# Queries (/en/docs/queries)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Steps } from "fumadocs-ui/components/steps";

# Queries

Querying is how you find records that match certain conditions. Learn how to build powerful queries and optimize them with indexes.

<Callout type="info">
  Queries are executed on the database, not in Dart, making them incredibly
  fast!
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

<Tabs items={["Equality", "Comparison", "Range", "Null Check"]}>
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
      .findAllAsync();
    // -> [39, null]

    // Include the boundary
    final result2 = await isar.shoes.where()
      .sizeLessThan(40, include: true)
      .findAllAsync();
    // -> [39, null, 40]
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
      .findAllAsync();
    // -> [40, 46]
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

<Tabs items={["StartsWith", "Contains", "EndsWith", "Matches"]}>
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
  All string operations have an optional `caseSensitive` parameter that defaults
  to `true`.
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
  Using `buildQuery` requires intimate knowledge of your schema's property
  indices. It is recommended to use the generated `.where()` API whenever
  possible.
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

<Tabs items={["Length", "Contains", "Empty"]}>
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
    // Equivalent to: tweets.where((t) => t.hashtags.contains('flutter'))
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

## Querying Relationships

Isar Plus v4 removed the legacy `IsarLink` and `IsarLinks` types. Instead, relationships are modeled using **embedded objects** or **manual ID references**. See the [Relationships](./relationships) page for full details.

### Embedded Objects

When related data doesn't need to be queried independently, embed it directly:

```dart
@collection
class Student {
  Id? id;
  late String name;
  final List<TeacherInfo> teachers; // embedded list
}

@embedded
class TeacherInfo {
  TeacherInfo({this.name = '', this.subject = ''});
  final String name;
  final String subject;
}
```

```dart
// Find students with a math teacher using element matchers
final students = await isar.students
  .where()
  .filter()
  .teachersElement((q) => q.subjectEqualTo('Math'))
  .findAllAsync();

// Query by embedded list length
final studentsWithManyTeachers = await isar.students
  .where()
  .filter()
  .teachersLengthGreaterThan(3)
  .findAllAsync();
```

### Manual ID References

For many-to-many or independently queried relationships, store foreign keys explicitly:

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
  final List<int> teacherIds; // foreign key list
}
```

```dart
// Find a student's teachers by their IDs
final student = await isar.students.getAsync(1);
final teachers = await isar.teachers
  .where()
  .filter()
  .anyOf(student!.teacherIds, (q, id) => q.idEqualTo(id))
  .findAllAsync();

// Find students who have a specific teacher
final mathTeacher = await isar.teachers
  .where()
  .subjectEqualTo('Math')
  .findFirstAsync();

final studentsWithMathTeacher = await isar.students
  .where()
  .filter()
  .teacherIdsElementEqualTo(mathTeacher!.id!)
  .findAllAsync();
```

<Callout type="info">
  Embedded objects are stored inline with the parent record—no extra queries needed.
  Manual ID references require explicit queries but allow independent entity management.
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

<Tabs items={["findAll", "findFirst", "count", "isEmpty"]}>
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
  Sorting without indexes is expensive for large datasets. Use indexed where
  clauses for sorting when possible.
</Callout>

## Limit & Offset

```dart
// Get first 10 results
final first10 = await isar.shoes
  .where()
  .findAllAsync(limit: 10);

// Skip first 20, get next 10
final paginated = await isar.shoes
  .where()
  .findAllAsync(offset: 20, limit: 10);
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
# Schema (/en/docs/schema)


import { Callout } from "fumadocs-ui/components/callout";
import { Tabs, Tab } from "fumadocs-ui/components/tabs";

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
# Create, Read, Update, Delete (/en/docs/crud)


import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { Steps } from 'fumadocs-ui/components/steps';

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
# Queries (/en/docs/queries)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Steps } from "fumadocs-ui/components/steps";

# Queries

Querying is how you find records that match certain conditions. Learn how to build powerful queries and optimize them with indexes.

<Callout type="info">
  Queries are executed on the database, not in Dart, making them incredibly
  fast!
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

<Tabs items={["Equality", "Comparison", "Range", "Null Check"]}>
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
      .findAllAsync();
    // -> [39, null]

    // Include the boundary
    final result2 = await isar.shoes.where()
      .sizeLessThan(40, include: true)
      .findAllAsync();
    // -> [39, null, 40]
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
      .findAllAsync();
    // -> [40, 46]
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

<Tabs items={["StartsWith", "Contains", "EndsWith", "Matches"]}>
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
  All string operations have an optional `caseSensitive` parameter that defaults
  to `true`.
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
  Using `buildQuery` requires intimate knowledge of your schema's property
  indices. It is recommended to use the generated `.where()` API whenever
  possible.
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

<Tabs items={["Length", "Contains", "Empty"]}>
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
    // Equivalent to: tweets.where((t) => t.hashtags.contains('flutter'))
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

## Querying Relationships

Isar Plus v4 removed the legacy `IsarLink` and `IsarLinks` types. Instead, relationships are modeled using **embedded objects** or **manual ID references**. See the [Relationships](./relationships) page for full details.

### Embedded Objects

When related data doesn't need to be queried independently, embed it directly:

```dart
@collection
class Student {
  Id? id;
  late String name;
  final List<TeacherInfo> teachers; // embedded list
}

@embedded
class TeacherInfo {
  TeacherInfo({this.name = '', this.subject = ''});
  final String name;
  final String subject;
}
```

```dart
// Find students with a math teacher using element matchers
final students = await isar.students
  .where()
  .filter()
  .teachersElement((q) => q.subjectEqualTo('Math'))
  .findAllAsync();

// Query by embedded list length
final studentsWithManyTeachers = await isar.students
  .where()
  .filter()
  .teachersLengthGreaterThan(3)
  .findAllAsync();
```

### Manual ID References

For many-to-many or independently queried relationships, store foreign keys explicitly:

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
  final List<int> teacherIds; // foreign key list
}
```

```dart
// Find a student's teachers by their IDs
final student = await isar.students.getAsync(1);
final teachers = await isar.teachers
  .where()
  .filter()
  .anyOf(student!.teacherIds, (q, id) => q.idEqualTo(id))
  .findAllAsync();

// Find students who have a specific teacher
final mathTeacher = await isar.teachers
  .where()
  .subjectEqualTo('Math')
  .findFirstAsync();

final studentsWithMathTeacher = await isar.students
  .where()
  .filter()
  .teacherIdsElementEqualTo(mathTeacher!.id!)
  .findAllAsync();
```

<Callout type="info">
  Embedded objects are stored inline with the parent record—no extra queries needed.
  Manual ID references require explicit queries but allow independent entity management.
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

<Tabs items={["findAll", "findFirst", "count", "isEmpty"]}>
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
  Sorting without indexes is expensive for large datasets. Use indexed where
  clauses for sorting when possible.
</Callout>

## Limit & Offset

```dart
// Get first 10 results
final first10 = await isar.shoes
  .where()
  .findAllAsync(limit: 10);

// Skip first 20, get next 10
final paginated = await isar.shoes
  .where()
  .findAllAsync(offset: 20, limit: 10);
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
# Queries (/en/docs/queries)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Steps } from "fumadocs-ui/components/steps";

# Queries

Querying is how you find records that match certain conditions. Learn how to build powerful queries and optimize them with indexes.

<Callout type="info">
  Queries are executed on the database, not in Dart, making them incredibly
  fast!
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

<Tabs items={["Equality", "Comparison", "Range", "Null Check"]}>
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
      .findAllAsync();
    // -> [39, null]

    // Include the boundary
    final result2 = await isar.shoes.where()
      .sizeLessThan(40, include: true)
      .findAllAsync();
    // -> [39, null, 40]
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
      .findAllAsync();
    // -> [40, 46]
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

<Tabs items={["StartsWith", "Contains", "EndsWith", "Matches"]}>
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
  All string operations have an optional `caseSensitive` parameter that defaults
  to `true`.
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
  Using `buildQuery` requires intimate knowledge of your schema's property
  indices. It is recommended to use the generated `.where()` API whenever
  possible.
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

<Tabs items={["Length", "Contains", "Empty"]}>
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
    // Equivalent to: tweets.where((t) => t.hashtags.contains('flutter'))
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

## Querying Relationships

Isar Plus v4 removed the legacy `IsarLink` and `IsarLinks` types. Instead, relationships are modeled using **embedded objects** or **manual ID references**. See the [Relationships](./relationships) page for full details.

### Embedded Objects

When related data doesn't need to be queried independently, embed it directly:

```dart
@collection
class Student {
  Id? id;
  late String name;
  final List<TeacherInfo> teachers; // embedded list
}

@embedded
class TeacherInfo {
  TeacherInfo({this.name = '', this.subject = ''});
  final String name;
  final String subject;
}
```

```dart
// Find students with a math teacher using element matchers
final students = await isar.students
  .where()
  .filter()
  .teachersElement((q) => q.subjectEqualTo('Math'))
  .findAllAsync();

// Query by embedded list length
final studentsWithManyTeachers = await isar.students
  .where()
  .filter()
  .teachersLengthGreaterThan(3)
  .findAllAsync();
```

### Manual ID References

For many-to-many or independently queried relationships, store foreign keys explicitly:

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
  final List<int> teacherIds; // foreign key list
}
```

```dart
// Find a student's teachers by their IDs
final student = await isar.students.getAsync(1);
final teachers = await isar.teachers
  .where()
  .filter()
  .anyOf(student!.teacherIds, (q, id) => q.idEqualTo(id))
  .findAllAsync();

// Find students who have a specific teacher
final mathTeacher = await isar.teachers
  .where()
  .subjectEqualTo('Math')
  .findFirstAsync();

final studentsWithMathTeacher = await isar.students
  .where()
  .filter()
  .teacherIdsElementEqualTo(mathTeacher!.id!)
  .findAllAsync();
```

<Callout type="info">
  Embedded objects are stored inline with the parent record—no extra queries needed.
  Manual ID references require explicit queries but allow independent entity management.
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

<Tabs items={["findAll", "findFirst", "count", "isEmpty"]}>
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
  Sorting without indexes is expensive for large datasets. Use indexed where
  clauses for sorting when possible.
</Callout>

## Limit & Offset

```dart
// Get first 10 results
final first10 = await isar.shoes
  .where()
  .findAllAsync(limit: 10);

// Skip first 20, get next 10
final paginated = await isar.shoes
  .where()
  .findAllAsync(offset: 20, limit: 10);
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

# Indexes (/en/docs/indexes)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Steps } from "fumadocs-ui/components/steps";

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
  Composite indexes can also use only the first property:
  `.lastNameEqualTo('Doe')`
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
  Multi-entry indexes can significantly increase database size for lists with
  many elements.
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
  Case-insensitive indexes take slightly more space but provide flexible
  queries.
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

<Tabs items={["Without Index", "With Index"]}>
  <Tab value="Without Index">
    ```dart
    // ❌ Slow - loads all, then sorts
    final cheapest = await isar.products
      .where()
      .sortByPrice()
      .findAll(limit: 4);
    ```
  </Tab>

  <Tab value="With Index">
    ```dart
    // ✅ Fast - uses sorted index
    final cheapest = await isar.products
      .where()
      .anyPrice()
      .findAll(limit: 4);
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
  .findAll(limit: 10);

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
  * Only the first 1024 bytes of strings are indexed - Maximum of 3 properties
    in composite indexes (on web) - Indexes increase write operation time -
    Indexes consume additional storage
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
# Indexes (/en/docs/indexes)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Steps } from "fumadocs-ui/components/steps";

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
  Composite indexes can also use only the first property:
  `.lastNameEqualTo('Doe')`
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
  Multi-entry indexes can significantly increase database size for lists with
  many elements.
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
  Case-insensitive indexes take slightly more space but provide flexible
  queries.
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

<Tabs items={["Without Index", "With Index"]}>
  <Tab value="Without Index">
    ```dart
    // ❌ Slow - loads all, then sorts
    final cheapest = await isar.products
      .where()
      .sortByPrice()
      .findAll(limit: 4);
    ```
  </Tab>

  <Tab value="With Index">
    ```dart
    // ✅ Fast - uses sorted index
    final cheapest = await isar.products
      .where()
      .anyPrice()
      .findAll(limit: 4);
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
  .findAll(limit: 10);

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
  * Only the first 1024 bytes of strings are indexed - Maximum of 3 properties
    in composite indexes (on web) - Indexes increase write operation time -
    Indexes consume additional storage
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
# Indexes (/en/docs/indexes)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";
import { Steps } from "fumadocs-ui/components/steps";

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
  Composite indexes can also use only the first property:
  `.lastNameEqualTo('Doe')`
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
  Multi-entry indexes can significantly increase database size for lists with
  many elements.
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
  Case-insensitive indexes take slightly more space but provide flexible
  queries.
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

<Tabs items={["Without Index", "With Index"]}>
  <Tab value="Without Index">
    ```dart
    // ❌ Slow - loads all, then sorts
    final cheapest = await isar.products
      .where()
      .sortByPrice()
      .findAll(limit: 4);
    ```
  </Tab>

  <Tab value="With Index">
    ```dart
    // ✅ Fast - uses sorted index
    final cheapest = await isar.products
      .where()
      .anyPrice()
      .findAll(limit: 4);
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
  .findAll(limit: 10);

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
  * Only the first 1024 bytes of strings are indexed - Maximum of 3 properties
    in composite indexes (on web) - Indexes increase write operation time -
    Indexes consume additional storage
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
# Transactions (/en/docs/transactions)


import { Tabs, Tab } from 'fumadocs-ui/components/tabs';
import { Callout } from 'fumadocs-ui/components/callout';
import { Steps } from 'fumadocs-ui/components/steps';

# Transactions

Transactions combine multiple database operations in a single atomic unit of work. Isar provides ACID-compliant transactions with automatic rollback.

<Callout type="success">
  All Isar transactions are ACID compliant - Atomic, Consistent, Isolated, Durable.
</Callout>

## Overview

Transactions ensure data consistency:

* **Atomic** - All operations succeed or none do
* **Consistent** - Data remains valid
* **Isolated** - Concurrent transactions don't interfere
* **Durable** - Committed changes persist

## Transaction Types

| Type  | Sync Method | Async Method    | Use Case           |
| ----- | ----------- | --------------- | ------------------ |
| Read  | `.read()`   | `.readAsync()`  | Consistent reads   |
| Write | `.write()`  | `.writeAsync()` | Data modifications |

<Callout type="info">
  Most read operations use implicit transactions automatically.
</Callout>

## Read Transactions

Read transactions provide a consistent snapshot of the database:

```dart
@collection
class Contact {
  Id? id;
  late String name;
  late int age;
}
```

<Tabs items={['Async', 'Sync', 'Implicit']}>
  <Tab value="Async">
    ```dart
    // Explicit async read transaction
    final result = await isar.readAsync((isar) async {
      final contacts = isar.contacts.where().findAll();
      final count = isar.contacts.count();
      
      return {
        'contacts': contacts,
        'count': count,
      };
    });
    ```
  </Tab>

  <Tab value="Sync">
    ```dart
    // Synchronous read transaction
    final result = isar.read((isar) {
      final contacts = isar.contacts.where().findAll();
      final count = isar.contacts.count();
      
      return {
        'contacts': contacts,
        'count': count,
      };
    });
    ```
  </Tab>

  <Tab value="Implicit">
    ```dart
    // Implicit transaction (automatic)
    final contacts = await isar.contacts.where().findAllAsync();
    // Isar wraps this in a transaction automatically
    ```
  </Tab>
</Tabs>

<Callout type="success">
  Async read transactions run in parallel with other transactions!
</Callout>

## Write Transactions

All write operations must be wrapped in an explicit transaction:

```dart
await isar.writeAsync((isar) async {
  final contact = Contact()
    ..name = 'John Doe'
    ..age = 25;
  
  isar.contacts.put(contact);
});
```

### Auto Commit

Transactions auto-commit on success:

```dart
await isar.writeAsync((isar) async {
  isar.contacts.put(contact1);
  isar.contacts.put(contact2);
  isar.contacts.put(contact3);
  // All changes committed together ✅
});
```

### Auto Rollback

Transactions auto-rollback on error:

```dart
try {
  await isar.writeAsync((isar) async {
    isar.contacts.put(contact1); // ✅ Executed
    isar.contacts.put(contact2); // ✅ Executed
    throw Exception('Error!');
    isar.contacts.put(contact3); // ❌ Not executed
  });
} catch (e) {
  // All changes rolled back ↩️
  print('Transaction failed: $e');
}
```

<Callout type="error">
  When a transaction fails, it must not be used again, even if you catch the error.
</Callout>

## Best Practices

### ✅ DO: Batch Operations

```dart
// ✅ Good - Single transaction
await isar.writeAsync((isar) async {
  for (var contact in contacts) {
    isar.contacts.put(contact);
  }
});

// ✅ Even better - Bulk operation
await isar.writeAsync((isar) async {
  isar.contacts.putAll(contacts);
});
```

### ❌ DON'T: Multiple Transactions

```dart
// ❌ Bad - Many transactions (slow!)
for (var contact in contacts) {
  await isar.writeAsync((isar) async {
    isar.contacts.put(contact);
  });
}
```

### ✅ DO: Minimize Transaction Scope

```dart
// ✅ Good - Prepare data outside transaction
final processedContacts = contacts.map((c) => 
  Contact()
    ..name = c.name.toUpperCase()
    ..age = c.age
).toList();

await isar.writeAsync((isar) async {
  isar.contacts.putAll(processedContacts);
});
```

### ❌ DON'T: Heavy Operations Inside

```dart
// ❌ Bad - Heavy processing in transaction
await isar.writeAsync((isar) async {
  final processedContacts = contacts.map((c) => 
    Contact()
      ..name = c.name.toUpperCase()
      ..age = c.age
  ).toList();
  
  isar.contacts.putAll(processedContacts);
});
```

### ❌ DON'T: Network Calls

```dart
// ❌ Very Bad - Network call in transaction
await isar.writeAsync((isar) async {
  final response = await http.get('https://api.example.com/data');
  final contacts = parseContacts(response.body);
  isar.contacts.putAll(contacts);
});

// ✅ Good - Network call outside
final response = await http.get('https://api.example.com/data');
final contacts = parseContacts(response.body);

await isar.writeAsync((isar) async {
  isar.contacts.putAll(contacts);
});
```

<Callout type="warning">
  Never perform network calls, file I/O, or other long-running operations inside transactions!
</Callout>

## Complex Transactions

### Multiple Collections

```dart
await isar.writeAsync((isar) async {
  // Create user
  final user = User()..name = 'John';
  isar.users.put(user);
  
  // Create profile linked to user
  final profile = Profile()
    ..userId = user.id
    ..bio = 'Developer';
  isar.profiles.put(profile);
  
  // Create posts
  final posts = [
    Post()..userId = user.id..title = 'First Post',
    Post()..userId = user.id..title = 'Second Post',
  ];
  isar.posts.putAll(posts);
  
  // All operations committed together ✅
});
```

### Conditional Operations

```dart
await isar.writeAsync((isar) async {
  final user = await isar.users.get(userId);
  
  if (user != null && user.age >= 18) {
    user.verified = true;
    isar.users.put(user);
  } else {
    throw Exception('User not eligible');
  }
});
```

### Update with Validation

```dart
await isar.writeAsync((isar) async {
  final users = isar.users
    .where()
    .ageGreaterThan(18)
    .findAll();
  
  for (var user in users) {
    if (!user.verified) {
      user.verified = true;
      user.verifiedAt = DateTime.now();
      isar.users.put(user);
    }
  }
});
```

## Transaction Isolation

<Tabs items={['Concurrent Reads', 'Read During Write', 'Write Blocking']}>
  <Tab value="Concurrent Reads">
    ```dart
    // Multiple read transactions run in parallel
    final future1 = isar.readAsync((isar) async {
      return isar.contacts.where().findAll();
    });

    final future2 = isar.readAsync((isar) async {
      return isar.contacts.count();
    });

    // Both execute simultaneously ⚡
    final results = await Future.wait([future1, future2]);
    ```
  </Tab>

  <Tab value="Read During Write">
    ```dart
    // Readers get consistent snapshot
    unawaited(isar.writeAsync((isar) async {
      await Future.delayed(Duration(seconds: 2));
      isar.contacts.put(newContact);
    }));

    // This read sees old data (consistent snapshot)
    final contacts = await isar.contacts.where().findAllAsync();
    // newContact is NOT included
    ```
  </Tab>

  <Tab value="Write Blocking">
    ```dart
    // Write transactions execute serially
    final future1 = isar.writeAsync((isar) async {
      await Future.delayed(Duration(seconds: 1));
      isar.contacts.put(contact1);
    });

    final future2 = isar.writeAsync((isar) async {
      isar.contacts.put(contact2);
    });

    // future2 waits for future1 to complete
    ```
  </Tab>
</Tabs>

## Error Handling

### Basic Error Handling

```dart
try {
  await isar.writeAsync((isar) async {
    isar.contacts.put(contact);
  });
  print('Transaction succeeded');
} catch (e) {
  print('Transaction failed: $e');
  // Changes automatically rolled back
}
```

### Custom Validation

```dart
class ValidationException implements Exception {
  final String message;
  ValidationException(this.message);
}

try {
  await isar.writeAsync((isar) async {
    if (contact.age < 0) {
      throw ValidationException('Age cannot be negative');
    }
    isar.contacts.put(contact);
  });
} on ValidationException catch (e) {
  print('Validation error: ${e.message}');
} catch (e) {
  print('Unexpected error: $e');
}
```

### Retry Logic

```dart
Future<void> putWithRetry(Contact contact, {int maxAttempts = 3}) async {
  for (var attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await isar.writeAsync((isar) async {
        isar.contacts.put(contact);
      });
      return; // Success
    } catch (e) {
      if (attempt == maxAttempts) rethrow;
      await Future.delayed(Duration(milliseconds: 100 * attempt));
    }
  }
}
```

## Synchronous vs Asynchronous

<Tabs items={['When to Use Async', 'When to Use Sync']}>
  <Tab value="When to Use Async">
    ```dart
    // ✅ Use async in UI isolate
    await isar.writeAsync((isar) async {
      isar.contacts.put(contact);
    });

    // Doesn't block UI
    ```
  </Tab>

  <Tab value="When to Use Sync">
    ```dart
    // ✅ Use sync in background isolate
    isar.write((isar) {
      isar.contacts.put(contact);
    });

    // Faster, but blocks current isolate
    ```
  </Tab>
</Tabs>

<Callout>
  Default to async in UI code. Use sync only in background isolates for maximum performance.
</Callout>

## Performance Tips

1. **Batch Operations**
   ```dart
   // ✅ Fast - 1 transaction
   await isar.writeAsync((isar) => isar.contacts.putAll(list));

   // ❌ Slow - N transactions
   for (var item in list) {
     await isar.writeAsync((isar) => isar.contacts.put(item));
   }
   ```

2. **Minimize Duration**
   ```dart
   // ✅ Fast
   final data = prepareData();
   await isar.writeAsync((isar) => isar.contacts.putAll(data));

   // ❌ Slow
   await isar.writeAsync((isar) {
     final data = prepareData(); // Heavy operation
     isar.contacts.putAll(data);
   });
   ```

3. **Use Bulk Operations**
   ```dart
   // ✅ Optimized
   await isar.writeAsync((isar) async {
     isar.contacts.putAll(contacts);
     isar.posts.deleteAll(postIds);
   });
   ```

## Common Patterns

### Create or Update

```dart
await isar.writeAsync((isar) async {
  final existing = isar.users
    .where()
    .emailEqualTo(user.email)
    .findFirst();
  
  if (existing != null) {
    user.id = existing.id; // Reuse ID
  }
  
  isar.users.put(user);
});
```

### Atomic Counter

```dart
Future<int> incrementCounter(String key) async {
  return await isar.writeAsync((isar) async {
    final counter = isar.counters
      .where()
      .keyEqualTo(key)
      .findFirst() ?? Counter()..key = key..value = 0;
    
    counter.value++;
    isar.counters.put(counter);
    return counter.value;
  });
}
```

### Bulk Update

```dart
await isar.writeAsync((isar) async {
  final users = isar.users
    .where()
    .statusEqualTo('pending')
    .findAll();
  
  for (var user in users) {
    user.status = 'active';
  }
  
  isar.users.putAll(users);
});
```

## Next Steps

<Cards>
  <Card title="CRUD Operations" href="/docs/crud">
    Learn basic database operations
  </Card>

  <Card title="Queries" href="/docs/queries">
    Build efficient queries
  </Card>

  <Card title="Watchers" href="/docs/watchers">
    React to data changes
  </Card>

  <Card title="Multi-Isolate" href="/docs/recipes/multi_isolate">
    Use Isar across isolates
  </Card>
</Cards>
# Watchers (/en/docs/watchers)


import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";

# Watchers

Watchers allow you to subscribe to changes in your database and react efficiently. Perfect for real-time UI updates and sync operations.

<Callout type="success">
  Watchers notify you after a transaction commits successfully and the target
  actually changes.
</Callout>

## Overview

You can watch:

* **Specific objects** - Get notified when one object changes
* **Collections** - Get notified when any object in a collection changes
* **Queries** - Get notified when query results change

## Watching Objects

Watch a specific object by its ID:

```dart
@collection
class User {
  Id? id;
  late String name;
  late int age;
}
```

<Tabs items={['Full Object', 'Lazy']}>
  <Tab value="Full Object">
    ```dart
    // Get the updated object
    Stream<User?> userStream = isar.users.watchObject(5);

    userStream.listen((user) {
      if (user == null) {
        print('User deleted');
      } else {
        print('User changed: ${user.name}');
      }
    });

    // Trigger changes
    final user = User()..id = 5..name = 'David'..age = 25;
    await isar.writeAsync((isar) => isar.users.put(user));
    // Output: User changed: David

    user.name = 'Mark';
    await isar.writeAsync((isar) => isar.users.put(user));
    // Output: User changed: Mark

    await isar.writeAsync((isar) => isar.users.delete(5));
    // Output: User deleted
    ```
  </Tab>

  <Tab value="Lazy">
    ```dart
    // Just get notified, don't fetch object
    Stream<void> userStream = isar.users.watchObjectLazy(5);

    userStream.listen((_) {
      print('User 5 changed');
    });

    final user = User()..id = 5..name = 'David'..age = 25;
    await isar.writeAsync((isar) => isar.users.put(user));
    // Output: User 5 changed
    ```
  </Tab>
</Tabs>

<Callout>
  The object doesn't need to exist yet. The watcher will notify you when it's
  created.
</Callout>

### Fire Immediately

Get the current value immediately:

```dart
Stream<User?> userStream = isar.users.watchObject(
  5,
  fireImmediately: true,
);

userStream.listen((user) {
  print('User: ${user?.name}');
});
// Immediately outputs current value (or null)
```

## Watching Collections

Watch all changes in a collection:

<Tabs items={['Lazy', 'Full Objects']}>
  <Tab value="Lazy">
    ```dart
    // Just get notified
    Stream<void> usersStream = isar.users.watchLazy();

    usersStream.listen((_) {
      print('A user changed');
    });

    await isar.writeAsync((isar) async {
      isar.users.put(User()..name = 'Alice');
    });
    // Output: A user changed
    ```
  </Tab>

  <Tab value="Full Objects">
    ```dart
    // Get all objects on each change
    Stream<List<User>> usersStream = isar.users.watch();

    usersStream.listen((users) {
      print('Users: ${users.map((u) => u.name).join(', ')}');
    });

    await isar.writeAsync((isar) async {
      isar.users.put(User()..name = 'Alice');
    });
    // Output: Users: Alice
    ```

    <Callout type="warning">
      Watching collections with full objects can be expensive for large collections!
    </Callout>
  </Tab>
</Tabs>

## Watching Queries

Watch specific query results:

```dart
@collection
class User {
  Id? id;
  late String name;
  late int age;
}
```

```dart
// Build a query
final adultsQuery = isar.users
  .where()
  .ageGreaterThan(18)
  .build();

// Watch query results
Stream<List<User>> adultsStream = adultsQuery.watch(
  fireImmediately: true,
);

adultsStream.listen((adults) {
  print('Adults: ${adults.map((u) => u.name).join(', ')}');
});
// Immediately outputs current results

// Add a child (no notification)
await isar.writeAsync((isar) async {
  isar.users.put(User()..name = 'Child'..age = 10);
});
// No output - doesn't match query

// Add an adult (triggers notification)
await isar.writeAsync((isar) async {
  isar.users.put(User()..name = 'Alice'..age = 25);
});
// Output: Adults: Alice

// Add another adult
await isar.writeAsync((isar) async {
  isar.users.put(User()..name = 'Bob'..age = 30);
});
// Output: Adults: Alice, Bob
```

<Callout type="success">
  Query watchers only notify when results actually change!
</Callout>

### Lazy Query Watching

```dart
final adultsQuery = isar.users
  .where()
  .ageGreaterThan(18)
  .build();

Stream<void> adultsStream = adultsQuery.watchLazy();

adultsStream.listen((_) {
  print('Adult users changed');
});
```

### Query Watcher Limitations

<Callout type="warning">
  When using `offset`, `limit`, or `distinct`, watchers may notify even when
  visible results haven't changed.
</Callout>

```dart
// May over-notify
final topUsersQuery = isar.users
  .where()
  .sortByAge()
  .build();

topUsersQuery.watch(limit: 10).listen((users) {
  // Might trigger even if top 10 didn't change
});
```

## Real-World Examples

### Flutter UI Updates

```dart
class UserListWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<User>>(
      stream: isar.users.where().watch(fireImmediately: true),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return CircularProgressIndicator();
        }

        final users = snapshot.data!;
        return ListView.builder(
          itemCount: users.length,
          itemBuilder: (context, index) {
            final user = users[index];
            return ListTile(
              title: Text(user.name),
              subtitle: Text('Age: ${user.age}'),
            );
          },
        );
      },
    );
  }
}
```

### User Profile

```dart
class UserProfileWidget extends StatelessWidget {
  final int userId;

  const UserProfileWidget({required this.userId});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: isar.users.watchObject(userId, fireImmediately: true),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return Text('User not found');
        }

        final user = snapshot.data!;
        return Column(
          children: [
            Text('Name: ${user.name}'),
            Text('Age: ${user.age}'),
          ],
        );
      },
    );
  }
}
```

### Search Results

```dart
class SearchWidget extends StatefulWidget {
  @override
  _SearchWidgetState createState() => _SearchWidgetState();
}

class _SearchWidgetState extends State<SearchWidget> {
  String searchQuery = '';

  @override
  Widget build(BuildContext context) {
    final query = isar.users
      .where()
      .nameContains(searchQuery, caseSensitive: false)
      .build();

    return Column(
      children: [
        TextField(
          onChanged: (value) {
            setState(() {
              searchQuery = value;
            });
          },
        ),
        Expanded(
          child: StreamBuilder<List<User>>(
            stream: query.watch(fireImmediately: true),
            builder: (context, snapshot) {
              if (!snapshot.hasData) return SizedBox();

              final users = snapshot.data!;
              return ListView.builder(
                itemCount: users.length,
                itemBuilder: (context, index) {
                  return ListTile(
                    title: Text(users[index].name),
                  );
                },
              );
            },
          ),
        ),
      ],
    );
  }
}
```

### Sync to Server

```dart
class SyncService {
  void startWatching() {
    isar.users.watchLazy().listen((_) async {
      await syncUsersToServer();
    });
  }

  Future<void> syncUsersToServer() async {
    final users = await isar.users.where().findAll();
    // Send to server...
  }
}
```

### Cache Invalidation

```dart
class CacheService {
  final _cache = <int, User>{};

  void startWatching() {
    isar.users.watchLazy().listen((_) {
      _cache.clear();
      print('Cache invalidated');
    });
  }

  Future<User?> getUser(int id) async {
    if (_cache.containsKey(id)) {
      return _cache[id];
    }

    final user = await isar.users.get(id);
    if (user != null) {
      _cache[id] = user;
    }
    return user;
  }
}
```

## Performance Considerations

<Tabs items={['Best Practices', 'Anti-Patterns']}>
  <Tab value="Best Practices">
    ```dart
    // ✅ Use lazy watchers when you don't need data
    isar.users.watchLazy().listen((_) {
      // Just invalidate cache or flag for refresh
      needsRefresh = true;
    });

    // ✅ Watch specific queries, not entire collections
    isar.users
      .where()
      .statusEqualTo('active')
      .watch()
      .listen((activeUsers) {
        // Handle active users
      });

    // ✅ Cancel subscriptions when done
    final subscription = isar.users.watchLazy().listen((_) {});
    // Later...
    subscription.cancel();
    ```
  </Tab>

  <Tab value="Anti-Patterns">
    ```dart
    // ❌ Don't watch large collections with full data
    isar.users.watch().listen((allUsers) {
      // This refetches ALL users on ANY change
    });

    // ❌ Don't perform heavy operations in listener
    isar.users.watchLazy().listen((_) async {
      // Heavy operation
      await processAllUsers();
    });

    // ❌ Don't forget to cancel subscriptions
    isar.users.watchLazy().listen((_) {
      // This keeps running forever if not cancelled
    });
    ```
  </Tab>
</Tabs>

## Combining with StreamBuilder

```dart
class MyWidget extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<User>>(
      stream: isar.users
        .where()
        .ageGreaterThan(18)
        .build()
        .watch(fireImmediately: true),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return CircularProgressIndicator();
        }

        if (snapshot.hasError) {
          return Text('Error: ${snapshot.error}');
        }

        if (!snapshot.hasData || snapshot.data!.isEmpty) {
          return Text('No users found');
        }

        final users = snapshot.data!;
        return ListView(
          children: users.map((user) =>
            ListTile(title: Text(user.name))
          ).toList(),
        );
      },
    );
  }
}
```

## Best Practices

1. **Use Lazy Watchers** when you only need notifications
2. **Watch Specific Queries** instead of entire collections
3. **Cancel Subscriptions** when widgets are disposed
4. **Avoid Heavy Operations** in watcher callbacks
5. **Use fireImmediately** for initial UI state

<Callout type="info">
  Watchers are efficient and lightweight. Use them freely to create reactive
  UIs!
</Callout>

## Next Steps

<Cards>
  <Card title="Queries" href="/docs/queries">
    Learn how to build queries for watching
  </Card>

  <Card title="Transactions" href="/docs/transactions">
    Understand when watchers trigger
  </Card>

  <Card title="Multi-Isolate" href="/docs/recipes/multi_isolate">
    Use watchers across isolates
  </Card>
</Cards>
# Limitations (/en/docs/limitations)


import { Callout } from 'fumadocs-ui/components/callout';
import { Tabs, Tab } from 'fumadocs-ui/components/tabs';

# Limitations

Isar Plus works across mobile, desktop, and web platforms. Each platform has different characteristics and limitations.

## Platform Overview

<Tabs items={['VM (Mobile & Desktop)', 'Web', 'All Platforms']}>
  <Tab value="VM (Mobile & Desktop)">
    **Platforms:** iOS, Android, macOS, Linux, Windows

    ### Limitations

    * String prefix where-clauses limited to first 1024 bytes
    * Maximum object size: 16MB

    <Callout type="success">
      VM platforms have minimal limitations and full feature support!
    </Callout>
  </Tab>

  <Tab value="Web">
    **Platforms:** Chrome, Firefox, Safari, Edge

    ### Storage Backends

    <Cards>
      <Card title="OPFS (Modern)" icon="Zap">
        Chrome, Edge (v102+)

        * Fast, native-like performance
        * Persistent storage
        * Full SQLite compatibility
      </Card>

      <Card title="IndexedDB (Fallback)" icon="Database">
        Safari, Firefox, older browsers

        * Some limitations apply
        * Slower than OPFS
        * Good compatibility
      </Card>
    </Cards>

    ### Limitations

    ```dart
    // ❌ Async operations not supported on web (require isolates)
    await isar.writeAsync((isar) => isar.users.put(user));
    await isar.users.getAsync(1);

    // ❌ Watchers not supported on web
    isar.users.watchLazy().listen((_) {});
    isar.users.watchObject(1).listen((user) {});

    // ✅ Use sync APIs on web
    isar.write((isar) => isar.users.put(user));
    final user = isar.users.get(1);
    ```

    <Callout type="error">
      Async operations require isolates which are not available on web.
      Use synchronous APIs instead!
    </Callout>
  </Tab>

  <Tab value="All Platforms">
    ### General Limitations

    * No support for very large transactions (keep under 100MB)
    * Links are lazy-loaded (small overhead on first access)
    * Embedded objects cannot contain other embedded objects (single level only)
  </Tab>
</Tabs>

## VM Limitations

### String Indexing

Only the first 1024 bytes of a string are indexed:

```dart
@collection
class Article {
  Id? id;

  @Index()
  late String title; // ✅ Usually fine

  @Index()
  late String content; // ⚠️ Only first 1024 bytes indexed
}
```

<Callout>
  For full-text search on long strings, use the multi-entry index pattern.
</Callout>

### Object Size

Maximum object size is 16MB:

```dart
@collection
class LargeDocument {
  Id? id;

  // ⚠️ Be careful with large data
  late List<int> fileData;
}
```

<Callout type="warning">
  Store large files outside of Isar and keep only references in the database.
</Callout>

## Web Limitations

### API Compatibility

<Tabs items={['Not Supported', 'Supported']}>
  <Tab value="Not Supported">
    ```dart
    // ❌ Async transactions (require isolates)
    await isar.readAsync((isar) => isar.users.get(1));
    await isar.writeAsync((isar) => isar.users.put(user));
    await isar.users.getAsync(1);
    await isar.users.getAllAsync([1, 2, 3]);

    // ❌ Watchers (require native isolates)
    isar.users.watchLazy().listen((_) {});
    isar.users.watchObject(1).listen((user) {});
    isar.users.watchDetailed().listen((change) {});

    // ❌ Text operations
    Isar.splitWords('hello world');
    isar.users.where().nameMatches('pattern*');
    ```
  </Tab>

  <Tab value="Supported">
    ```dart
    // ✅ Synchronous operations (use these on web)
    final user = isar.users.get(1);
    final users = isar.users.getAll([1, 2, 3]);

    isar.write((isar) => isar.users.put(user));
    isar.read((isar) => isar.users.where().findAll());

    // ✅ Filters and queries
    isar.users.where()
      .nameContains('John')
      .findAll();

    // ✅ Where clauses
    isar.users.where()
      .nameEqualTo('John')
      .findAll();
    ```
  </Tab>
</Tabs>

### IndexedDB Fallback Limitations

When OPFS is not available, IndexedDB fallback has additional limitations:

```dart
// ⚠️ Return values may differ
await isar.writeAsync((isar) async {
  final count = isar.users.deleteAll([1, 2, 3]);
  // OPFS: returns exact count
  // IndexedDB: may return different value
});

// ⚠️ Auto-increment not reset by clear()
await isar.writeAsync((isar) async {
  isar.users.clear();
});
// On OPFS: next ID is 1
// On IndexedDB: next ID continues from before
```

### Schema Migrations

```dart
// ⚠️ Less strict validation on web
@collection
class User {
  Id? id;
  
  late String name;
  
  // Changing type is less validated
  late int age; // was String before
}
```

<Callout type="warning">
  Double-check schema changes on web during releases!
</Callout>

### Text Operations

```dart
// ❌ Not available on web
final words = Isar.splitWords('Hello World');

// ❌ Wildcard matching not available
await isar.users.where()
  .nameMatches('John*')
  .findAll();

// ✅ Use alternative patterns
await isar.users.where()
  .nameStartsWith('John')
  .findAll();

await isar.users.where()
  .nameContains('John')
  .findAll();
```

## Workarounds

### Large Strings

```dart
// Instead of indexing entire content
@collection
class Article {
  Id? id;

  late String title;

  late String content;

  // Create searchable keywords
  @Index(type: IndexType.value)
  late List<String> keywords;
}

// Generate keywords before saving
final article = Article()
  ..title = 'My Article'
  ..content = 'Long content...'
  ..keywords = generateKeywords(content);
```

### File Storage

```dart
@collection
class Document {
  Id? id;

  late String name;

  // Store file path, not content
  late String filePath;

  late int fileSize;
}

// Store actual file separately
final file = File('path/to/file.pdf');
final document = Document()
  ..name = 'Document'
  ..filePath = file.path
  ..fileSize = await file.length();
```

### Web Async Pattern

```dart
// Platform-specific code for async operations
class IsarHelper {
  static Future<User?> getUser(Isar isar, int id) async {
    if (kIsWeb) {
      // Web: use sync API
      return isar.users.get(id);
    } else {
      // Native: can use async for background processing
      return isar.users.getAsync(id);
    }
  }
}
```

### Cross-Platform Text Search

```dart
@collection
class Product {
  Id? id;

  late String name;

  // Store lowercase for case-insensitive search
  @Index(caseSensitive: false)
  late String searchName;
}

// Before saving
product.name = 'iPhone 15 Pro';
product.searchName = product.name.toLowerCase();

// Query works on all platforms
await isar.products
  .where()
  .searchNameContains('iphone')
  .findAll();
```

## Platform Detection

```dart
import 'package:flutter/foundation.dart';

void configureIsar() {
  if (kIsWeb) {
    print('Running on web with limitations');
    // Use async-only APIs
  } else {
    print('Running on native platform');
    // Can use sync APIs for performance
  }
}
```

## Browser Support

| Browser | Version | Storage   | Performance |
| ------- | ------- | --------- | ----------- |
| Chrome  | 102+    | OPFS      | Excellent   |
| Edge    | 102+    | OPFS      | Excellent   |
| Safari  | All     | IndexedDB | Good        |
| Firefox | All     | IndexedDB | Good        |

<Callout type="info">
  OPFS provides near-native performance on Chromium browsers!
</Callout>

## Best Practices

1. **Write Cross-Platform Code**

   ```dart
   // ✅ Sync works everywhere
   isar.write((isar) => isar.users.put(user));
   final user = isar.users.get(1);

   // ⚠️ Async only works on native (mobile/desktop)
   // Throws UnsupportedError on web
   await isar.writeAsync((isar) => isar.users.put(user));
   ```

   ```dart
   // Platform-aware pattern
   if (kIsWeb) {
     isar.write((isar) => isar.users.put(user));
   } else {
     await isar.writeAsync((isar) => isar.users.put(user));
   }
   ```

2. **Test on Target Platforms**
   * Test web builds in different browsers
   * Verify performance on mobile devices
   * Check desktop builds

3. **Handle Platform Differences**
   ```dart
   if (kIsWeb) {
     // Web-specific logic
   } else {
     // Native-specific logic
   }
   ```

4. **Keep Objects Small**
   ```dart
   // Store references, not large data
   @collection
   class Photo {
     Id? id;
     late String url; // Not the image bytes
     late String thumbnailUrl;
   }
   ```

## Migration Notes

When migrating from Isar 3:

<Callout type="warning">
  Isar Plus uses SQLite instead of LMDB. Some behaviors may differ slightly.
</Callout>

See the [Migration Guide](/docs/recipes/migrate_from_isar3) for details.

## Next Steps

<Cards>
  <Card title="FAQ" href="/docs/faq">
    Common questions and answers
  </Card>

  <Card title="Migration Guide" href="/docs/recipes/migrate_from_isar3">
    Migrate from Isar 3
  </Card>

  <Card title="Recipes" href="/docs/recipes">
    Advanced patterns and solutions
  </Card>
</Cards>
