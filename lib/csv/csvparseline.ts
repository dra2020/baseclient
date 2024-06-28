const reField = /^\s*("([^"]*(?:""[^"]*)*)"|[^,|]*)\s*[|,]?/;
const reQuote = /^"/;
const reAddOne = /[|,]$/;

export function csvParseLine(s: string): string[]
{
  let fields: string[] = [];

  s = s.trim();
  let addOne = reAddOne.test(s);
  while (s)
  {
    const match = reField.exec(s);
    if (match)
    {
      let field = match[1];
      if (reQuote.test(field))
      {
        // if quoted string, convert quoted double-quotes to single quote
        field = field.slice(1, -1).replace(/""/g, '"');
        // and remove optional start and end double quote
        field = field.replace(/^["]?/, '').replace(/["]?$/, '');
      }
      fields.push(field);
      s = s.substring(match[0].length);
    }
    else
      s = null;
  }
  // Handle trailing separator
  if (addOne)
    fields.push('');
  return fields;
}

