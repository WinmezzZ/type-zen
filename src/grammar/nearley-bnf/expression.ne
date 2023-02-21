@lexer lexer

@include "./tools.ne"

e_main -> e_mainWithoutUnion {% id %}
    | e_union {% id %}
    | e_getKeyValue {% id %}

# 之所以要将 “除 union 的表达式” 抽取出来，是为了让 **union 表达式内部的递归** 避免递归了其本身，这会导致极大程度的性能损耗、溢出…  
e_mainWithoutUnion -> 
    e_bracketSurround {% id %}
    | e_value {% id %}
    | e_typeReference {% id %}
    | e_condition {% id %}

# e_getKeyValue -> e_mainWithoutUnion _ ("[" _ e_mainWithoutUnion _ "]"):+ {% args => {
#     return toASTNode(ast.GetKeyValueExpression)([args[0], args[2].map(item => item[2])])
# } %}

e_getKeyValue_value -> e_union {% id %}
    | e_mainWithoutUnion {% id %}

e_getKeyValue -> e_getKeyValue _ "[" _ e_getKeyValue_value _ "]" 
    {% args => toASTNode(ast.GetKeyValueExpression)([args[0], args[4]]) %}
    | e_getKeyValue_value {% id %}

# e_tuple -> "[" _ e_main:? (_ "," ) "]"

# a[][][][][]

e_typeReference -> id _ ("<" 
        (_ e_main (_ "," _ e_main):* {% args => [args[1], ...args[2].map(item => item[3])] %}) 
     _ ">"):?  {% args => toASTNode(ast.TypeReferenceExpression)([args[0], ...(args[2] || [])]) %}

e_bracketSurround -> "(" _ e_main _ ")" {% toASTNode(ast.BracketSurroundExpression) %}

e_condition -> 
    e_main _ %extend _ e_main _ "?" _ e_main _ ":" _ e_main {% toASTNode(ast.ConditionExpression) %}

e_value -> %valueKeyword {% toASTNode(ast.ValueKeywordExpression) %} 
    | %string {% toASTNode(ast.StringLiteralExpression) %}
    | %number {% toASTNode(ast.NumberLiteralExpression) %}

# `[]`、`[1]`、`[1,]`、`[1,2]`、`[1,2,]` 内部的元素
e_union_commaSeparation[X] -> 
    $X (_ "," _ $X):* ",":? {% args => [args[0], ...args[1].map(x => x[3])] %}

# `| [1, 2, 3]` 的 union 姿态
e_union_mode1 -> "|" _ "[" _ 
    e_union_commaSeparation[(e_mainWithoutUnion | e_union_mode2) {% id %}]
    _ "]" 
    {% args =>toASTNode(ast.UnionExpression)(args[4].map(item => item[0])) %}

# `| 1 | 2`、`1 | 2 | 3` 的 union 姿态
# TODO：为什么 `("|":? _)` 会出现「解析了2次」的情况？
# TODO：而 `("|" _):?` 则不会？
e_union_mode2 -> ("|" _):? e_mainWithoutUnion (_ "|" _ e_mainWithoutUnion):+ 
    {% args => toASTNode(ast.UnionExpression)([args[1], ...args[2].map(item => item[3])]) %}

e_union -> e_union_mode1 {% id %}
    | e_union_mode2 {% id %}

