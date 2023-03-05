import zod from 'zod';

import type { ASTNodePosition } from '../..';
import { ASTBase } from '../../base';
import { SyntaxKind } from '../../constants';
import type { ExpressionBase } from '../../expressions/base';
import { NormalStatementBase } from './base';

export { ReturnStatement };

const schema = zod.tuple([
  zod.any() /* return */,
  zod.instanceof(ASTBase)
  // TODO： 为 undefined 时，自动返回其他值？
  // .or(zod.undefined()),
]);

type Schema = zod.infer<typeof schema>;
class ReturnStatement extends NormalStatementBase {
  public kind = SyntaxKind.S.Return;

  public body: ExpressionBase;

  constructor(pos: ASTNodePosition, args: Schema) {
    super(pos);
    this.checkArgs(args, schema);
    [, this.body] = args;
  }

  public compile() {
    return this.body.compile();
  }

  public toString(): string {
    return this.kind;
  }
}
