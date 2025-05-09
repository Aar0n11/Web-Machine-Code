// binarylang.js

const registerHistories = {};
const functions = {};

async function fetchAndRunBinaryLang(filePath) {
  const registers = {};
  const registerHistoryDisplay = document.getElementById('register-history');
  const registerViewerDisplay = document.getElementById('register-viewer');
  const registerSelect = document.getElementById('register-select');

  registerHistoryDisplay.innerHTML = "";
  const response = await fetch(filePath);
  if (!response.ok) {
    registerHistoryDisplay.textContent = "Error: Failed to load file";
    return;
  }

  const text = await response.text();
  const expanded = preprocess(text, registers);
  const results = [];

  for (let i = 0; i < expanded.length; i++) {
    const { line, ctx } = expanded[i];
    try {
      const result = await evalBinaryLang(line, ctx);
      // merge any changes from this local context into global registers
      Object.assign(registers, ctx);

      updateRegisterHistory(registers, i);
      updateRegisterViewer(registers, registerViewerDisplay);
      updateRegisterHistorySelect(registers);
      updateRegisterSelect(registers);

      results.push(`Line ${i + 1}: ${line}\n${result}\n`);
    } catch (err) {
      results.push(`Error on line ${i + 1}: ${err.message}\n`);
    }
  }

  return results.join('\n');
}

function preprocess(text, globalRegs = {}) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'));
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const def = line.match(/^([A-Z_][A-Z0-9_]*)\s+([A-Z](?:,\s*[A-Z])*)\s*{$/i);
    if (def) {
      const [_, name, paramList] = def;
      const params = paramList.split(',').map(p => p.trim());
      const body = [];
      i++;
      while (i < lines.length && lines[i] !== '}') {
        body.push(lines[i]); i++;
      }
      if (lines[i] !== '}') throw new Error(`Missing } for function ${name}`);
      functions[name] = { params, body };
      i++;
      continue;
    }

    const callMatch = line.match(/^CALL\s+([A-Z_][A-Z0-9_]*)\s+(.*)$/i);
    if (callMatch) {
      const [_, name, argStr] = callMatch;
      const args = argStr.split(',').map(s => s.trim());
      if (!functions[name]) throw new Error(`Function "${name}" not defined`);
      const { params, body } = functions[name];
      if (args.length !== params.length) throw new Error(`Function "${name}" expects ${params.length} args`);

      // create a *single* local context object for this call
      const localCtx = { ...globalRegs };
      params.forEach((p, idx) => {
        const a = args[idx];
        let val;
        if (/^[A-Z]$/.test(a)) {
          val = globalRegs[a];
        } else if (/^0b[01]+$/i.test(a)) {
          val = parseInt(a.slice(2), 2);
        } else if (/^0x[0-9a-f]+$/i.test(a)) {
          val = parseInt(a, 16);
        } else if (/^\d+$/.test(a)) {
          val = parseInt(a, 10);
        } else {
          throw new Error(`Invalid argument format: "${a}"`);
        }
                if (isNaN(val)) throw new Error(`Invalid arg "${a}" for function ${name}`);
        localCtx[p] = val;
      });

      // push each body line with the same localCtx
      for (const bodyLine of body) {
        output.push({ line: bodyLine, ctx: localCtx });
      }
      i++;
      continue;
    }

    // normal instruction with globalRegs as baseline
    output.push({ line, ctx: { ...globalRegs } });
    i++;
  }

  return output;
}

async function evalBinaryLang(input, registers) {
  if (input.startsWith("DELAY")) {
    const m = input.match(/^DELAY\s+(\d+)$/);
    if (!m) throw new Error("Invalid DELAY format");
    await new Promise(r => setTimeout(r, +m[1]));
    return `Delayed for ${m[1]}ms`;
  }

  if (!/^[0-9a-fxob&|^~<>\+\-=/\(\)\sA-Z]+$/i.test(input)) {
    throw new Error("Invalid characters in instruction");
  }

  const assign = input.match(/^([A-Z])\s*=\s*(.+)$/);
  if (assign) {
    const [_full, r, expr] = assign;
    const replaced = replaceRegisters(expr, registers);
    const val = evaluate(replaced);
    registers[r] = val;
    registerHistories[r] = registerHistories[r]||[];
    registerHistories[r].push(
      `0b${val.toString(2).padStart(8,'0')} 0x${val.toString(16).toUpperCase().padStart(2,'0')} ${val}`
    );
    return formatResult(r, val);
  }

  const replaced = replaceRegisters(input, registers);
  const val = evaluate(replaced);
  return formatResult(null, val);
}

function replaceRegisters(expr, registers) {
  return expr.replace(/\b[A-Z]\b/g, token => {
    if (!(token in registers)) throw new Error(`Register "${token}" not defined.`);
    return registers[token];
  });
}

function evaluate(expr) {
  return Function('"use strict";return('+expr+')')();
}

function formatResult(reg, v) {
  const lines = [];
  if (reg) lines.push(`  ${reg} = ${v}`);
  lines.push(`  Decimal: ${v}`);
  lines.push(`  Binary : 0b${v.toString(2)}`);
  lines.push(`  Hex    : 0x${v.toString(16).toUpperCase()}`);
  return lines.join('\n');
}

function updateRegisterHistory(registers, ln) {
  const d = document.getElementById('register-history');
  const entry = document.createElement('pre');
  entry.textContent = `After Line ${ln+1}: ` +
    Object.entries(registers)
      .map(([r,v]) => `${r}: 0b${v.toString(2).padStart(8,'0')} 0x${v.toString(16).toUpperCase()} ${v}`)
      .join(' | ');
  d.appendChild(entry);
}

function updateRegisterViewer(registers, view) {
  view.textContent =
    'Selected Registers:\n' +
    Object.entries(registers)
      .map(([r,v]) => `${r}: 0b${v.toString(2).padStart(8,'0')} 0x${v.toString(16).toUpperCase()} ${v}`)
      .join('\n');
}

function updateRegisterHistorySelect(registers) {
  for (const r in registers) {
    registerHistories[r] = registerHistories[r]||[];
    registerHistories[r].push(
      `0b${registers[r].toString(2).padStart(8,'0')} 0x${registers[r].toString(16).toUpperCase()} ${registers[r]}`
    );
  }
}

function updateRegisterSelect(registers) {
  const sel = document.getElementById('register-select');
  while (sel.options.length>1) sel.remove(1);
  Object.keys(registers).forEach(r => {
    const o = document.createElement('option'); o.value = r; o.textContent = r;
    sel.appendChild(o);
  });
}

window.registerHistories = registerHistories;
