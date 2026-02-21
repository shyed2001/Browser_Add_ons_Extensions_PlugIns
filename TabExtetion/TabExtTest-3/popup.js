document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('saveAllBtn');
  const dashBtn = document.getElementById('openDashboard');
  const statusMsg = document.getElementById('statusMsg');
  const storageLink = document.getElementById('viewStoragePlace');

  // --- Tab Listing Feature (from Extension 1) ---
  const tabListElement = document.getElementById('tabList');
  const tabListTextElement = document.getElementById('tabListText');
  const copyButton = document.getElementById('copyButton');
  const copyStatus = document.getElementById('copyStatus');
  let fullTextToCopy = '';

  // Query and display all tabs in the current window
  chrome.tabs.query({currentWindow: true}, function(tabs) {
    tabs.forEach(function(tab) {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = tab.url;
      link.textContent = tab.title || tab.url;
      link.target = "_blank";

      listItem.appendChild(link);
      tabListElement.appendChild(listItem);

      fullTextToCopy += `${tab.title || 'No Title'}\n${tab.url}\n\n`;
    });
    tabListTextElement.value = fullTextToCopy.trim();
  });

  // Copy to Clipboard
  copyButton.addEventListener('click', function() {
    tabListTextElement.select();
    try {
      document.execCommand('copy');
      copyStatus.style.display = 'block';
      copyButton.textContent = 'Copied!';
      setTimeout(() => {
        copyButton.textContent = 'Copy to Clipboard';
        copyStatus.style.display = 'none';
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      copyButton.textContent = 'Error Copying';
    }
    window.getSelection().removeAllRanges();
  });

  // --- Save to DB Feature (original Extension 2) ---
  saveBtn.addEventListener('click', async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const timestamp = new Date().toLocaleString();

    // Get existing data from storage
    chrome.storage.local.get(['tabDatabase'], (result) => {
      let db = result.tabDatabase || [];

      tabs.forEach(tab => {
        // Find if link already exists
        const existingIndex = db.findIndex(item => item.url === tab.url);

        if (existingIndex > -1) {
          // Update Repeat Logic
          db[existingIndex].repeatCount += 1;
          db[existingIndex].timestamps.push(timestamp);
          db[existingIndex].title = tab.title; // Update title if it changed
        } else {
          // New Entry
          db.push({
            id: Date.now() + Math.random(),
            title: tab.title,
            url: tab.url,
            repeatCount: 1,
            timestamps: [timestamp],
            notes: "",
            remarks: ""
          });
        }
      });

      // Save back to storage
      chrome.storage.local.set({ 'tabDatabase': db }, () => {
        statusMsg.style.display = 'block';
        setTimeout(() => { statusMsg.style.display = 'none'; }, 3000);
      });
    });
  });

  dashBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  storageLink.addEventListener('click', (e) => {
    e.preventDefault();
    alert("Data is stored locally in your browser's 'Extension Storage'. No data is sent to a server. You can export this to CSV, JSON, or HTML from the Dashboard.");
  });
});