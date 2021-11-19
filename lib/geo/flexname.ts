export function flexName(f: any): string
{
  if (!f || !f.properties) return null;

  let oneOf = [ 'name', 'entry_name', 'Name', 'NAME',
                'NAMELSAD', 'namelsad',
                'NAME10', 'name10',
                'NAMELSAD10', 'namelsad10',
                'NAME20', 'name20',
                'NAMELSAD20', 'namelsad20',
                'NAME30', 'name30',
                'NAMELSAD30', 'namelsad30',
                ];

  for (let i = 0; i < oneOf.length; i++)
    if (f.properties[oneOf[i]] !== undefined)
    {
      let name: string = f.properties[oneOf[i]];
      if (name.startsWith('Block Group') && f.properties['GEOID10'] !== undefined)
        return String(f.properties['GEOID10']).substr(2);
      name = name.replace('Voting Districts', '');
      name = name.replace('Precinct', '');
      return name.replace('Voting District', '').trim();
    }

  return `${f.properties.id}`;
}
