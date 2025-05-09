// scripts.js

document.addEventListener("DOMContentLoaded", function () {
  const output = document.getElementById('output');

  // Fetch and run the BinaryLang script
  fetchAndRunBinaryLang("program.binjs").then(result => {
    output.textContent = result;
  });

  // Listen for changes in the register select dropdown
  const registerSelect = document.getElementById('register-select');
  registerSelect.addEventListener('change', () => {
    const selectedRegister = registerSelect.value;
    updateRegisterHistoryForSelected(selectedRegister);
  });

  // Function to update register history for selected register
  function updateRegisterHistoryForSelected(selectedRegister) {
    const registerHistorySelectDisplay = document.getElementById('register-history-select');
    const history = registerHistories[selectedRegister];

    let historyText = `History for ${selectedRegister}:\n`;
    if (history && history.length > 0) {
      historyText += history.join('\n');
    } else {
      historyText += `No history available for ${selectedRegister}.`;
    }

    registerHistorySelectDisplay.textContent = historyText;
  }
});
