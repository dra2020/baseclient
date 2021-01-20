# filterexpr
Simple utility class for applying a user-provided filtering expression against an object.

## FilterExpr

Optionally initialize with expression to test against.
Or call `set(expr: string)` to set the expression.
The function `test(o: any)` will test the object against the expression.

## Expression syntax

The simplest expression is just a string of text. If any field in the object contains the string, the pattern matches.
All comparisons are case-insensitive.

A quoted string can be used to hide special characters. Single or double quotes are allowed.

Expressions can be combined with `not`, `and`, and `or`. Precedence is in that order.

Expressions can be surrounded by parens to force a precedence interpretation.

A field name can be specified to limit the comparison to a specific field. An example is `state: ma`. Field names are case-insensitive.
Field name is lowest precedence, so `state: ma or tx` would constrain both strings to the `state` property.
