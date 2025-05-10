// scripts.js

document.addEventListener("DOMContentLoaded", function () {
  const output = document.getElementById('output');
  const fileInput = document.getElementById('file-input');
  const registerSelect = document.getElementById('register-select');

  fileInput.addEventListener('change', async function (e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (event) {
      const fileContent = event.target.result;
      const result = await runBinaryLangFromText(fileContent);
      output.textContent = result;
    };
    reader.readAsText(file);
  });

  registerSelect.addEventListener('change', () => {
    const selectedRegister = registerSelect.value;
    updateRegisterHistoryForSelected(selectedRegister);
  });

  function updateRegisterHistoryForSelected(selectedRegister) {
    const display = document.getElementById('register-history-select');
    const history = registerHistories[selectedRegister];

    let historyText = `History for ${selectedRegister}:\n`;
    if (history && history.length > 0) {
      historyText += history.join('\n');
    } else {
      historyText += `No history available for ${selectedRegister}.`;
    }

    display.textContent = historyText;
  }
});

async function runBinaryLangFromText(text) {
  const registers = {};
  const registerHistoryDisplay = document.getElementById('register-history');
  const registerViewerDisplay = document.getElementById('register-viewer');

  registerHistoryDisplay.innerHTML = "";

  const expanded = preprocess(text, registers);
  const results = [];

  for (let i = 0; i < expanded.length; i++) {
    const { line, ctx } = expanded[i];
    try {
      const result = await evalBinaryLang(line, ctx);
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