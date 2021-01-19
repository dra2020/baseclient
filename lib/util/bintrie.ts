//
// Packed format Trie for mapping string to string
//  Assumptions:
//      1. Lots of duplicate prefix strings in keys (so branching in trie happens late).
//      2. Lots of duplicate prefix strings in values.
//      3. Lots of keys with duplicate prefix map to the same string value.
//  Especially good for something like our blockmapping.json file since both the keys (blockIDs)
//  and values (precinct IDs) have a ton of redundancy and ~250 avg keys (blockID) map to same
//  precinctID.
//  The packed structure is just read directly into memory and walked in packed format.

// The structure is divided into two pieces, a node "tree" (flat n-ary trie with offsets
// to next nodes) and a value table. A value is a pair of string fragment offsets.
//
// Main header is:
//    value table offset (32 bit value)
//    [ node table ]
//    [ value table ]

// A tree node is:
//    node length / value - (length of byte and node offset table)
//    [ bytes ]* (padded to 4)
//    [ node or value offset ]*  (32 bit signed values, negative values are value table refs)
//
//    We just do a linear scan through the bytes since we assume many will only have a single child,
//    max ~15.
//    The byte array contains the next byte to match, the node offset is the respective next node.
//    A negative node offset is the actual value.
//
// A value is an entry in the value table. It is:
//    fragment offset 1 (from start of value table) (offset zero means null, not a legal offset)
//    fragment offset 2 (from start of value table)
//
//    where a fragment is:
//      length (byte)
//      [ bytes ]*
//
//    value table is:
//      number of pairs (32 bit value)
//      [ fragment offset pairs ]*
//      [ fragment values ]*

export interface Coder
{
  encoder: { encode: (s: string) => Uint8Array };
  decoder: { decode: (u8: Uint8Array) => string };
}

/*
-- For Node
import * as u from 'util';
Util.setCoder({ encoder: new u.TextEncoder(), decoder: new u.TextDecoder('utf-8') });

-- For Browser
Util.setCoder({ encoder: new TextEncoder(), decoder: new TextDecoder('utf-8') });
*/

export function s2u8(coder: Coder, s: string): Uint8Array
{
  return coder.encoder.encode(s);
}

export function u82s(coder: Coder, u8: Uint8Array, offset: number, n: number): string
{
  return coder.decoder.decode(u8.subarray(offset, offset+n));
}

// String table algorithm:
//  For each string, divide into fragments of n to 3 bytes
//  Allocate an occurence for each fragment.
//  Sort the fragments by number of occurrences.
//  For each string, pick fragmentation that maximizes occurrence count and mark
//    fragmentation as "in use"

interface Fragment
{
  count: number;
  used: number;
  offset: number;
  s: string;
  u8?: Uint8Array;
}

type FragmentTable = { [frag: string]: Fragment };
type FragmentPair = { f1: Fragment, f2: Fragment, offset?: number };
const NullFragment = { count: 0, used: 0, offset: 0, s: '' };

function sortBestPair(p1: FragmentPair, p2: FragmentPair): number
{
  let d = (p1.f1.count+p1.f2.count) - (p2.f1.count+p2.f2.count);
  if (d) return d;
  d = (p1.f1.used + p1.f2.used) - (p2.f1.used+p2.f2.used);
  return d;
}

function unique(a: string[]): string[]
{
  a = a.slice().sort();
  return a.filter((s: string, i: number) => { return i == 0 || s !== a[i-1] });
}

class ValueTable
{
  coder: Coder;
  ab: ArrayBuffer;
  u8: Uint8Array;
  u32: Uint32Array;

  constructor(coder: Coder) { this.coder = coder }

  static fromBuffer(coder: Coder, ab: ArrayBuffer, offset: number, length: number): ValueTable
  {
    let vt = new ValueTable(coder);
    vt.ab = ab;
    vt.u8 = new Uint8Array(ab, offset, length);
    let u32 = new Uint32Array(ab, offset, 1);
    let n = u32[0];
    vt.u32 = new Uint32Array(ab, offset, 1+2*n);
    return vt;
  }

  // Returns string given offset into value table
  fromOffset(offset: number): string
  {
    let o1 = this.u32[offset];
    let o2 = this.u32[offset+1];
    let n = 0;
    if (o1) n += this.u8[o1];
    if (o2) n += this.u8[o2];
    let ab = new ArrayBuffer(n);
    let u8 = new Uint8Array(ab);
    n = this.u8[o1];
    let j = 0;
    while (j < n) u8[j++] = this.u8[++o1];
    n = this.u8[o2];
    let k = 0;
    while (k < n) k++, u8[j++] = this.u8[++o2];
    return u82s(this.coder, u8, 0, j);
  }
}

class ValueTableBuilder
{
  coder: Coder;
  values: string[];
  fragments: FragmentTable;
  pairs: { [value: string]: FragmentPair  };
  ab: ArrayBuffer;
  u8: Uint8Array;
  u32: Uint32Array;

  constructor(coder: Coder) { this.coder = coder }

  // Building
  static fromStrings(coder: Coder, values: string[]): ValueTableBuilder
  {
    let nc = 0;
    values.forEach(s => nc += s.length);
    //console.log(`bintrie: ValueTable: ${values.length} initial values, ${nc} initial char count`);
    values = unique(values);
    //console.log(`bintrie: ValueTable: ${values.length} unique values`);
    let vtb = new ValueTableBuilder(coder);
    vtb.values = values;
    vtb.fragments = {};
    vtb.pairs = {};
    values.forEach(s => vtb.extractFragments(s));
    values.forEach(s => vtb.pickFragments(s));
    //console.log(`bintrie: ValueTable: ${Object.keys(vtb.fragments).length} initial fragments`);
    Object.keys(vtb.fragments).forEach(s => { if (! vtb.fragments[s].used) delete vtb.fragments[s] });
    //console.log(`bintrie: ValueTable: ${Object.keys(vtb.fragments).length} final fragments`);
    vtb.toBinary();
    vtb.validateStrings(values);
    //console.log(`bintrie: ValueTable: ${vtb.u8.length} final byte length`);
    return vtb;
  }

  // Validation
  validateStrings(values: string[]): void
  {
    let vt = ValueTable.fromBuffer(this.coder, this.ab, 0, this.ab.byteLength);
    let orig = values.slice().sort();
    let here: string[] = [];
    let n = this.u32[0];
    for (let i = 0; i < n; i++)
      here.push(vt.fromOffset(i*2+1));
    here.sort();
    for (let i = 0; i < here.length; i++)
      if (orig[i] !== here[i])
      {
        console.error('ValueTable: content mismatch');
        break;
      }
  }

  // Building
  addFragment(s: string): void
  {
    let f = this.fragments[s];
    if (f === undefined)
      f = { count: 0, used: 0, s: s, offset: 0, u8: s2u8(this.coder, s) }, this.fragments[s] = f;
    f.count++;
  }

  // Building
  extractFragments(s: string): void
  {
    let n = s.length;
    if (n < 6)
      this.addFragment(s);
    else
      for (let j = 3; j < n-2; j++)
      {
        this.addFragment(s.substring(0, j));
        this.addFragment(s.substring(j));
      }
  }

  // Building
  pickFragments(s: string): void
  {
    let a: { f1: Fragment, f2: Fragment }[] = [];
    let n = s.length;
    if (n < 6)
      a.push({ f1: this.fragments[s], f2: NullFragment });
    else
      for (let j = 3; j < n-2; j++)
        a.push({ f1: this.fragments[s.substring(0, j)], f2: this.fragments[s.substring(j)] });
    a.sort(sortBestPair);
    let p = a[0];
    p.f1.used = 1;
    p.f2.used = 1;
    this.pairs[s] = p;
  }

  // Building
  toOffset(s: string): number
  {
    return this.pairs[s].offset;
  }

  // Building
  toBinary(): void
  {
    let byteLength = 0;
    byteLength += (this.values.length * 2 * 4) + 4;
    let keys = Object.keys(this.fragments);
    keys.forEach(s => {
        let f = this.fragments[s];
        f.offset = byteLength;
        byteLength += f.u8.byteLength + 1;
      });
    this.ab = new ArrayBuffer(byteLength);
    this.u8 = new Uint8Array(this.ab);
    this.u32 = new Uint32Array(this.ab, 0, this.values.length*2+1);
    let pOffset = 0;
    this.u32[pOffset++] = this.values.length;
    this.values.forEach(s => {
        let p = this.pairs[s];
        p.offset = pOffset;
        this.u32[pOffset++] = p.f1.offset;
        this.u32[pOffset++] = p.f2.offset;
      });
    let fOffset = (this.values.length * 2 * 4) + 4;
    keys.forEach(s => {
        let f = this.fragments[s];
        this.u8[fOffset++] = f.u8.length;
        for (let i = 0; i < f.u8.length; i++)
          this.u8[fOffset++] = f.u8[i];
      });
  }
}

export type StringMap = { [key: string]: string };

// Building
interface UnpackedNode
{
  // This for leaf node
  suffix: Uint8Array;
  value: number;

  // This for internal node
  bytes: number[] | null;
  nodes: UnpackedNode[] | null;
}

function pad(n: number, pad: number): number { let mod = n % pad; return mod ? pad - mod : 0; }
function pad4(n: number): number { return pad(n, 4) }

export class BinTrie
{
  coder: Coder;
  ab: ArrayBuffer;
  vt: ValueTable;
  u8: Uint8Array;
  i32: Int32Array;

  constructor(coder: Coder)
  {
    this.coder = coder;
  }

  static fromBuffer(coder: Coder, ab: ArrayBuffer): BinTrie
  {
    let bt = new BinTrie(coder);
    bt.ab = ab;
    bt.u8 = new Uint8Array(bt.ab);
    let i32 = new Int32Array(bt.ab, 0, 1);
    let valueOffset = i32[0];
    bt.i32 = new Int32Array(bt.ab, 0, valueOffset >> 2);
    bt.vt = ValueTable.fromBuffer(coder, bt.ab, valueOffset, bt.u8.length - valueOffset);
    return bt;
  }

  get(key: string): string
  {
    let u8 = s2u8(this.coder, key);
    let byteOffset = 4;
    for (let i = 0; i <= u8.length; i++)
    {
      let iOffset = byteOffset >> 2;
      let n = this.i32[iOffset];
      if (i == u8.length)
        return undefined;
      let b = u8[i];
      byteOffset += 4;
      let j: number;
      for (j = 0; j < n; j++)
        if (this.u8[byteOffset+j] === b)
        {
          byteOffset += n + pad4(n);      // move past byte table
          iOffset = byteOffset >> 2;      // convert ioffset to that location
          iOffset += j;                   // index intoo node offset table
          byteOffset = this.i32[iOffset]; // and move to child node
          if (byteOffset < 0)
            return this.vt.fromOffset(-byteOffset);
          break;
        }
      if (j === n)
        return undefined;
    }
    return undefined;
  }
}

export class BinTrieBuilder
{
  coder: Coder;
  root: UnpackedNode;
  vtb: ValueTableBuilder;
  vt: ValueTable;
  ab: ArrayBuffer;
  u8: Uint8Array;
  i32: Int32Array;

  constructor(coder: Coder)
  {
    this.coder = coder;
  }

  // Building
  nodeCount(node: UnpackedNode): number
  {
    let n = 1;
    if (node.nodes)
      node.nodes.forEach(child => n += this.nodeCount(child))
    return n;
  }

  // Validation
  nodeBranching(node: UnpackedNode, counts: number[]): number
  {
    let n = node.nodes ? node.nodes.length : 0;
    counts[n] = counts[n] === undefined ? 1 : counts[n]+1;
    if (node.nodes)
      node.nodes.forEach(child => n += this.nodeBranching(child, counts))
    return n;
  }

  // Validation
  nodeValueCount(node: UnpackedNode): number
  {
    let n = node.value ? 1 : 0;
    if (node.nodes)
      node.nodes.forEach(child => n += this.nodeValueCount(child))
    return n;
  }

  // Building
  nodeByteLength(node: UnpackedNode): number
  {
    let byteLength = 0; // length of child arrays
    if (node.nodes)
    {
      byteLength += 4;  // length of child arrays
      byteLength += node.bytes.length + pad4(node.bytes.length);
      byteLength += node.nodes.length * 4;
      node.nodes.forEach(n => { byteLength += this.nodeByteLength(n) });
    }
    return byteLength;
  }

  // Building
  addString(s: string, value: number): void
  {
    let u8 = s2u8(this.coder, s);
    if (this.root == null)
      this.root = { suffix: u8, value: value, bytes: null, nodes: null };
    else
    {
      let node = this.root;
      let n = u8.length;
      let j = 0;
      while (j < n)
      {
        // If at leaf node, need to split it
        if (node.bytes == null)
        {
          node.bytes = [ node.suffix[0] ];
          node.nodes = [ { suffix: node.suffix.subarray(1), value: node.value, bytes: null, nodes: null } ];
          node.suffix = null;
          node.value = 0;
        }

        let k: number;
        for (k = 0; k < node.bytes.length; k++)
          if (node.bytes[k] == u8[j])
            break;
        
        if (k < node.bytes.length)
        {
          node = node.nodes[k];
          j++;
        }
        else
        {
          node.bytes.push(u8[j++]);
          let nNew: UnpackedNode = { suffix: u8.subarray(j), value: value, bytes: null, nodes: null };
          node.nodes.push(nNew);
          node = nNew;
        }
      }
    }
  }

  // Building
  dedup(node: UnpackedNode): void
  {
    // If all subnodes point to the same value, we can just turn this node into a value node
    if (node.nodes)
    {
      node.nodes.forEach(n => this.dedup(n));
      let value = node.nodes[0].value;
      if (value)
      {
        node.nodes.forEach(n => { if (n.value != value) value = 0 });
        if (value)
        {
          node.value = value;
          delete node.nodes;
          delete node.bytes;
        }
      }
    }
  }

  // Validation
  getUnpacked(key: string): string
  {
    function getFromNode(vt: ValueTable, node: UnpackedNode, u8: Uint8Array, offset: number): string
    {
      if (node.value)
        return vt.fromOffset(node.value);
      else
      {
        if (offset >= u8.length)
        {
          console.error('bintrie: failure during lookup in unpacked format');
          return 'undefined';
        }
        let j = node.bytes.findIndex(e => e === u8[offset]);
        if (j === undefined)
        {
          console.error('bintrie: failure during lookup in unpacked format');
          return 'undefined';
        }
        return getFromNode(vt, node.nodes[j], u8, offset+1);
      }
    }

    return getFromNode(this.vt, this.root, s2u8(this.coder, key), 0);
  }

  // Building
  packNode(node: UnpackedNode, byteOffset: number): number
  {
    if (node.nodes)
    {
      let i;
      let iOffset = byteOffset >> 2;
      this.i32[iOffset] = node.nodes.length;
      byteOffset += 4;
      for (i = 0; i < node.bytes.length; i++)
        this.u8[byteOffset++] = node.bytes[i];
      byteOffset += pad4(byteOffset);
      iOffset = byteOffset >> 2;
      byteOffset += node.nodes.length * 4;
      for (i = 0; i < node.nodes.length; i++)
      {
        let n = node.nodes[i];
        if (n.value)
          this.i32[iOffset++] = - n.value;
        else
        {
          this.i32[iOffset++] = byteOffset;
          byteOffset = this.packNode(n, byteOffset);
        }
      }
    }
    return byteOffset;
  }

  // Building
  toBinary(): void
  {
    let byteLength = 4 + this.nodeByteLength(this.root);
    let valueOffset = byteLength;
    byteLength += this.vtb.u8.length;
    this.ab = new ArrayBuffer(byteLength);
    this.u8 = new Uint8Array(this.ab);
    this.i32 = new Int32Array(this.ab, 0, valueOffset >> 2);
    this.i32[0] = valueOffset;
    let byteOffset = this.packNode(this.root, 4);
    if (byteOffset != valueOffset)
      throw 'unexpected result from packNode';

    // Now copy in ValueTable
    let u8 = this.vtb.u8;
    let n = u8.length;
    for (let j = 0, k = valueOffset; j < n; j++, k++)
      this.u8[k] = u8[j];
  }

  // Building
  static fromMap(coder: Coder, o: StringMap): BinTrie
  {
    let btb = new BinTrieBuilder(coder);
    btb.vtb = ValueTableBuilder.fromStrings(coder, Object.values(o));
    btb.vt = ValueTable.fromBuffer(coder, btb.vtb.ab, 0, btb.vtb.ab.byteLength);
    let keys = Object.keys(o);
    keys.forEach(s => btb.addString(s, btb.vtb.toOffset(o[s])));

    //console.log(`bintrie: initial node count: ${btb.nodeCount(btb.root)}`);

    // validate
    let good = true;
    keys.forEach(k => {
        if (good && btb.getUnpacked(k) !== o[k])
        {
          //console.error('bintrie: missing key in unpacked, un-deduped tree');
          good = false;
        }
      });

    // dedup (collapse branches pointing to same value)
    btb.dedup(btb.root);

    // validate
    keys.forEach(k => {
        if (good && btb.getUnpacked(k) !== o[k])
        {
          //console.error('bintrie: missing key in unpacked, deduped tree');
          good = false;
        }
      });

    //console.log(`bintrie: final node count after dedup: ${btb.nodeCount(btb.root)}`);
    //console.log(`bintrie: value nodes after dedup: ${btb.nodeValueCount(btb.root)}`);
    let counts: number[] = [];
    //console.log(`bintrie: singleton nodes after dedup: ${btb.nodeBranching(btb.root, counts)}`);
    counts.forEach((count: number, i: number) => {
        //if (count !== undefined)
          //console.log(`bintrie: branch factor: ${i}, count: ${count}`);
      });

    btb.toBinary();

    let bt = BinTrie.fromBuffer(coder, btb.ab);

    // validate
    keys.forEach((k: string, i: number) => {
        if (good && bt.get(k) !== o[k])
        {
          console.error(`bintrie: missing key (${i}th) in packed structure`);
          good = false;
        }
      });

    console.log(`bintrie: total size: ${btb.u8.length}, value table size: ${btb.vtb.u8.length}`);

    return bt;
  }
}
