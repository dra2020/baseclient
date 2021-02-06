import * as geojson from 'geojson';
import * as Util from '../util/all'
import * as Poly from '../poly/all'
import * as G from './geo';

// Given the topology for a precinct, the bintrie mapping and the list of blocks, construct the
// feature data for the virtual feature.
//

export function computeVFeature(topoPrecinct: Poly.Topo, bintrie: Util.BinTrie, blocks: string[]): G.GeoFeature
{
  let contiguity = new Util.IndexedArray();
  let block_contiguity = new Util.IndexedArray();
  let f = Poly.topoMerge(topoPrecinct, blocks);
  f.properties.datasets = {};
  blocks.forEach(blockid => {
      let b = topoPrecinct.objects[blockid];
      if (b.properties.datasets)
        Util.deepAccum(f.properties.datasets, b.properties.datasets);
      if (b.properties.contiguity)
      {
        b.properties.contiguity.forEach((id: string) => {
            contiguity.set(id === 'OUT_OF_STATE' ? id : bintrie.get(id));
          });
        b.properties.contiguity.forEach((id: string) => {
            block_contiguity.set(id);
          });
      }
    });
  f.properties.contiguity = contiguity.asArray();
  f.properties.block_contiguity = block_contiguity.asArray();
  f.properties.blocks = blocks;
  return f;
}
