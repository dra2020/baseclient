import * as JsColorMapsData from './jscolormapsdata';
import {Util} from '../all/all'

export const MaxOrderedColors: number = 50;
export const MaxColors: number = MaxOrderedColors * 3;    // Tied to orderedColors()
export const MaxClassicColors: number = 55;

export const DefaultColorNames: string[] = [
  'GhostWhite',
  'Blue',
  'Green',
  'DarkMagenta',
  'Red',
  'Gold',
  'Teal',
  'Chocolate',   //'DarkGray',     // 
  'SlateBlue',
  'Cyan',
  'DeepPink',
  'Chartreuse',
  'CornflowerBlue',
  'DarkSalmon',
  'Olive',
  'DarkOrange',
  'Lime',
  'DarkSlateBlue',
  'Yellow',
  'YellowGreen',
  'Pink',
  'Maroon',
  'Sienna',
  'Aquamarine',
  'Indigo',
  'PaleVioletRed',
  'Navy',   // 'Gray',       //     
  'SpringGreen',
  'Plum',
  'DarkSeaGreen',
  'LightCoral',
  'Khaki',
  'OrangeRed',
  'RoyalBlue',
  'LimeGreen',
  'DarkOrchid',
  'Orange',
  'DodgerBlue',
  'MediumAquamarine',
  'Moccasin',
  'Firebrick',
  'LightSteelBlue',
  'LawnGreen',
  'Magenta',
  'MediumVioletRed',
  'Turquoise',
  'Tomato',
  'Thistle',
  'SandyBrown',
  'IndianRed',
  'PowderBlue',
  'SaddleBrown',
  'OliveDrab',
  'Fuchsia',      // 'Gainsboro',    //
  'PeachPuff',
  'RosyBrown',
];

export interface ColorLookup
{
  [key: string]: string;
}

export const ColorValues: ColorLookup =
{
  'AliceBlue': '#F0F8FF',
  'AntiqueWhite': '#FAEBD7',
  'Aqua': '#00FFFF',
  'Aquamarine': '#7FFFD4',
  'Azure': '#F0FFFF',
  'Beige': '#F5F5DC',
  'Bisque': '#FFE4C4',
  'Black': '#000000',
  'BlanchedAlmond': '#FFEBCD',
  'Blue': '#0000FF',
  'BlueViolet': '#8A2BE2',
  'Brown': '#A52A2A',
  'BurlyWood': '#DEB887',
  'CadetBlue': '#5F9EA0',
  'Chartreuse': '#7FFF00',
  'Chocolate': '#D2691E',
  'Coral': '#FF7F50',
  'CornflowerBlue': '#6495ED',
  'Cornsilk': '#FFF8DC',
  'Crimson': '#DC143C',
  'Cyan': '#00FFFF',
  'DarkBlue': '#00008B',
  'DarkCyan': '#008B8B',
  'DarkGoldenrod': '#B8860B',
  'DarkGray': '#A9A9A9',
  'DarkGreen': '#006400',
  'DarkKhaki': '#BDB76B',
  'DarkMagenta': '#8B008B',
  'DarkOliveGreen': '#556B2F',
  'DarkOrange': '#FF8C00',
  'DarkOrchid': '#9932CC',
  'DarkRed': '#8B0000',
  'DarkSalmon': '#E9967A',
  'DarkSeaGreen': '#8FBC8F',
  'DarkSlateBlue': '#483D8B',
  'DarkSlateGray': '#2F4F4F',
  'DarkTurquoise': '#00CED1',
  'DarkViolet': '#9400D3',
  'DeepPink': '#FF1493',
  'DeepSkyBlue': '#00BFFF',
  'DimGray': '#696969',
  'DodgerBlue': '#1E90FF',
  'Firebrick': '#B22222',
  'FloralWhite': '#FFFAF0',
  'ForestGreen': '#228B22',
  'Fuchsia': '#FF00FF',
  'Gainsboro': '#DCDCDC',
  'GhostWhite': '#F8F8FF',
  'Gold': '#FFD700',
  'Goldenrod': '#DAA520',
  'Gray': '#808080',
  'Green': '#008000',
  'GreenYellow': '#ADFF2F',
  'Honeydew': '#F0FFF0',
  'HotPink': '#FF69B4',
  'IndianRed': '#CD5C5C',
  'Indigo': '#4B0082',
  'Ivory': '#FFFFF0',
  'Khaki': '#F0E68C',
  'Lavender': '#E6E6FA',
  'LavenderBlush': '#FFF0F5',
  'LawnGreen': '#7CFC00',
  'LemonChiffon': '#FFFACD',
  'LightBlue': '#ADD8E6',
  'LightCoral': '#F08080',
  'LightCyan': '#E0FFFF',
  'LightGoldenrodYellow': '#FAFAD2',
  'LightGray': '#D3D3D3',
  'LightGreen': '#90EE90',
  'LightPink': '#FFB6C1',
  'LightSalmon': '#FFA07A',
  'LightSeaGreen': '#20B2AA',
  'LightSkyBlue': '#87CEFA',
  'LightSlateGray': '#778899',
  'LightSteelBlue': '#B0C4DE',
  'LightYellow': '#FFFFE0',
  'Lime': '#00FF00',
  'LimeGreen': '#32CD32',
  'Linen': '#FAF0E6',
  'Magenta': '#FF00FF',
  'Maroon': '#800000',
  'MediumAquamarine': '#66CDAA',
  'MediumBlue': '#0000CD',
  'MediumOrchid': '#BA55D3',
  'MediumPurple': '#9370DB',
  'MediumSeaGreen': '#3CB371',
  'MediumSlateBlue': '#7B68EE',
  'MediumSpringGreen': '#00FA9A',
  'MediumTurquoise': '#48D1CC',
  'MediumVioletRed': '#C71585',
  'MidnightBlue': '#191970',
  'MintCream': '#F5FFFA',
  'MistyRose': '#FFE4E1',
  'Moccasin': '#FFE4B5',
  'NavajoWhite': '#FFDEAD',
  'Navy': '#000080',
  'OldLace': '#FDF5E6',
  'Olive': '#808000',
  'OliveDrab': '#6B8E23',
  'Orange': '#FFA500',
  'OrangeRed': '#FF4500',
  'Orchid': '#DA70D6',
  'PaleGoldenrod': '#EEE8AA',
  'PaleGreen': '#98FB98',
  'PaleTurquoise': '#AFEEEE',
  'PaleVioletRed': '#DB7093',
  'PapayaWhip': '#FFEFD5',
  'PeachPuff': '#FFDAB9',
  'Peru': '#CD853F',
  'Pink': '#FFC0CB',
  'Plum': '#DDA0DD',
  'PowderBlue': '#B0E0E6',
  'Purple': '#800080',
  'Red': '#FF0000',
  'RosyBrown': '#BC8F8F',
  'RoyalBlue': '#4169E1',
  'SaddleBrown': '#8B4513',
  'Salmon': '#FA8072',
  'SandyBrown': '#F4A460',
  'SeaGreen': '#2E8B57',
  'SeaShell': '#FFF5EE',
  'Sienna': '#A0522D',
  'Silver': '#C0C0C0',
  'SkyBlue': '#87CEEB',
  'SlateBlue': '#6A5ACD',
  'SlateGray': '#708090',
  'Snow': '#FFFAFA',
  'SpringGreen': '#00FF7F',
  'SteelBlue': '#4682B4',
  'Tan': '#D2B48C',
  'Teal': '#008080',
  'Thistle': '#D8BFD8',
  'Tomato': '#FF6347',
  'Turquoise': '#40E0D0',
  'Violet': '#EE82EE',
  'Wheat': '#F5DEB3',
  'White': '#FFFFFF',
  'WhiteSmoke': '#F5F5F5',
  'Yellow': '#FFFF00',
  'YellowGreen': '#9ACD32',
};

// For Demographics scale (4 colors)
export const CountEthnicFewClassicColors = 4;
export const EthnicFewClassicColors = [
  '#fafafa',  // 
  '#aaaaaa',  // 
  '#666666',  //
  '#111111',  // 
];

// For Partisan Precinct Scale (12 colors)
export const CountPartisanPrecinctClassicColors = 12;
export const PartisanPrecinctClassicColors = [
  '#960018',  // Carmine
  '#FF2020',  // 
  '#FF6060',  // 
  '#FFA0A0',  // 
  '#FFC0C0',  //
  '#FFDEDE',  // pale red
  '#DEDEFF',  // pale blue
  '#C0C0FF',  // 
  '#A0A0FF',  // 
  '#6060FF',  // 
  '#2020FF',  // 
  '#00008B',  // Dark blue
];

// For Partisan District Scale (12 stops)
export const CountPartisanDistrictClassicColors = 12;
export let PartisanDistrictClassicColors = [
  '#960018',  // Carmine
  '#960018',  // .00 <= .40
  '#FF2020',  // 
  '#FF2020',  // .40 <= .45
  '#FF6060',  //
  '#FFDEDE',  // .45 <= .50
  '#DEDEFF',  // 
  '#6060FF',  // .50 <= .55
  '#2020FF',  // 
  '#2020FF',  // .55 <= .60
  '#00008B',  // 
  '#00008B',  // .60 <= 1.0
];

// All Groups Mosaic 16 colors
export const CountEthnicBackgroundColor = 16;
export const EthnicBackgroundColor: string[] = [
  '#c0392b', // solid white
  '#3498db', // solid black
  '#2ecc71', // solid hispanic
  '#9b59b6', // solid asian
  '#d98880', // mostly white
  '#aed6f1', // mostly black
  '#abebc6', // mostly hispanic
  '#bb8fce', // mostly asian
  '#f1c40f', // mostly native
  '#aab7b8', // mix
  '#d5f5e3', // hispanic / white
  '#d6eaf8', // black / white
  '#186a3b', // hispanic / black
  '#e8daef', // asian / white
  '#45b39d', // asian / hispanic
  '#4a235a', // black / asian
];

export const defaultDistrictsPalette = 'jet_r';

// Static color tables; lazily populated
let ColorTable: {[key: string]: string[]} = {};
let OrderedColorTable: {[key: string]: string[]} = {};

export function genColor(i: number, useFirstColor: boolean, palette: string): string
{
  // i is district number, 0 => District[0] (unassigned), so subtract 1 to access ColorTable
  if (i == 0)
    return ColorValues[DefaultColorNames[0]];

  if (!useFirstColor || !palette || palette === 'draclassic')
    return genDRAColor(i, useFirstColor);    

  const colors: string[] = orderedColors(palette);
  if (colors.length >= MaxOrderedColors)
    return colors[(i - 1) % MaxOrderedColors];

  // Unexpected to get here, but something in case of an error
  return genDRAColor(i, useFirstColor);
}

// DRA classic color palette
function genDRAColor(i: number, useFirstColor: boolean): string
{
  // i is district number, 0 => District[0] (unassigned), so subtract 1 to access ColorTable
  function gen_table(): void
  {
    ColorTable['draclassic'] = [];
    for (let i: number = 0; i < MaxClassicColors; i++)
    {
      // A little funky math below to skip the first (white) color
      let j = (i % (DefaultColorNames.length - 1)) + 1;
      ColorTable['draclassic'].push(ColorValues[DefaultColorNames[j]]);
    }
  }

  if (!ColorTable['draclassic'])
    gen_table();
  
  if (i == 0)
    return ColorValues[DefaultColorNames[0]];
  return ColorTable['draclassic'][((i - 1) + (useFirstColor ? 0 : 1)) % MaxClassicColors];
}

const DistrictsColorOrder: number[] =
  [0, 49, 24, 36, 12, 42, 6, 30, 18, 45, 3, 27, 9, 33, 15, 46, 21, 39, 4, 28, 10, 34, 16, 48, 22, 40, 5, 29, 11, 35, 17, 1, 23, 41,
    7, 31, 13, 37, 19, 47, 25, 43, 8, 32, 14, 38, 2, 20, 26, 44];

export function orderedColors(palette: string): string[]
{
  const colors = getPalette(palette);
  if (!OrderedColorTable[palette])
  {
    OrderedColorTable[palette] = [];
    for (let i: number = 0; i < MaxColors; i++)
    {
      if (palette === 'jet_r' || palette === 'turbo_r')
        OrderedColorTable[palette].push(colors[Math.floor(DistrictsColorOrder[i] * 2.5) + 12]);
      else
        OrderedColorTable[palette].push(colors[DistrictsColorOrder[i] * 3]);
    }
  }
  return OrderedColorTable[palette];
}

export function getPalette(palette: string): string[]
{
  if (palette === 'draclassic')
  {
    // return draclassic palette with only 50 colors
    let colors: string[] = [];
    for (let i = 1; i < MaxOrderedColors; i++)
      colors.push(genDRAColor(i, true));
    return colors;
  }

  return getColorTable(palette);
}

// Generate table for palette
function getColorTable(palette: string): string[]
{
  if (palette === 'demographicsclassic')
  {
    if (!ColorTable[palette])
    {
      ColorTable[palette] = [];
      for (let i = 0; i < CountEthnicFewClassicColors; i++)
        ColorTable[palette].push(EthnicFewClassicColors[i]);
    }
    return ColorTable[palette];
  }
  else if (palette === 'partisanclassic')
  {
    if (!ColorTable[palette])
    {
      ColorTable[palette] = [];
      for (let i = 0; i < CountPartisanPrecinctClassicColors; i++)
        ColorTable[palette].push(PartisanPrecinctClassicColors[i]);
    }
    return ColorTable[palette];
  }
  else if (palette === 'partisandistrictsclassic')
  {
    if (!ColorTable[palette])
    {
      ColorTable[palette] = [];
      for (let i = 0; i < CountPartisanDistrictClassicColors; i++)
        ColorTable[palette].push(PartisanDistrictClassicColors[i]);
    }
    return ColorTable[palette];
  }
  else if (palette === 'allgroupsclassic')
  {
    if (!ColorTable[palette])
    {
      ColorTable[palette] = [];
      for (let i = 0; i < CountEthnicBackgroundColor; i++)
      ColorTable[palette].push(EthnicBackgroundColor[i]);
      return ColorTable[palette];
    }
    return ColorTable[palette];
  }

  if (allPaletteNames.includes(palette))
  {
    if (!ColorTable[palette])
      ColorTable[palette] = jscolormap(palette, MaxColors);
    return ColorTable[palette];
  }
  else
    return ['#ffffff'];
}

// Helpers
function toHexColor(r: number, g: number, b: number): string
{
  return `#${Util.toHex(r)}${Util.toHex(g)}${Util.toHex(b)}`;
}

function jscolormap(name: string, shades: number): string[]
{
  let result: string[] = [];
  for (let i = 0; i < shades; i++)
  {
    const rgb: number[] = partial(name)((i + 0.5) / shades);
    result.push(toHexColor(rgb[0], rgb[1], rgb[2]));
  }
  return result;
}

// ****************************************************************
// js-colormaps was made by Timothy Gebhard (https://github.com/timothygebhard/js-colormaps), 
// used here under MIT License, and modified for TypeScript

const allPaletteNames: string[] = [
  'Accent',
  'Accent_r',
  'Blues',
  'Blues_r',
  'BrBG',
  'BrBG_r',
  'BuGn',
  'BuGn_r',
  'BuPu',
  'BuPu_r',
  'CMRmap',
  'CMRmap_r',
  'Dark2',
  'Dark2_r',
  'GnBu',
  'GnBu_r',
  'Greens',
  'Greens_r',
  'Greys',
  'Greys_r',
  'OrRd',
  'OrRd_r',
  'Oranges',
  'Oranges_r',
  'PRGn',
  'PRGn_r',
  'Paired',
  'Paired_r',
  'Pastel1',
  'Pastel1_r',
  'Pastel2',
  'Pastel2_r',
  'PiYG',
  'PiYG_r',
  'PuBu',
  'PuBu_r',
  'PuBuGn',
  'PuBuGn_r',
  'PuOr',
  'PuOr_r',
  'PuRd',
  'PuRd_r',
  'Purples',
  'Purples_r',
  'RdBu',
  'RdBu_r',
  'RdGy',
  'RdGy_r',
  'RdPu',
  'RdPu_r',
  'RdYlBu',
  'RdYlBu_r',
  'RdYlGn',
  'RdYlGn_r',
  'Reds',
  'Reds_r',
  'Set1',
  'Set1_r',
  'Set2',
  'Set2_r',
  'Set3',
  'Set3_r',
  'Spectral',
  'Spectral_r',
  'Wistia',
  'Wistia_r',
  'YlGn',
  'YlGn_r',
  'YlGnBu',
  'YlGnBu_r',
  'YlOrBr',
  'YlOrBr_r',
  'YlOrRd',
  'YlOrRd_r',
  'afmhot',
  'afmhot_r',
  'autumn',
  'autumn_r',
  'binary',
  'binary_r',
  'bone',
  'bone_r',
  'brg',
  'brg_r',
  'bwr',
  'bwr_r',
  'cividis',
  'cividis_r',
  'cool',
  'cool_r',
  'coolwarm',
  'coolwarm_r',
  'copper',
  'copper_r',
  'cubehelix',
  'cubehelix_r',
  'flag',
  'flag_r',
  'gist_earth',
  'gist_earth_r',
  'gist_gray',
  'gist_gray_r',
  'gist_heat',
  'gist_heat_r',
  'gist_ncar',
  'gist_ncar_r',
  'gist_rainbow',
  'gist_rainbow_r',
  'gist_stern',
  'gist_stern_r',
  'gist_yarg',
  'gist_yarg_r',
  'gnuplot',
  'gnuplot_r',
  'gnuplot2',
  'gnuplot2_r',
  'gray',
  'gray_r',
  'hot',
  'hot_r',
  'hsv',
  'hsv_r',
  'inferno',
  'inferno_r',
  'jet',
  'jet_r',
  'magma',
  'magma_r',
  'nipy_spectral',
  'nipy_spectral_r',
  'ocean',
  'ocean_r',
  'pink',
  'pink_r',
  'plasma',
  'plasma_r',
  'prism',
  'prism_r',
  'rainbow',
  'rainbow_r',
  'seismic',
  'seismic_r',
  'spring',
  'spring_r',
  'summer',
  'summer_r',
  'tab10',
  'tab10_r',
  'tab20',
  'tab20_r',
  'tab20b',
  'tab20b_r',
  'tab20c',
  'tab20c_r',
  'terrain',
  'terrain_r',
  'turbo',
  'turbo_r',
  'twilight',
  'twilight_r',
  'twilight_shifted',
  'twilight_shifted_r',
  'viridis',
  'viridis_r',
  'winter',
  'winter_r'];

/*
Define auxiliary functions for evaluating colormaps
 */

function evaluate_cmap(x: number, name: string, reverse: boolean) {
  /**
   * Evaluate colormap `name` at some value `x`.
   * @param {number} x - The value (between 0 and 1) at which to evaluate the colormap.
   * @param {string} name - The name of the colormap (see matplotlib documentation).
   * @reverse {boolean} reverse - Whether or not to reverse the colormap.
   * @return {list} - A 3-tuple (R, G, B) containing the color assigned to `x`.
   */

  // Ensure that the value of `x` is valid (i.e., 0 <= x <= 1)
  if (!(0 <= x && x <= 1)) {
    alert('Illegal value for x! Must be in [0, 1].')
  }

  // Ensure that `name` is a valid colormap
  if (!(name in JsColorMapsData.data)) {
    alert('Colormap ' + name + 'does not exist!');
  }

  // We can get the reverse colormap by evaluating colormap(1-x)
  if (reverse === true) {
    x = 1 - x;
  }

  // Get the colors and whether or not we need to interpolate
  let colors = JsColorMapsData.data[name]['colors'];
  let interpolate = JsColorMapsData.data[name]['interpolate'];

  if (interpolate === true) {
    return interpolated(x, colors);
  } else {
    return qualitative(x, colors);
  }
}

function interpolated(x: number, colors: any[]) {
  let lo = Math.floor(x * (colors.length - 1));
  let hi = Math.ceil(x * (colors.length - 1));
  let r = Math.round((colors[lo][0] + colors[hi][0]) / 2 * 255);
  let g = Math.round((colors[lo][1] + colors[hi][1]) / 2 * 255);
  let b = Math.round((colors[lo][2] + colors[hi][2]) / 2 * 255);
  return [r, g, b];
}

function qualitative(x: number, colors: any[]) {
  let idx = 0;
  while (x > (idx + 1) / (colors.length - 0) ) { idx++; }
  let r = Math.round(colors[idx][0] * 255);
  let g = Math.round(colors[idx][1] * 255);
  let b = Math.round(colors[idx][2] * 255);
  return [r, g, b];
}

function partial(name: string) {
  if (name.endsWith('_r')) {
    return function(x: number) { return evaluate_cmap(x, name.substring(0, name.length - 2), true) };
  } else {
    return function(x: number) { return evaluate_cmap(x, name, false) };
  }

}

// End of js-colormaps
// *********************************************************
