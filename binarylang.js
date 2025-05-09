// binarylang.js

const registerHistories = {};

async function fetchAndRunBinaryLang(filePath) {
  const registers = {};
  const registerHistoryDisplay = document.getElementById('register-history');
  const registerViewerDisplay = document.getElementById('register-viewer');
  const registerSelect = document.getElementById('register-select');

  registerHistoryDisplay.innerHTML = ""; // clear history
  const response = await fetch(filePath);
  if (!response.ok) {
    registerHistoryDisplay.textContent = "Error: Failed to load file";
    return;
  }

  const text = await response.text();
  const expandedLines = preprocess(text);
  const results = [];

  for (let i = 0; i < expandedLines.length; i++) {
    const line = expandedLines[i];
    try {
      const result = await evalBinaryLang(line, registers);
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

function preprocess(text) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('//'));
  const expanded = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const loopMatch = line.match(/^LOOP\s+(\d+)\s*{$/i);
    if (loopMatch) {
      const count = parseInt(loopMatch[1]);
      const loopBody = [];
      i++;
      while (i < lines.length && lines[i] !== '}') {
        loopBody.push(lines[i]);
        i++;
      }
      if (lines[i] !== '}') throw new Error("Missing closing '}' for LOOP");
      for (let j = 0; j < count; j++) {
        expanded.push(...loopBody);
      }
    } else {
      expanded.push(line);
    }
    i++;
  }

  return expanded;
}

async function evalBinaryLang(input, registers) {
  // Handle DELAY
  if (input.startsWith("DELAY")) {
    const match = input.match(/^DELAY\s+(\d+)$/);
    if (!match) throw new Error("Invalid DELAY format. Use: DELAY <milliseconds>");
    const delayTime = parseInt(match[1]);
    await new Promise(resolve => setTimeout(resolve, delayTime));
    return `Delayed for ${delayTime}ms`;
  }

  if (!/^[0-9a-fxob&|^~<>\+\-\=\(\)\sA-Z]+$/i.test(input)) {
    throw new Error("Invalid characters — use only binary, hex, uppercase registers, and bitwise/math ops.");
  }

  const assignMatch = input.match(/^([A-Z])\s*=\s*(.+)$/);
  if (assignMatch) {
    const reg = assignMatch[1];
    const expr = replaceRegisters(assignMatch[2], registers);
    const val = evaluate(expr);
    registers[reg] = val;

    if (!registerHistories[reg]) {
      registerHistories[reg] = [];
    }
    registerHistories[reg].push(`0b${val.toString(2).padStart(8, '0')} 0x${val.toString(16).toUpperCase().padStart(2, '0')} ${val}`);
    return formatResult(reg, val);
  }

  const expr = replaceRegisters(input, registers);
  const val = evaluate(expr);
  return formatResult(null, val);
}

function replaceRegisters(expr, registers) {
  return expr.replace(/\b[A-Z]\b/g, reg => {
    if (registers.hasOwnProperty(reg)) return registers[reg];
    throw new Error(`Register "${reg}" not defined.`);
  });
}

function evaluate(expr) {
  return Function('"use strict"; return (' + expr + ')')();
}

function formatResult(reg, value) {
  let lines = [];
  if (reg) lines.push(`  ${reg} = ${value}`);
  lines.push(`  Decimal: ${value}`);
  lines.push(`  Binary : 0b${value.toString(2)}`);
  lines.push(`  Hex    : 0x${value.toString(16).toUpperCase()}`);
  return lines.join('\n');
}

function updateRegisterHistory(registers, lineNumber) {
  const registerHistoryDisplay = document.getElementById('register-history');
  let historyText = `After Line ${lineNumber + 1}: `;

  const registerStates = [];
  for (const reg in registers) {
    if (registers.hasOwnProperty(reg)) {
      const value = registers[reg];
      registerStates.push(`${reg}: 0b${value.toString(2).padStart(8, '0')} 0x${value.toString(16).toUpperCase().padStart(2, '0')} ${value}`);
    }
  }

  historyText += registerStates.join(' | ');
  const newLine = document.createElement('pre');
  newLine.textContent = historyText;
  registerHistoryDisplay.appendChild(newLine);
}

function updateRegisterViewer(registers, registerViewerDisplay) {
  let viewerText = 'Selected Registers:\n';

  for (const reg in registers) {
    if (registers.hasOwnProperty(reg)) {
      const value = registers[reg];
      viewerText += `${reg}: 0b${value.toString(2).padStart(8, '0')} 0x${value.toString(16).toUpperCase().padStart(2, '0')} ${value}\n`;
    }
  }

  registerViewerDisplay.textContent = viewerText;
}

function updateRegisterHistorySelect(registers) {
  for (const reg in registers) {
    if (registers.hasOwnProperty(reg)) {
      const value = registers[reg];
      if (!registerHistories[reg]) {
        registerHistories[reg] = [];
      }
      registerHistories[reg].push(`0b${value.toString(2).padStart(8, '0')} 0x${value.toString(16).toUpperCase().padStart(2, '0')} ${value}`);
    }
  }
}

function updateRegisterSelect(registers) {
  const registerSelect = document.getElementById('register-select');
  
  while (registerSelect.options.length > 1) {
    registerSelect.remove(1);
  }

  for (const reg in registers) {
    if (registers.hasOwnProperty(reg)) {
      const option = document.createElement('option');
      option.value = reg;
      option.textContent = reg;
      registerSelect.appendChild(option);
    }
  }
}

window.registerHistories = registerHistories;