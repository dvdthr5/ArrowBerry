

# JavaScript Style Guide

Disclaimer: Extrapolated parts from the Google JavaScript Style Guide

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

JavaScript code must use paths to import other JavaScript code. Paths may be relative or rooted at the base directory. Code should use relative imports rather than absolute imports when referring to files within the same project as this allows to move the project around without introducing change in these imports. Consider limiting the number of parent steps as those can make module and path structures hard to understand.

### Renaming Imports

Code should fix name collisions by using a namespace import or renaming the exports themselves. Code may rename imports if needed. Three examples where to rename:

1. If it’s necessary to avoid collisions with other imported symbols
2. If the imported symbol name is generated
3. If importing symbols whose names are unclear by themselves, renaming can improve clarity.

## Language Features

### Local Variable Declaration

#### Use Const and let

Always use const or let to declare variables. Use const by default, unless a variable needs to be reassigned. Never use var.

#### One Variable Per Declaration

Every local variable declares only one variable: declarations such as `let a = 1, b = 2;` are not used.

### Classes

#### Class Declarations

Class declarations must not be terminated with semicolons. In contrast, statements that contain class expressions must be terminated with a semicolon.

#### Method Declaration

Class method declarations must not use a semicolon to separate individual method declarations. Method declarations should be separated from surrounding code by a single blank line.

#### Constructors

Constructor calls must use parentheses, even when no arguments are passed. Omitting parentheses can lead to subtle mistakes. Constructors should be separated from surrounding code both above and below by a single blank line.

### Strings

#### Use Single Quotes

Ordinary string literals are delimited with single quotes, rather than double quotes.

#### No Line Continuations

Do not use line continuations in either ordinary or template string literals. Rather use concatenated strings.

### Control Flow Statements and Blocks

Control flow statements (if, else, for, do, while) always use braced blocks for the containing code, even if the body contains only a single statement. The first statement of a non-empty block must begin on its own line.

### Avoid Assignment in Control Statements

Prefer to avoid assignment of variables inside control statements. Assignments can easily be mistaken for equality checks inside control statements. In cases where assignment inside the control statement is preferred, enclose the assignment in additional parentheses to indicate it is intentional.

### Grouping Parenthesis

Optional grouping parenthesis are omitted only when the author and reviewer agree that there is no reasonable chance that the code will be misinterpreted without them, nor would they have made the code easier to read. It is not reasonable to assume that every reader has the entire operator precedence table memorized.

### Only Throw Errors

JavaScript allows throwing or rejecting a promise with arbitrary values. However if the thrown or rejected value is not an error, it does not populate stack trace information, making debugging hard. Instead only throw error or subclasses of error.

### Switch Statements

All switch statements must contain a default statement group, even if it contains no code. The default statement group must be last. Within a switch block, each statement group either terminates abruptly with a break, a return statement, or by throwing an exception. Non-empty statement groups must not fall through. Empty statement groups are allowed to fall through.

### Equality Checks

Always use triple equals (===) and not equals (!==). The double equality operators cause error prone type coercions that are hard to understand. See also the 'javascript equality table'.

### Keep Try Blocks Focussed

Limit the amount of code inside a try block, if this can be done without hurting readability. Moving the non-throwable lines out of the try/catch block helps the reader learn which method throws exceptions. Some inline calls that do not throw exceptions could stay inside because they might not be worth the extra complication of a temporary variable.

### Decorators

Decorators are syntax with an @ prefix, like @MyDecorator. Do not define new decorators, only use the decorators defined by frameworks. When using a decorator, the decorator must immediately precede the symbol it decorates.

## Naming

### Identifiers

Identifiers must only use ASCII letters, digits, underscores, and the $ sign.

### Descriptive Names

Names must be descriptive and clear to a new reader. Do not use abbreviations that are ambiguous or unfamiliar to readers outside your project, and do not abbreviate by deleting letters within a word.

### Camel Case

Treat abbreviations like acronyms in names as whole words, unless required by a platform name.

### Rules by Identifier Type

Most identifier names should follow the casing in table below, based on the identifiers type.

| Style | Category |
| :---- | :---- |
| UpperCamelCase | Class / decorator / component functions / JSXElement type parameter |
| lowerCamelCase | variable / parameter / function / method / property / module alias |
| CONSTANT_CASE | Global constant values |
| #ident | Private identifiers are never used |