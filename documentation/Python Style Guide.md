

# Python Style Guide

Disclaimer: Extrapolated parts from the Google Python Style Guide

## Source File Basics

### File Encoding: UTF-8

All files encoded in UTF8

### Whitespace Characters

Aside from the line terminator sequence, the ASCII horizontal space character is the only whitespace character that appears anywhere in a source file. This implies that all other whitespace characters in string literals are escaped.

### Non-ASCII Characters

For the remaining non-ASCII characters, use the actual unicode character. For non-printable characters, the equivalent hex or unicode escapes can be used along with an explanatory comment.

## Source File Structure

File consists of the following in order:

1. Imports, if present
2. The files implementation

### Import Paths

Python code must use paths to import other Python code. Imports may be relative or absolute. Code should use relative imports rather than absolute imports when referring to files within the same project as this allows the project to move around without introducing change in these imports. Consider limiting the number of parent steps as those can make module and path structures hard to understand.

### Renaming Imports

Code should fix name collisions by using module aliases or renaming imported symbols. Code may rename imports if needed. Three examples where to rename:

1. If it’s necessary to avoid collisions with other imported symbols
2. If the imported symbol name is generated
3. If importing symbols whose names are unclear by themselves, renaming can improve clarity.

## Language Features

### Local Variable Declaration

#### Use Meaningful Variable Assignments

Variables should be assigned descriptive names. Avoid unnecessary reassignment when a value can remain constant throughout its scope.

#### One Variable Per Declaration

Every local variable declaration should declare only one variable. Declarations such as `a, b = 1, 2` are not used.

### Classes

#### Class Declarations

Class declarations must not be terminated with semicolons.

#### Method Declaration

Class method declarations should be separated from surrounding code by a single blank line.

#### Constructors

Constructors should be implemented using the `__init__` method. Constructors should be separated from surrounding code both above and below by a single blank line.

### Strings

#### Use Single Quotes

Ordinary string literals are delimited with single quotes, rather than double quotes.

#### No Line Continuations

Do not use line continuations in string literals. Rather use concatenated strings.

### Control Flow Statements and Blocks

Control flow statements (`if`, `elif`, `else`, `for`, `while`) always use properly indented blocks for the containing code, even if the body contains only a single statement. The first statement of a non-empty block must begin on its own line.

### Avoid Assignment in Control Statements

Prefer to avoid assignment of variables inside control statements. Assignments can easily be mistaken for other expressions inside control statements.

### Grouping Parenthesis

Optional grouping parenthesis are omitted only when the author and reviewer agree that there is no reasonable chance that the code will be misinterpreted without them, nor would they have made the code easier to read. It is not reasonable to assume that every reader has the entire operator precedence table memorized.

### Only Raise Exceptions

Python allows raising arbitrary objects derived from `BaseException`. Only raise exceptions or subclasses of exceptions so that debugging information is preserved and error handling remains consistent.

### Match Statements

All match statements should contain a default case using `case _:` even if it contains no code. Non-empty cases should not fall through.

### Equality Checks

Always use `==` and `!=` for value equality comparisons. Use `is` and `is not` only for identity comparisons.

### Keep Try Blocks Focussed

Limit the amount of code inside a try block, if this can be done without hurting readability. Moving the non-throwable lines out of the try/except block helps the reader learn which method throws exceptions. Some inline calls that do not throw exceptions could stay inside because they might not be worth the extra complication of a temporary variable.

### Decorators

Decorators are syntax with an `@` prefix, like `@my_decorator`. Do not define new decorators unless necessary. When using a decorator, the decorator must immediately precede the symbol it decorates.

## Naming

### Identifiers

Identifiers must only use ASCII letters, digits, and underscores.

### Descriptive Names

Names must be descriptive and clear to a new reader. Do not use abbreviations that are ambiguous or unfamiliar to readers outside your project, and do not abbreviate by deleting letters within a word.

### Snake Case

Treat abbreviations like acronyms in names as whole words, unless required by a platform name.

### Rules by Identifier Type

Most identifier names should follow the casing in table below, based on the identifiers type.

| Style | Category |
| :---- | :---- |
| PascalCase | Class |
| snake_case | variable / parameter / function / method / property / module alias |
| CONSTANT_CASE | Global constant values |
| _ident | Private identifiers |