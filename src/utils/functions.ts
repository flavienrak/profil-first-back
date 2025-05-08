import JSON5 from 'json5';

// return total questions
const questionNumber = (value: number) => {
  let total = 0;

  // if (value <= 3) {
  //   total = value * 15;
  // } else if (value <= 6) {
  //   total = 3 * 15 + (value - 3) * 7;
  // } else {
  //   total = 3 * 15 + 3 * 7 + (value - 6) * 4;
  // }

  total = value * 3;

  return total;
};

// return question number by index
const questionNumberByIndex = (value: number) => {
  let total = 0;

  // for (let i = 0; i <= value; i++) {
  //   if (i < 3) {
  //     total += 15;
  //   } else if (i < 6) {
  //     total += 7;
  //   } else {
  //     total += 4;
  //   }
  // }
  for (let i = 0; i <= value; i++) {
    total += 3;
  }

  return total;
};

// return question range
const questionRangeByIndex = (value: number) => {
  let start = 0;
  let count = 0;

  // if (value < 3) {
  //   count = 15;
  //   start = value * 15;
  // } else if (value < 6) {
  //   count = 7;
  //   start = 3 * 15 + (value - 3) * 7;
  // } else {
  //   count = 4;
  //   start = 3 * 15 + 3 * 7 + (value - 6) * 4;
  // }
  count = 3;
  start = value * 3;

  const end = start + count - 1;

  return { start, end };
};

/**
 * Échappe les retours à la ligne à l’intérieur des littéraux de chaîne JSON
 */
const escapeNewlinesInJsonStrings = (block: string): string =>
  block.replace(/"(?:[^"\\]|\\.)*"/g, (strLiteral) => {
    const inner = strLiteral.slice(1, -1);
    const escaped = inner.replace(/(\r\n|\r|\n)/g, '\\n');
    return `"${escaped}"`;
  });

/**
 * Extrait et parse un bloc JSON ou JSON5 (objet `{...}` ou tableau `[...]`) depuis une chaîne arbitraire.
 * @param value La chaîne potentiellement contenant du JSON
 * @returns L’objet JavaScript parsé ou `null` si on n’a pas réussi à parser
 */
const extractJson = (value?: string | null): any | null => {
  if (!value) {
    return null;
  }
  // 1) Extraire soit un bloc ```json``` soit un objet/ tableau JSON brut
  const raw =
    value.match(/```json\s*([\s\S]*?)\s*```/)?.[1] ||
    value.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)?.[0] ||
    null;
  if (!raw) return null;

  // 2) Échapper les retours à la ligne dans les chaînes JSON
  const prepped = escapeNewlinesInJsonStrings(raw);

  // 3) Tenter JSON.parse (strict)
  try {
    return JSON.parse(prepped);
  } catch {
    console.warn('JSON.parse a échoué, essai avec JSON5.parse');
  }

  // 4) Tenter JSON5.parse (plus permissif)
  try {
    return JSON5.parse(prepped);
  } catch {
    console.warn('JSON5.parse a échoué, sanitation en dernier recours');
  }

  // 5) Sanitation + dernier essai JSON5.parse
  const sanitized = prepped
    .replace(/[\x00-\x1F]+/g, '') // supprime caractères de contrôle
    .replace(/(?<!\\)(\r\n|\r|\n)/g, '\\n'); // échappe tout retour à la ligne

  try {
    return JSON5.parse(sanitized);
  } catch (err) {
    console.error('Sanitation + JSON5.parse a échoué :', err);
    return null;
  }
};

export {
  questionNumber,
  questionNumberByIndex,
  questionRangeByIndex,
  extractJson,
};
