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
  
        // Display register assignments and function results
        updateRegisterHistory(registers, i);
        updateRegisterViewer(registers, registerViewerDisplay);
        updateRegisterHistorySelect(registers);
        updateRegisterSelect(registers);
  
        // Add result for function calls or assignments
        results.push(`Line ${i + 1}: ${line}\n${result}\n`);
      } catch (err) {
        results.push(`Error on line ${i + 1}: ${err.message}\n`);
      }
    }
  
    return results.join('\n');
}


function preprocess(text, globalRegs = {}) {
    const lines = text
      .split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('//'));
  
    const output = [];
    let i = 0;
  
    while (i < lines.length) {
      const line = lines[i];
  
      // 1) Function definition
      let mDef = line.match(/^([A-Z_][A-Z0-9_]*)\s+([A-Z](?:\s*,\s*[A-Z])*)\s*\{$/i);
      if (mDef) {
        const [_, name, paramList] = mDef;
        const params = paramList.split(/\s*,\s*/);
        const body = [];
        i++;
        while (i < lines.length && lines[i] !== '}') {
          body.push(lines[i]);
          i++;
        }
        if (lines[i] !== '}') throw new Error(`Missing } for function ${name}`);
        functions[name] = { params, body };
        i++;
        continue;
      }
  
      // 2) Loop block
      let mLoop = line.match(/^LOOP\s+(\d+)\s*\{$/i);
      if (mLoop) {
        const count = parseInt(mLoop[1], 10);
        const loopBody = [];
        i++;
        while (i < lines.length && lines[i] !== '}') {
          loopBody.push(lines[i]);
          i++;
        }
        if (lines[i] !== '}') throw new Error(`Missing } for LOOP`);
        i++;
  
        // Unroll the loop, merging globals after each CALL
// inside your LOOP unroller, after parsing `count` and `loopBody`:
for (let iter = 0; iter < count; iter++) {
    for (const bodyLine of loopBody) {
      // Detect CALL inside the loop body
      const callInside = bodyLine.match(/^CALL\s+([A-Z_][A-Z0-9_]*)\s+(.*)$/i);
      if (callInside) {
        const [, fnName, argStr] = callInside;
        const fn = functions[fnName];
        if (!fn) throw new Error(`Function "${fnName}" not defined`);
        const { params, body } = fn;
        const args = argStr.split(/\s*,\s*/);
        if (args.length !== params.length) {
          throw new Error(`Function "${fnName}" expects ${params.length} args`);
        }
  
        // Seed a fresh local context from the current globals
        let localCtx = { ...globalRegs };
        // Bind parameters into localCtx
        params.forEach((p, i) => {
          const a = args[i];
          let val;
          if (/^[A-Z]$/.test(a)) {
            if (!(a in globalRegs)) throw new Error(`Register "${a}" not defined.`);
            val = globalRegs[a];
          } else if (/^0b[01]+$/i.test(a)) {
            val = parseInt(a.slice(2), 2);
          } else if (/^0x[0-9a-f]+$/i.test(a)) {
            val = parseInt(a, 16);
          } else {
            val = parseInt(a, 10);
          }
          localCtx[p] = val;
        });
  
        // Execute each line of the function body in order
        for (const fnLine of body) {
          // Emit the line with a snapshot of localCtx
          output.push({ line: fnLine, ctx: { ...localCtx } });
  
          // If it's a DELAY, skip merging registers
          const delayMatch = fnLine.match(/^DELAY\s+(\d+)$/i);
          if (delayMatch) {
            continue;
          }
  
          // If it’s an assignment, apply it
          const mAssign = fnLine.match(/^([A-Z])\s*=\s*(.+)$/i);
          if (mAssign) {
            const [, r, expr] = mAssign;
            const replaced = replaceRegisters(expr, localCtx);
            const val = evaluate(replaced);
            localCtx[r] = val;
            if (r in globalRegs) {
              globalRegs[r] = val;
            }
          }
        }
  
      } else {
        // Non‑CALL line inside the loop: emit it
        output.push({ line: bodyLine, ctx: { ...globalRegs } });
  
        // Handle DELAY at top level inside the loop
        const delayMatch = bodyLine.match(/^DELAY\s+(\d+)$/i);
        if (delayMatch) {
          continue;
        }
  
        // If it’s a plain assignment, merge it
        const mTopAssign = bodyLine.match(/^([A-Z])\s*=\s*(.+)$/i);
        if (mTopAssign) {
          const [, r, expr] = mTopAssign;
          const replaced = replaceRegisters(expr, globalRegs);
          const val = evaluate(replaced);
          globalRegs[r] = val;
        }
      }
    }
  }
  for (let iter = 0; iter < count; iter++) {
    for (const bodyLine of loopBody) {
      // Detect CALL inside the loop body
      const callInside = bodyLine.match(/^CALL\s+([A-Z_][A-Z0-9_]*)\s+(.*)$/i);
      if (callInside) {
        const [, fnName, argStr] = callInside;
        const fn = functions[fnName];
        if (!fn) throw new Error(`Function "${fnName}" not defined`);
        const { params, body } = fn;
        const args = argStr.split(/\s*,\s*/);
        if (args.length !== params.length) {
          throw new Error(`Function "${fnName}" expects ${params.length} args`);
        }
  
        // Seed a fresh local context from the current globals
        let localCtx = { ...globalRegs };
        // Bind parameters into localCtx
        params.forEach((p, i) => {
          const a = args[i];
          let val;
          if (/^[A-Z]$/.test(a)) {
            if (!(a in globalRegs)) throw new Error(`Register "${a}" not defined.`);
            val = globalRegs[a];
          } else if (/^0b[01]+$/i.test(a)) {
            val = parseInt(a.slice(2), 2);
          } else if (/^0x[0-9a-f]+$/i.test(a)) {
            val = parseInt(a, 16);
          } else {
            val = parseInt(a, 10);
          }
          localCtx[p] = val;
        });
  
        // Execute each line of the function body *in order*
        for (const fnLine of body) {
          // 1) Emit the line with a snapshot of localCtx *before* merging
          output.push({ line: fnLine, ctx: { ...localCtx } });
  
          // 2) If it’s an assignment, apply it to both localCtx and globalRegs
          const mAssign = fnLine.match(/^([A-Z])\s*=\s*(.+)$/i);
          if (mAssign) {
            const [, r, expr] = mAssign;
            // replace registers in the expression using localCtx
            const replaced = replaceRegisters(expr, localCtx);
            const val = evaluate(replaced);
            // update local context
            localCtx[r] = val;
            // immediately merge that one register into the globals
            if (r in globalRegs) {
              globalRegs[r] = val;
            }
          }
          // (if the line isn’t an assignment, it could be DELAY or an expression,
          // but since neither writes to registers, we just emit and move on)
        }
  
      } else {
        // Non‑CALL line inside the loop: emit and merge if needed
        output.push({ line: bodyLine, ctx: { ...globalRegs } });
  
        // If it’s an assignment at top‑level within the loop body, merge it too
        const mTopAssign = bodyLine.match(/^([A-Z])\s*=\s*(.+)$/i);
        if (mTopAssign) {
          const [, r, expr] = mTopAssign;
          const replaced = replaceRegisters(expr, globalRegs);
          const val = evaluate(replaced);
          globalRegs[r] = val;
        }
      }
    }
  }
  
        continue;
      }
  
      // 3) Top‑level CALL
      let mCall = line.match(/^CALL\s+([A-Z_][A-Z0-9_]*)\s+(.*)$/i);
      if (mCall) {
        const [, fnName, argStr] = mCall;
        if (!functions[fnName]) throw new Error(`Function "${fnName}" not defined`);
        const { params, body } = functions[fnName];
        const args = argStr.split(/\s*,\s*/);
        if (args.length !== params.length) {
          throw new Error(`Function "${fnName}" expects ${params.length} args`);
        }
        const localCtx = { ...globalRegs };
        params.forEach((p, idx) => {
          const a = args[idx];
          let val;
          if (/^[A-Z]$/.test(a)) {
            if (!(a in globalRegs)) throw new Error(`Register "${a}" not defined.`);
            val = globalRegs[a];
          } else if (/^0b[01]+$/i.test(a)) {
            val = parseInt(a.slice(2), 2);
          } else if (/^0x[0-9a-f]+$/i.test(a)) {
            val = parseInt(a, 16);
          } else {
            val = parseInt(a, 10);
          }
          localCtx[p] = val;
        });
        body.forEach(bl => output.push({ line: bl, ctx: localCtx }));
        // merge globals
        for (const reg of Object.keys(globalRegs)) {
          if (reg in localCtx) globalRegs[reg] = localCtx[reg];
        }
        i++;
        continue;
      }
  
      // 4) Top‑level assignment
      let mAssign = line.match(/^([A-Z])\s*=\s*(.+)$/i);
      if (mAssign) {
        const [, reg, expr] = mAssign;
        const val = evaluate(replaceRegisters(expr, globalRegs));
        globalRegs[reg] = val;
        output.push({ line, ctx: { ...globalRegs } });
        i++;
        continue;
      }
  
      // 5) Anything else
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
  
    if (!/^[0-9a-fxob&|^~<>\+\-\*/=\(\)\sA-Z]+$/i.test(input)) {
      throw new Error("Invalid characters in instruction");
    }
  
    // Register assignment
    const assign = input.match(/^([A-Z])\s*=\s*(.+)$/);
    if (assign) {
      const [_full, r, expr] = assign;
      const replaced = replaceRegisters(expr, registers);
      const val = evaluate(replaced);
      registers[r] = val;
      registerHistories[r] = registerHistories[r] || [];
      registerHistories[r].push(
        `0b${val.toString(2).padStart(8, '0')} 0x${val.toString(16).toUpperCase().padStart(2, '0')} ${val}`
      );
      return formatResult(r, val);
    }
  
    // Function calls or normal instructions
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
    lines.push(`  Binary : 0b${v.toString(2).padStart(8, '0')}`);
    lines.push(`  Hex    : 0x${v.toString(16).toUpperCase()}`);
    return lines.join('\n');
}

function updateRegisterHistory(registers, ln) {
    const d = document.getElementById('register-history');
    const entry = document.createElement('pre');
  
    // Only include registers that we actually track globally:
    const globalsOnly = Object
      .keys(registers)
      .filter(r => registerHistories[r] && registerHistories[r].length > 0);
  
    entry.textContent = `After Line ${ln + 1}: ` +
      globalsOnly
        .map(r => {
          const v = registers[r];
          return `${r}: 0b${v.toString(2).padStart(8, '0')} 0x${v.toString(16).toUpperCase()} ${v}`;
        })
        .join(' | ');
  
    d.appendChild(entry);
}
  

function updateRegisterViewer(registers, view) {
view.textContent =
    'Selected Registers:\n' +
    Object.entries(registers)
    .map(([r, v]) => `${r}: 0b${v.toString(2).padStart(8, '0')} 0x${v.toString(16).toUpperCase()} ${v}`)
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
