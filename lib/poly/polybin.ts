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

/**
 * Properties temporarily removed for the duration of a pack, and where they came from.
 *
 * WHY THIS IS WORTH HAVING. The JSON in a geopack is JSON.stringify of the collection, so anything
 * hanging off a feature goes into the file. A Float64Array does not survive that: it serializes as
 * {"0":n,"1":n,...}, which is both enormous and unreadable on the way back - the same damage
 * repairPackedBuffers exists to undo for coordinates. PackedFields are exactly such arrays, and they
 * are DERIVED, so writing them is waste even when it works. Naming them here means a caller cannot
 * forget, and does not have to strip and rebuild them around every call.
 */
interface OmittedProps
{
  o: any;
  name: string;
  value: any;
}

function collectOmitted(col: any, omit?: string[]): OmittedProps[]
{
  let saved: OmittedProps[] = [];
  if (! omit || omit.length === 0) return saved;

  const take = (o: any) => {
      if (! o) return;
      omit.forEach(name => {
          if (o[name] !== undefined) { saved.push({ o, name, value: o[name] }); delete o[name] }
        });
    };

  take(col);
  if (col.features) col.features.forEach((f: any) => { take(f); take(f.properties) });
  return saved;
}

function restoreOmitted(saved: OmittedProps[]): void
{
  saved.forEach(s => { s.o[s.name] = s.value });
}

/** One feature's coordinates during a pack: where they are now, and where they are going. */
interface PackSlot
{
  packed: any;        // the feature's geometry.packed
  buffer: any;        // its buffer, to be put back afterwards
  fromOffset: number; // its index within that buffer
  toOffset: number;   // its index within the file's coordinate section
  length: number;
}

/**
 * Serialize a collection to the geopack format.
 *
 * The file wants one contiguous coordinate section with every feature's offset an index into it, and
 * that used to be arranged by requiring the whole collection to already sit in ONE buffer at exactly
 * those offsets - packCollection simply blitted that buffer across whole. Which held only as long as
 * nothing had touched the collection since: pack a collection, add a feature, pack again, and the
 * second pack either redid all the work or produced offsets into a buffer that no longer described it.
 *
 * So the coordinates are gathered feature by feature instead. Each one is given its place in the
 * output, and its floats are copied from wherever they happen to live now - one buffer or several. The
 * work is the same (every float is copied either way), the assumption is gone, and featurePack is free
 * to leave already-packed features alone.
 *
 * THE FORMAT IS UNCHANGED. Offsets are assigned in feature order from zero, which is exactly what a
 * single shared buffer produced, so files written before and after this are byte-identical and each
 * reads under the other.
 *
 * `omit` names properties to leave out of the serialized JSON - see the note on collectOmitted.
 */
export function packCollection(coder: Util.Coder, col: any, omit?: string[]): ArrayBuffer
{
  // Which features arrive unpacked, so they can be left that way. Packing is how the coordinates get
  // written; it is not something the caller asked for, and a caller that handed over an unpacked
  // collection and got a packed one back would find its own coordinates gone. Equally, a caller whose
  // collection was ALREADY packed must not have it unpacked - that rebuilds every coordinate array
  // for nothing, which on a large collection is the memory this change exists to stop spending.
  let wasUnpacked: any[] = [];
  if (col.features) col.features.forEach((f: any) => { if (! PP.featureIsPacked(f)) wasUnpacked.push(f) });

  PP.featurePack(col);

  // Where every feature's coordinates are now, and where they will be in the file.
  let slots: PackSlot[] = [];
  let nFloats = 0;
  col.features.forEach((f: any) => {
      const packed = f.geometry ? f.geometry.packed : null;
      if (! packed) return;
      slots.push({ packed, buffer: packed.buffer, fromOffset: packed.offset, toOffset: nFloats,
                   length: packed.length });
      nFloats += packed.length;
    });

  // The JSON carries each feature's offset, so the offsets have to be the file's before it is built.
  // Buffers come out because they are reconstructed on the way back in.
  slots.forEach(s => { s.packed.offset = s.toOffset; delete s.packed.buffer });
  const omitted = collectOmitted(col, omit);

  let size = 16; // int endianness, offset to coordinates, float endianness
  let j = JSON.stringify(col);
  size += sizeOfString(coder, j);
  size += pad(size, 8);
  let fullsize = size + nFloats * 8;

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

  const foff = offset >> 3;
  slots.forEach(s => {
      const src = s.buffer as Float64Array;
      if (! src) return;   // no coordinates: points, and features with no geometry
      let to = foff + s.toOffset;
      let from = s.fromOffset;
      for (let i = 0; i < s.length; i++)
        buf64[to++] = src[from++];
    });

  // Put the collection back exactly as it was found.
  slots.forEach(s => { s.packed.offset = s.fromOffset; s.packed.buffer = s.buffer });
  restoreOmitted(omitted);
  wasUnpacked.forEach(f => PP.featureUnpack(f));

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
  // On-disk format predates the topology.packed.objectArcs WeakMap: each object
  // carried its own `packedarcs: number` field in the serialized JSON. Preserve
  // that format. We temporarily project the WeakMap entries back onto each object
  // before stringifying, then strip them so the in-memory topology is unchanged.
  let projected: any[] = [];
  if (savepack.objectArcs)
    for (let id in topo.objects)
    {
      let o = topo.objects[id];
      let off = savepack.objectArcs.get(o);
      if (off !== undefined) { o.packedarcs = off; projected.push(o); }
    }
  delete topo.packed;
  let json = JSON.stringify(topo);
  projected.forEach(o => { delete o.packedarcs; });
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
  // Reconstruct the WeakMap from the legacy per-object `packedarcs` field, then
  // strip the field so the object representation matches a freshly-packed one.
  let objectArcs = new WeakMap<object, number>();
  if (topo.objects)
    for (let id in topo.objects)
    {
      let o = topo.objects[id];
      if (o && o.packedarcs !== undefined)
      {
        objectArcs.set(o, o.packedarcs);
        delete o.packedarcs;
      }
    }
  topo.packed.objectArcs = objectArcs;
  return topo;
}
