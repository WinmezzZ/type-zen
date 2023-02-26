import zod from "zod";
import { AST } from "../types";
import { ExpressionBase } from "./base";
import { IdentifierExpression } from "./identifier";
import { GenericArgsExpression } from "./generic-args";

export { Function };

namespace Function {
  export namespace Body {
    const schema = zod.tuple([
      zod.any() /* ( */,
      zod.array(
        zod.object({
          id: zod.instanceof(IdentifierExpression),
          type: zod.instanceof(ExpressionBase),
          rest: zod.boolean(),
          optional: zod.boolean(),
        })
      ),
      zod.any() /* ) */,
    ]);

    type Schema = zod.infer<typeof schema>;

    export class Expression extends ExpressionBase {
      public kind = AST.SyntaxKind.E.FunctionBody;
      public args: Schema[1];

      constructor(pos: AST.Position, args: Schema) {
        super(pos);
        this.checkArgs(args, schema);
        this.args = args[1];
      }

      public compile(): string {
        const bodyContent = this.args
          .map((arg) =>
            [
              arg.rest ? "..." : "",
              arg.id.compile(),
              arg.optional ? "?" : "",
              ": ",
              arg.type.compile(),
            ].join("")
          )
          .join(", ");

        return `(${bodyContent})`;
      }

      public toString(): string {
        return this.kind;
      }
    }
  }

  export namespace Return {
    const schema = (() => {
      const assertSource = zod
        .instanceof(IdentifierExpression) /* 纯 id */
        .or(zod.any()); /* this 关键字 - moo.Token 类型 */
      const target = zod.instanceof(ExpressionBase);

      const main = zod
        .tuple([
          zod.any() /* object -> 含有 `asserts` 修饰符 */,
          assertSource,
          target,
        ])
        .or(zod.tuple([assertSource, target]))
        .or(zod.tuple([target]));

      return {
        main,
        target,
        assertSource,
      };
    })();
    type Schema = zod.infer<typeof schema.main>;
    type SchemaTarget = zod.infer<typeof schema.target>;
    type SchemaAssertSource = zod.infer<typeof schema.assertSource>;

    export class Expression extends ExpressionBase {
      public kind = AST.SyntaxKind.E.FunctionReturn;

      public assertSource: IdentifierExpression | moo.Token;
      public target: SchemaTarget;
      public type: "aserrt-is" | "is" | "normal";

      constructor(pos: AST.Position, args: Schema) {
        super(pos);
        this.checkArgs(args, schema.main);
        this.initArgs(args);
      }

      private initArgs(args: Schema) {
        switch (args.length) {
          case 1:
            this.target = args[0];
            this.type = "normal";
            break;

          case 2:
            this.assertSource = args[0];
            this.target = args[1];
            this.type = "is";
            break;

          case 3:
            this.assertSource = args[1];
            this.target = args[2];
            this.type = "aserrt-is";
            break;
        }
      }

      public compile(): string {
        switch (this.type) {
          case "is":
          case "aserrt-is": {
            const assertSource =
              this.assertSource instanceof IdentifierExpression
                ? this.assertSource.compile()
                : "this";

            const content = `${assertSource} is ${this.target.compile()}`;
            return this.type === "is" ? content : `asserts ${content}`;
          }

          case "normal":
            return this.target.compile();
        }
      }

      public toString(): string {
        return this.kind;
      }
    }
  }

  export namespace Mode {
    const schema = zod
      .tuple([
        zod.instanceof(GenericArgsExpression),
        zod.instanceof(Body.Expression),
        zod.instanceof(Return.Expression),
      ])
      .or(
        zod.tuple([
          zod.instanceof(Body.Expression),
          zod.instanceof(Return.Expression),
        ])
      );

    type Schema = zod.infer<typeof schema>;
    export abstract class CommonExpression extends ExpressionBase {
      public genericArgs: GenericArgsExpression | null;
      public body: Body.Expression;
      public return: Return.Expression;

      protected abstract readonly type: "arrow" | "regular";

      constructor(pos: AST.Position, args: Schema) {
        super(pos);
        this.checkArgs(args, schema);
        this.initArgs(args);
      }

      private initArgs(args: Schema) {
        if (args.length === 3) {
          [this.genericArgs, this.body, this.return] = args;
        } else {
          this.genericArgs = null;
          [this.body, this.return] = args;
        }
      }
      public compile(): string {
        const separator = this.type === "arrow" ? "=>" : ":";
        const mainContent = `${this.body.compile()} ${separator} ${this.return.compile()}`;

        if (this.genericArgs) {
          return `${this.genericArgs.compile()}${mainContent}`;
        }

        return mainContent;
      }

      public toString(): string {
        return this.kind;
      }
    }

    export class RegularExpression extends CommonExpression {
      public kind: AST.SyntaxKind.E = AST.SyntaxKind.E.RegularFunction;
      protected readonly type: "arrow" | "regular" = "regular";
    }

    export class ArrowExpression extends CommonExpression {
      public kind: AST.SyntaxKind.E = AST.SyntaxKind.E.ArrowFunction;
      protected readonly type: "arrow" | "regular" = "arrow";
    }

    export class ConstructorExpression extends ExpressionBase {
      public kind: AST.SyntaxKind.E = AST.SyntaxKind.E.Constructor;

      public body: RegularExpression | ArrowExpression;

      private static schema = zod.tuple([
        zod.any() /* new */,
        zod.instanceof(RegularExpression).or(zod.instanceof(ArrowExpression)),
      ]);

      constructor(
        pos: AST.Position,
        args: zod.infer<typeof ConstructorExpression.schema>
      ) {
        super(pos);
        this.checkArgs(args, ConstructorExpression.schema);
        this.body = args[1];
      }

      public compile(): string {
        return `new ${this.body.compile()}`;
      }

      public toString(): string {
        return this.kind;
      }
    }
  }
}
