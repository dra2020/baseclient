interface RGB
{
  r: number,
  g: number,
  b: number,
}

export interface Stop
{
  color: string,
  stop: number,
  rgb?: RGB;
}

export type GradientStops = Stop[];

function parseStops(stops: GradientStops): void
{
  if (stops[0].rgb) return;

  stops.forEach((s) => {
      if (s.rgb === undefined)
      {
        let r = parseInt(s.color.substr(1, 2), 16);
        let g = parseInt(s.color.substr(3, 2), 16);
        let b = parseInt(s.color.substr(5, 2), 16);
        s.rgb = { r: r, g: g, b: b };
      }
    });
  stops.sort();
}

function asHex(v: number): string
{
  return v.toString(16).padStart(2, '0');
}

function toHexColor(r: number, g: number, b: number): string
{
  return `#${asHex(r)}${asHex(g)}${asHex(b)}`;
}

export function execGradient(stops: GradientStops, value: number): string
{
  parseStops(stops);
  let r = stops[stops.length-1].rgb.r;
  let g = stops[stops.length-1].rgb.g;
  let b = stops[stops.length-1].rgb.b;
  for (let i = 1; i < stops.length; i++)
  {
    let e = stops[i];
    if (value < e.stop)
    {
      let s = stops[i-1];
      r = s.rgb.r + Math.floor(((e.rgb.r - s.rgb.r) * (value - s.stop) / (e.stop - s.stop)));
      g = s.rgb.g + Math.floor(((e.rgb.g - s.rgb.g) * (value - s.stop) / (e.stop - s.stop)));
      b = s.rgb.b + Math.floor(((e.rgb.b - s.rgb.b) * (value - s.stop) / (e.stop - s.stop)));
      break;
    }
  }
  return toHexColor(r, g, b);
}

export function parseGradient(sStops: string): GradientStops
{
  let stops: GradientStops = [];
  let re = / ?([^ ]+) ([^ ,]+%?),?(.*)/;

  if (sStops == null || sStops == '' ) return stops;

  // Strip off leading CSS form if present
  if (sStops.indexOf('linear-gradient') == 0)
  {
    let rePre = /^[^,]*, (.*)\)$/;
    let a = rePre.exec(sStops);
    if (a)
      sStops = a[1];
  }

  while (sStops && sStops != '')
  {
    let a = re.exec(sStops);
    if (a == null)
      break;
    let stop = a[2];
    sStops = a[3];
    if (a[2].indexOf('%') >= 0)
    {
      stop = stop.substr(0, stop.length-1);
      stop = String(Number(stop) * 0.01);
    }
      
    stops.push({ color: a[1], stop: Number(stop) });
  }
  return stops;
}

export function asCSSGradient(stops: GradientStops): string
{
  parseStops(stops);

  let a: string[] = [];
  stops.forEach((s) => {
      let stop = s.stop >= 0.0 && s.stop <= 1.0 ? `${Math.round(s.stop*100)}%` : String(s.stop);
      a.push(`${toHexColor(s.rgb.r, s.rgb.g, s.rgb.b)} ${stop}`);
    });
  return `linear-gradient(to right, ${a.join(', ')})`;
}
