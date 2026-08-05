// ---- engine.js: parses spoken/typed phrases into calculations ----

const CalcEngine = (() => {

  const NUMBER_WORDS = {
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9, ten:10,
    eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17,
    eighteen:18, nineteen:19, twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70,
    eighty:80, ninety:90, hundred:100, thousand:1000
  };

  const OP_WORDS = {
    "plus":"+", "add":"+", "added to":"+",
    "minus":"-", "subtract":"-", "less":"-",
    "times":"*", "multiplied by":"*", "into":"*", "multiply":"*",
    "divided by":"/", "divide":"/", "over":"/",
    "modulo":"%", "mod":"%",
    "power of":"^", "to the power of":"^"
  };

  const UNIT_CONVERSIONS = {
    // length (base: meters)
    km_mi: v => v * 0.621371,
    mi_km: v => v / 0.621371,
    km_m:  v => v * 1000,
    m_km:  v => v / 1000,
    m_ft:  v => v * 3.28084,
    ft_m:  v => v / 3.28084,
    cm_in: v => v / 2.54,
    in_cm: v => v * 2.54,
    // weight
    kg_lb: v => v * 2.20462,
    lb_kg: v => v / 2.20462,
    g_oz:  v => v * 0.035274,
    oz_g:  v => v / 0.035274,
    // temperature
    c_f: v => (v * 9/5) + 32,
    f_c: v => (v - 32) * 5/9,
  };

  const UNIT_ALIASES = {
    km:"km", kilometer:"km", kilometers:"km", kilometre:"km", kilometres:"km",
    mi:"mi", mile:"mi", miles:"mi",
    m:"m", meter:"m", meters:"m", metre:"m", metres:"m",
    ft:"ft", foot:"ft", feet:"ft",
    cm:"cm", centimeter:"cm", centimeters:"cm",
    in:"in", inch:"in", inches:"in",
    kg:"kg", kilogram:"kg", kilograms:"kg", kilo:"kg", kilos:"kg",
    lb:"lb", lbs:"lb", pound:"lb", pounds:"lb",
    g:"g", gram:"g", grams:"g",
    oz:"oz", ounce:"oz", ounces:"oz",
    c:"c", celsius:"c",
    f:"f", fahrenheit:"f"
  };

  function wordsToNumber(text) {
    // Replaces sequences of number-words with digits, e.g. "twelve" -> "12"
    const tokens = text.split(/\s+/);
    let result = [];
    let current = 0;
    let hasNumber = false;

    for (const tok of tokens) {
      const clean = tok.replace(/[^a-z]/gi, "").toLowerCase();
      if (NUMBER_WORDS.hasOwnProperty(clean)) {
        const val = NUMBER_WORDS[clean];
        hasNumber = true;
        if (val === 100 || val === 1000) {
          current = (current === 0 ? 1 : current) * val;
        } else {
          current += val;
        }
      } else {
        if (hasNumber) {
          result.push(String(current));
          current = 0;
          hasNumber = false;
        }
        result.push(tok);
      }
    }
    if (hasNumber) result.push(String(current));
    return result.join(" ");
  }

  function normalizeOperators(text) {
    let t = " " + text.toLowerCase() + " ";
    // Multi-word operators first
    const sorted = Object.keys(OP_WORDS).sort((a,b) => b.length - a.length);
    for (const phrase of sorted) {
      const re = new RegExp(`\\b${phrase}\\b`, "g");
      t = t.replace(re, ` ${OP_WORDS[phrase]} `);
    }
    return t.trim();
  }

  function tryUnitConversion(text) {
    // e.g. "convert 5 kilometers to miles" / "5 km in miles" / "how many miles is 5 km"
    const re = /(?:convert\s+)?([\d.]+)\s*([a-z]+)\s+(?:to|in|into)\s+([a-z]+)/i;
    const match = text.match(re);
    if (!match) return null;

    const value = parseFloat(match[1]);
    const fromRaw = match[2].toLowerCase();
    const toRaw = match[3].toLowerCase();
    const from = UNIT_ALIASES[fromRaw];
    const to = UNIT_ALIASES[toRaw];
    if (!from || !to || isNaN(value)) return null;

    const key = `${from}_${to}`;
    if (UNIT_CONVERSIONS[key]) {
      const converted = UNIT_CONVERSIONS[key](value);
      return {
        expression: `${value} ${fromRaw} → ${toRaw}`,
        result: round(converted)
      };
    }
    return null;
  }

  function trySpecialFunctions(text) {
    // square root
    let m = text.match(/square root of ([\d.]+)/i) || text.match(/sqrt\s*\(?\s*([\d.]+)/i);
    if (m) {
      const v = parseFloat(m[1]);
      return { expression: `√${v}`, result: round(Math.sqrt(v)) };
    }
    // square / cube
    m = text.match(/([\d.]+)\s*squared/i);
    if (m) {
      const v = parseFloat(m[1]);
      return { expression: `${v}²`, result: round(v * v) };
    }
    m = text.match(/([\d.]+)\s*cubed/i);
    if (m) {
      const v = parseFloat(m[1]);
      return { expression: `${v}³`, result: round(v * v * v) };
    }
    // percentage: "what is 20 percent of 150"
    m = text.match(/([\d.]+)\s*percent(?:age)?\s*of\s*([\d.]+)/i);
    if (m) {
      const pct = parseFloat(m[1]);
      const of = parseFloat(m[2]);
      return { expression: `${pct}% of ${of}`, result: round((pct/100) * of) };
    }
    return null;
  }

  function round(n) {
    return Math.round(n * 1e6) / 1e6;
  }

  function evaluateArithmetic(text) {
    // Only allow digits, operators, parens, decimal points, spaces, ^
    let cleaned = text.replace(/[^0-9+\-*/().^%\s]/g, "").trim();
    if (!cleaned) return null;

    // Support ^ as power
    cleaned = cleaned.replace(/\^/g, "**");

    try {
      // Safe-ish eval: only numeric/operator chars are allowed at this point
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${cleaned})`)();
      if (typeof value !== "number" || !isFinite(value)) return null;
      return { expression: text.trim(), result: round(value) };
    } catch {
      return null;
    }
  }

  // Main entry point: takes raw spoken/typed text, returns {expression, result} or null
  function parse(rawText) {
    if (!rawText || !rawText.trim()) return null;
    let text = rawText.trim();

    // 1. Unit conversion check (before word->number, since unit names matter)
    const converted = tryUnitConversion(wordsToNumber(text));
    if (converted) return converted;

    // 2. Special functions (sqrt, square, percent) on word-converted text
    const numText = wordsToNumber(text);
    const special = trySpecialFunctions(numText);
    if (special) return special;

    // 3. General arithmetic: convert words -> numbers -> operator symbols -> eval
    const withOps = normalizeOperators(numText);
    const arithmetic = evaluateArithmetic(withOps);
    if (arithmetic) return { expression: withOps, result: arithmetic.result };

    return null;
  }

  return { parse, wordsToNumber, normalizeOperators };
})();
