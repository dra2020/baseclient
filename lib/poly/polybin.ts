import * as Util from '../util/all';
import * as PP from './polypack';
import * as T from './topo';

// Packed Buffer format:
//
//  (strings are packed as UTF8 bytes, padded to 4 byte boundary)
//
//  { 4 byte size (byte offset to packed coordinate buffer) }
//  { 4 byte length: property name,
//    4 byte length: json string }*
//  { 4 byte length: 'features' }
//  { 4 byte length: length of 'features' array }
//    { 4 byte length: property name,
//      4 byte length: json string }*
//  { padding to 8 byte boundary }
//  { packed buffer coordinates in polypack format (indexed by geometry.packed above) }
//

const MagicInt = 17;
const MagicFloat = 17.17;

function pad(n: number, pad: number): number
{
  let mod = n % pad;
  return mod ? pad - mod : 0;
}

function sizeOfString(coder: Util.Coder, s: string): number
{
  let s8 = Util.s2u8(coder, s);
  return 4 + s8.length + pad(s8.length, 4);
}

function packString(coder: Util.Coder, buf8: Uint8Array, buf32: Int32Array, offset: number, s: string): number
{
  let s8 = Util.s2u8(coder, s);
  buf32[offset >> 2] = s8.length;
  offset += 4;
  let i: number;
  for (i = 0; i < s8.length; i++) buf8[offset++] = s8[i];
  offset += pad(offset, 4);
  return offset;
}

function unpackString(coder: Util.Coder, buf8: Uint8Array, buf32: Int32Array, offset: number): string
{
  let size = buf32[offset >> 2];
  let s = Util.u82s(coder, buf8, offset+4, size);
  return s;
}

export function packCollection(coder: Util.Coder, col: any): ArrayBuffer
{
  // Compute size
  let pp = PP.featurePack(col) as PP.PolyPack;
  let f: any = col.features.find((f: any) => { return f.geometry.packed ? f.geometry.packed.buffer : null });
  let buffer: any = f ? f.geometry.packed.buffer : null;
  let size = 16; // int endiness, offset to coordinates, float endiness
  col.features.forEach((f: any) => { if (f.geometry.packed) delete f.geometry.packed.buffer; }); // reconstructed when unpacking
  let j = JSON.stringify(col);
  size += sizeOfString(coder, j);
  size += pad(size, 8);
  let fullsize = size + pp.length * 8;  // add space for coordinates

  // Now pack it
  let ab = new ArrayBuffer(fullsize);
  let buf8 = new Uint8Array(ab);
  let buf32 = new Int32Array(ab);
  let buf64 = new Float64Array(ab);
  let offset = 0;
  buf32[0] = MagicInt;
  offset += 4;
  buf32[1] = size;
  offset += 4;
  buf64[1] = MagicFloat;  // Note that buf64[0] has the two ints stored above
  offset += 8;
  offset = packString(coder, buf8, buf32, offset, j);
  offset += pad(offset, 8);
  if (offset != size)
    throw 'Oops, packing error.';
  let foff = offset >> 3;
  let buf = pp.buffer as Float64Array;
  for (let i: number = 0; i < pp.length; i++)
    buf64[foff++] = buf[i];

  // Now restore
  col.features.forEach((f: any) => { if (f.geometry.packed) f.geometry.packed.buffer = buffer; });
  PP.featureUnpack(col);

  return ab;
}

function reverse(buf8: Uint8Array, s: number, n: number): void
{
  let e = s + n - 1;
  while (s < e)
  {
    let t = buf8[s];
    buf8[s] = buf8[e];
    buf8[e] = t;
    s++, e--;
  }
}

function enforceEndianness(ab: ArrayBuffer): void
{
  let buf8 = new Uint8Array(ab);
  let buf32 = new Int32Array(ab);
  let buf64 = new Float64Array(ab);
  let reverseInts = false;
  if (buf32[0] != MagicInt)
  {
    reverseInts = true;
    reverse(buf8, 0, 4);
    if (buf32[0] != MagicInt) throw 'unpackCollection: badly formatted buffer';
    reverse(buf8, 4, 4);  // size of non-floats
  }
  let reverseFloats = false;
  if (buf64[1] != MagicFloat)
  {
    reverseFloats = true;
    reverse(buf8, 8, 8);
    if (buf64[1] != MagicFloat) throw 'unpackCollection: badly formatted buffer';
  }
  if (reverseInts)
    reverse(buf8, 16, 4); // JSON string length
  if (reverseFloats)
  {
    let s = buf32[1];  // Offset to floats
    let e = ab.byteLength;
    for (; s < e; s += 8)
      reverse(buf8, s, 8);
  }
}

export function unpackCollection(coder: Util.Coder, ab: ArrayBuffer): any
{
  enforceEndianness(ab);
  let col: any = {};
  let buf8 = new Uint8Array(ab);
  let buf32 = new Int32Array(ab);
  let size = buf32[1];
  let buf64 = new Float64Array(ab, size); // offset to start of packed coordinates
  let offset = 16;
  let j = unpackString(coder, buf8, buf32, offset);
  col = JSON.parse(j);
  col.features.forEach((f: any) => { if (f.geometry.packed) f.geometry.packed.buffer = buf64 });
  return col;
}

// Format of packed buffer:
//  [Size of JSON string] [4 bytes]
//  [Size of packedarcs]  [4 bytes]
//  [Size of packedarcindices]  [4 bytes]
//  [padding] [4 bytes]
//  [JSON string]
//    [pad to 8]
//  [packedarcs]
//  [packedarcindices]

const HeaderSize = 16;  // 4 Int32's 

export function topoToBuffer(coder: Util.Coder, topo: any): ArrayBuffer
{
  // Make sure we're packed
  T.topoPack(topo);
  let savepack = topo.packed;
  delete topo.packed;
  let json = JSON.stringify(topo);
  let byteLength = HeaderSize;  // 3 lengths + padding
  let stringLength = sizeOfString(coder, json);
  stringLength += pad(stringLength, 8);
  byteLength += stringLength;
  byteLength += savepack.arcs.byteLength;
  byteLength += savepack.arcindices.byteLength;
  let ab = new ArrayBuffer(byteLength);
  let buf8 = new Uint8Array(ab);
  let buf32 = new Int32Array(ab);
  let buf64 = new Float64Array(ab, HeaderSize + stringLength, savepack.arcs.length);

  buf32[0] = stringLength;
  buf32[1] = savepack.arcs.byteLength;
  buf32[2] = savepack.arcindices.byteLength;
  buf32[3] = 0;
  packString(coder, buf8, buf32, HeaderSize, json); json = null;
  let af = savepack.arcs as Float64Array;
  let n = af.length;
  let i = 0;
  let j = 0;
  while (i < n)
    buf64[j++] = af[i++];
  let ai = savepack.arcindices as Int32Array;
  n = ai.length;
  i = 0;
  j = (HeaderSize + stringLength + savepack.arcs.byteLength) / 4;
  while (i < n)
    buf32[j++] = ai[i++];

  // restore
  topo.packed = savepack;

  return ab;
}

export function topoFromBuffer(coder: Util.Coder, ab: ArrayBuffer): any
{
  let buf8 = new Uint8Array(ab);
  let buf32 = new Int32Array(ab);
  let stringLength = buf32[0];
  let arcsByteLength = buf32[1];
  let arcindicesByteLength = buf32[2];
  let json = unpackString(coder, buf8, buf32, HeaderSize);
  let topo = JSON.parse(json);
  topo.packed = {};
  topo.packed.arcs = new Float64Array(ab, stringLength + HeaderSize, arcsByteLength / 8);
  topo.packed.arcindices = new Int32Array(ab, stringLength + HeaderSize + arcsByteLength, arcindicesByteLength / 4);
  return topo;
}
