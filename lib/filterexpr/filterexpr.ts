import * as Util from '../util/all';

const Space = 32;
const Tab = 9;
const Newline = 10;
const CR = 13;
const OpenParen = 40;
const CloseParen = 41;
const Colon = 58;
const SingleQuote = 39;
const DoubleQuote = 34;
const BackSlash = 92;
const Exclamation = 33;
const LessThan = 60;
const Equal = 61;
const GreaterThan = 62;
const LowerA = 97;
const UpperA = 65;
const LowerN = 110;
const UpperN = 78;
const LowerD = 100;
const UpperD = 68;
const LowerO = 111;
const UpperO = 79;
const LowerT = 97;
const UpperT = 65;
const LowerR = 114;
const UpperR = 82;

function isWhite(c: number): boolean
{
  return c === Space || c === Newline || c === Tab || c == CR;
}

function toString(a: any): string
{
  if (typeof a === 'object' && a && typeof a.value === 'string')
    return a.value;
  return String(a);
}

enum TokType
{
  Text,
  OpenParen,
  CloseParen,
  Not,
  And,
  Or,
  Colon,
  GreaterThan,
  GreaterThanEqual,
  Equal,
  LessThan,
  LessThanEqual,
  NotEqual,
}

function tokToText(tt: TokType): string
{
  switch (tt)
  {
    case TokType.Text: return 'text';
    case TokType.OpenParen: return '(';
    case TokType.CloseParen: return ')';
    case TokType.Not: return 'not';
    case TokType.And: return 'and';
    case TokType.Or: return 'or';
    case TokType.Colon: return ':';
    case TokType.GreaterThan: return '>';
    case TokType.GreaterThanEqual: return '>=';
    case TokType.Equal: return '=';
    case TokType.LessThan: return '<';
    case TokType.LessThanEqual: return '<=';
    case TokType.NotEqual: return '!=';
  }
}

function tokIsUnary(tt: TokType): boolean
{
  switch (tt)
  {
    case TokType.Text: return false;
    case TokType.OpenParen: return false;
    case TokType.CloseParen: return false;
    case TokType.Not: return true;
    case TokType.And: return false;
    case TokType.Or: return false;
    case TokType.Colon: return false;
    // Nominally binary, but written as "prop: < 3" so appears as unary operator where test is comparative to prop value
    case TokType.GreaterThan: return true;
    case TokType.GreaterThanEqual: return true;
    case TokType.Equal: return true;
    case TokType.LessThan: return true;
    case TokType.LessThanEqual: return true;
    case TokType.NotEqual: return true;
  }
}

function tokIsBinary(tt: TokType): boolean
{
  switch (tt)
  {
    case TokType.Text: return false;
    case TokType.OpenParen: return false;
    case TokType.CloseParen: return false;
    case TokType.Not: return false;
    case TokType.And: return true;
    case TokType.Or: return true;
    case TokType.Colon: return true;
    // Nominally binary, but written as "prop: < 3" so appears as unary operator where test is comparative to prop value
    case TokType.GreaterThan: return false;
    case TokType.GreaterThanEqual: return false;
    case TokType.Equal: return false;
    case TokType.LessThan: return false;
    case TokType.LessThanEqual: return false;
    case TokType.NotEqual: return false;
  }
}

interface Token
{
  tt: TokType;
  text?: string;
}

interface Clause
{
  op: Token;
  operand1?: Clause;
  operand2?: Clause;
}

enum ParseState
{
  Start,
  InString,
  Ended
}

class Lexer
{
  coder: Util.Coder;
  tokens: Token[];
  buf: Uint8Array;
  tok: Uint8Array;
  toklen: number;
  n: number;

  constructor(coder: Util.Coder, expr?: string)
  {
    this.coder = coder;
    if (expr)
      this.set(expr);
  }

  set(expr: string): void
  {
    this.tokens = [];
    this.buf = Util.s2u8(this.coder, expr);
    this.tok = new Uint8Array(new ArrayBuffer(this.buf.length));
    this.toklen = 0;
    this.n = 0;
    this.lex();
  }

  pushString(s: string): void
  {
    this.tokens.push({ tt: TokType.Text, text: s });
  }

  pushText(bForce: boolean = false): void
  {
    if (this.toklen > 0)
    {
      let text = Util.u82s(this.coder, this.tok, 0, this.toklen).toLowerCase();
      this.toklen = 0;
      if (!bForce && text === 'or')
        this.tokens.push({ tt: TokType.Or });
      else if (!bForce && text === 'and')
        this.tokens.push({ tt: TokType.And });
      else if (!bForce && text === 'not')
        this.tokens.push({ tt: TokType.Not });
      else
        this.pushString(text);
    }
  }

  pushSpecial(tt: TokType): void
  {
    this.pushText();
    this.tokens.push({ tt: tt });
  }

  lex(): void
  {
    while (this.n < this.buf.length)
    {
      let c: number = this.buf[this.n++];
      if (c == Colon)
        this.pushSpecial(TokType.Colon);
      else if (c == OpenParen)
        this.pushSpecial(TokType.OpenParen);
      else if (c == CloseParen)
        this.pushSpecial(TokType.CloseParen);
      else if (c == SingleQuote || c == DoubleQuote)
      {
        this.pushText();
        while (this.n < this.buf.length)
        {
          let cc = this.buf[this.n++];
          if (cc === c)
            break;
          else
            this.tok[this.toklen++] = cc;
        }
        this.pushText(true);
      }
      else if (isWhite(c))
        this.pushText();
      else if (c === GreaterThan)
      {
        if (this.n < this.buf.length && this.buf[this.n] === Equal)
        {
          this.n++;
          this.pushSpecial(TokType.GreaterThanEqual)
        }
        else
          this.pushSpecial(TokType.GreaterThan)
      }
      else if (c === LessThan)
      {
        if (this.n < this.buf.length && this.buf[this.n] === Equal)
        {
          this.n++;
          this.pushSpecial(TokType.LessThanEqual)
        }
        else
          this.pushSpecial(TokType.LessThan)
      }
      else if (c === Equal)
        this.pushSpecial(TokType.Equal)
      else if (c === Exclamation)
      {
        if (this.n < this.buf.length && this.buf[this.n] === Equal)
        {
          this.n++;
          this.pushSpecial(TokType.NotEqual)
        }
        else
          this.tok[this.toklen++] = c;
      }
      else
        this.tok[this.toklen++] = c;
    }
    this.pushText();
  }

}

class Parser
{
  clauses: Clause[];

  constructor() { }

  get clause(): Clause { return this.clauses && this.clauses.length == 1 ? this.clauses[0] : undefined }

  initFromTokens(tokens: Token[])
  {
    this.clausesFromTokens(tokens);
  }

  initFromClauses(clauses: Clause[])
  {
    this.clauses = clauses;
    this.combineParenthetical();
    this.convertOpToText();
    this.combineUnary();
    this.convertOpToText();
    this.combineBinary(TokType.Colon);
    this.convertOpToText();
    this.combineBinary(TokType.And);
    this.convertOpToText();
    this.combineBinary(TokType.Or);
    this.convertOpToText();
    this.combineImplicitAnd();
  }

  convertOpToText(): void
  {
    // walk through and convert naked ops to simple text matches (so "state: or" matches oregon rather than being invalid)
    this.clauses.forEach((c, i) => {
        let bad = false;
        switch (c.op.tt)
        {
          case TokType.And:
          case TokType.Or:
          case TokType.Colon:
            if (c.operand1 == null)
            {
              if (i == 0 || i == this.clauses.length-1)
                bad = true;
              else
              {
                let cBefore = this.clauses[i-1];
                if (cBefore.operand1 == null && tokIsBinary(cBefore.op.tt))
                  bad = true;
              }
            }
            break;
          case TokType.Not:
          case TokType.GreaterThan:
          case TokType.LessThan:
          case TokType.GreaterThanEqual:
          case TokType.LessThanEqual:
          case TokType.Equal:
          case TokType.NotEqual:
            if (c.operand1 == null && i == this.clauses.length-1)
              bad = true;
            break;
        }
        if (bad)
          c.op = { tt: TokType.Text, text: tokToText(c.op.tt) };
      });
  }

  combineParenthetical(): void
  {
    for (let i: number = 0; i < this.clauses.length; i++)
    {
      let c = this.clauses[i];
      if (c.op.tt === TokType.OpenParen)
      {
        let depth = 1;
        let j = i+1;
        for (; j < this.clauses.length; j++)
        {
          let c1 = this.clauses[j];
          if (c1.op.tt === TokType.OpenParen)
            depth++;
          else if (c1.op.tt === TokType.CloseParen)
            depth--;
          if (depth == 0)
            break;
        }
        // Pull out stuff inside parens
        let clauses = this.clauses.splice(i+1, j-(i+1));
        // Parse it
        let parser = new Parser();
        parser.initFromClauses(clauses);
        // Insert it back, deleting parens along the way
        if (parser.clause)
          this.clauses.splice(i, 2, parser.clause);
        else
          this.clauses.splice(i, 2);
      }
      else if (c.op.tt === TokType.CloseParen)  // malformed - extra paren
      {
        this.clauses.splice(i, 1);
        i--;
      }
    }
  }

  combineUnary(): void
  {
    // go backwards to handle not not
    for (let i: number = this.clauses.length-1; i >= 0; i--)
    {
      let c = this.clauses[i];
      if (tokIsUnary(c.op.tt))
      {
        let notclause = (i < this.clauses.length-1) ? { op: c.op, operand1: this.clauses[i+1] } : undefined;
        if (notclause)
          this.clauses.splice(i, 2, notclause);
        else
          this.clauses.splice(i, 1);
      }
    }
  }

  combineColon(): void
  {
    for (let i: number = 0; i < this.clauses.length; i++)
    {
      let c = this.clauses[i];

      if (c.op.tt === TokType.Colon && c.operand1 == null)
      {
        if (i === 0) // malformed, but ignore
          this.clauses.splice(i, 1);
        else
        {
          c = { op: c.op, operand1: this.clauses[i-1], operand2: null };
          this.clauses.splice(i-1, 2, c);
          i--;
        }
      }
    }
  }

  combineBinary(tt: TokType): void
  {
    for (let i: number = 0; i < this.clauses.length; i++)
    {
      let c = this.clauses[i];

      if (c.op.tt === tt)
        if (c.operand1 == null)
        {
          if (i === 0 || i === this.clauses.length-1) // malformed, but ignore
            this.clauses.splice(i, 1);
          else
          {
            c = { op: c.op, operand1: this.clauses[i-1], operand2: this.clauses[i+1] };
            this.clauses.splice(i-1, 3, c);
            i--;
          }
        }
        else if (c.operand2 == null)  // just colon where name binds earlier in combineColon
        {
          if (i === this.clauses.length-1) // malformed, but ignore
            this.clauses.splice(i, 1);
          else
          {
            c.operand2 = this.clauses[i+1];
            this.clauses.splice(i+1, 1);
          }
        }
    }
  }

  combineImplicitAnd(): void
  {
    while (this.clauses.length > 1)
    {
      let c: Clause = { op: { tt: TokType.And }, operand1: this.clauses[0], operand2: this.clauses[1] };
      this.clauses.splice(0, 2, c);
    }
  }

  clausesFromTokens(tokens: Token[]): void
  {
    let clauses: Clause[] = [];
    // combine sequential text tokens into AND clauses, push rest as distinct clauses
    for (let i: number = 0; i < tokens.length; i++)
    {
      let t = tokens[i];
      if (t.tt === TokType.Text)
      {
        let c: Clause = { op: t };
        let j = i+1;
        for (; j < tokens.length; j++)
        {
          let jt = tokens[j];
          if (jt.tt === TokType.Text)
            c = { op: { tt: TokType.And }, operand1: c, operand2: { op: jt } };
          else
            break;
        }
        clauses.push(c);
        i = j-1;
      }
      else
        clauses.push({ op: t });
    }
    this.initFromClauses(clauses);
  }
}

function wordyDate(s: string): string
{
  let d = new Date(s);
  let now = new Date();
  let yyyyNow = now.getFullYear();
  let mmmNow = now.getMonth();
  let ddNow = now.getDate();

  let mmm = d.getMonth();
  let dd = d.getDate();
  let yyyy = d.getFullYear();

  s = Util.prettyDate(d);
  if (yyyyNow === yyyy && mmmNow === mmm && ddNow === dd)
    s = 'today ' + s;

  // If I get ambitious, could add "yesterday", "this week", "last week", "this month", "last month", "this year"
  // But this is close enough to match what gets displayed by "prettyDate" while also letting selection by month year

  return s;
}

function clauseEqual(c1: Clause, c2: Clause): boolean
{
  if (c1 == null && c2 == null) return true;
  if (c1 == null || c2 == null) return false;
  if (c1.op.tt === c2.op.tt)
  {
    if (c1.op.tt === TokType.Text)
      return c1.op.text === c2.op.text;
    else
      return clauseEqual(c1.operand1, c2.operand1) && clauseEqual(c1.operand2, c2.operand2);
  }
  else
    return false;
}

function containsClause(c: Clause, s: Clause): boolean
{
  if (clauseEqual(c, s))
    return true;
  if (c == null || s == null) return false;
  return containsClause(c.operand1, s) || containsClause(c.operand2, s);
}

function removeClause(c: Clause, s: Clause): Clause
{
  if (c == null || (c.op.tt === TokType.Text && c.op.tt !== s.op.tt))
    return c;
  else if (clauseEqual(c, s))
    return null;
  else
  {
    c.operand1 = removeClause(c.operand1, s);
    c.operand2 = removeClause(c.operand2, s);
    if ((c.op.tt === TokType.And || c.op.tt === TokType.Or) && (c.operand1 == null || c.operand2 == null))
      return c.operand1 || c.operand2;
    return c;
  }
}

export class FilterExpr
{
  lexer: Lexer;
  parser: Parser;

  constructor(coder: Util.Coder, expr?: string)
  {
    this.lexer = new Lexer(coder);
    this.parser = new Parser;
    if (expr) this.set(expr);
  }

  set(expr: string): void
  {
    this.lexer.set(expr);
    this.parser.initFromTokens(this.lexer.tokens);
  }

  test(o: any, types?: any): boolean
  {
    return this.testClause(o, types, this.parser.clause);
  }

  asString(): string
  {
    return this.asStringClause(this.parser.clause);
  }

  containsClause(expr: string): boolean
  {
    let sub = new FilterExpr(this.lexer.coder, expr);
    return containsClause(this.parser.clause, sub.parser.clause);
  }

  addClause(expr: string): void
  {
    let sub = new FilterExpr(this.lexer.coder, expr);
    if (! containsClause(this.parser.clause, sub.parser.clause))
    {
      if (this.parser.clause)
        this.parser.clauses = [ { op: { tt: TokType.And }, operand1: this.parser.clause, operand2: sub.parser.clause } ];
      else
        this.parser.clauses = [ sub.parser.clause ];
    }
  }

  removeClause(expr: string): void
  {
    if (this.containsClause(expr))
    {
      let sub = new FilterExpr(this.lexer.coder, expr);
      this.parser.clauses = [ removeClause(this.parser.clause, sub.parser.clause) ];
    }
  }

  asStringClause(clause: Clause): string
  {
    if (clause == null) return '';
    if (clause.op.tt == TokType.Text)
    {
      this.lexer.set(clause.op.text);
      if (this.lexer.tokens.length == 1 && this.lexer.tokens[0].tt === TokType.Text)
        return clause.op.text;
      else
        return `'${clause.op.text}'`;
    }
    let a: string[] = [];
    if (clause !== this.parser.clause)
      a.push('(');
    switch (clause.op.tt)
    {
      case TokType.And:
        a.push(this.asStringClause(clause.operand1));
        a.push('and');
        a.push(this.asStringClause(clause.operand2));
        break;
      case TokType.Or:
        a.push(this.asStringClause(clause.operand1));
        a.push('or');
        a.push(this.asStringClause(clause.operand2));
        break;
      case TokType.Not:
        a.push('not');
        a.push(this.asStringClause(clause.operand1));
        break;
      case TokType.Colon:
        a.push(`${this.asStringClause(clause.operand1)}:`);
        a.push(this.asStringClause(clause.operand2));
        break;
      case TokType.Equal:
      case TokType.LessThan:
      case TokType.GreaterThan:
      case TokType.LessThanEqual:
      case TokType.GreaterThanEqual:
      case TokType.NotEqual:
        a.push(tokToText(clause.op.tt));
        a.push(this.asStringClause(clause.operand1));
        break;
      default:
        throw 'Unexpected token in asString';
    }
    if (clause !== this.parser.clause)
      a.push(')');
    return a.join(' ');
  }

  testClause(o: any, types: any, clause: Clause, prop?: string, relation?: TokType): boolean
  {
    if (clause == null) return true;
    switch (clause.op.tt)
    {
      case TokType.Text:
        for (let p in o) if (o.hasOwnProperty(p) && (prop == null || p.toLowerCase() === prop))
        {
          let s = toString(o[p]);
          if (s)
          {
            let t = types ? types[p] : undefined;
            if (t === 'skip')
              continue;
            if (t && t === 'date')
              s = wordyDate(s);
            s = s.toLowerCase();
            if (relation === undefined)
            {
              if (s.indexOf(clause.op.text) >= 0)
                return true;
            }
            else
            {
              let op2: any = isNaN(Number(clause.op.text)) ? clause.op.text : Number(clause.op.text);
              let op1: any = typeof op2 === 'number' ? Number(s) : s;
              switch (relation)
              {
                case TokType.Equal:            return op1 === op2;
                case TokType.LessThan:         return op1 < op2;
                case TokType.LessThanEqual:    return op1 <= op2;
                case TokType.GreaterThanEqual: return op1 >= op2;
                case TokType.GreaterThan:      return op1 > op2;
                case TokType.NotEqual:         return op1 !== op2;
              }
            }
          }
        }
        return false;

      case TokType.Colon:
        if (clause.operand1 && clause.operand1.op.tt === TokType.Text)
          prop = clause.operand1.op.text;
        return this.testClause(o, types, clause.operand2, prop);
        
      case TokType.Not:
        return ! this.testClause(o, types, clause.operand1, prop);

      case TokType.Equal:
      case TokType.LessThan:
      case TokType.GreaterThan:
      case TokType.LessThanEqual:
      case TokType.GreaterThanEqual:
      case TokType.NotEqual:
        return this.testClause(o, types, clause.operand1, prop, clause.op.tt);

      case TokType.And:
        return this.testClause(o, types, clause.operand1, prop) && this.testClause(o, types, clause.operand2, prop);

      case TokType.Or:
        return this.testClause(o, types, clause.operand1, prop) || this.testClause(o, types, clause.operand2, prop);

      default:
        throw 'Unexpected token in clause';
    }
    // NOTREACHED
  }
}
