document.addEventListener('DOMContentLoaded', function() {
  const saveBtn = document.getElementById('saveAllBtn');
  const dashBtn = document.getElementById('openDashboard');
  const statusMsg = document.getElementById('statusMsg');
  const storageLink = document.getElementById('viewStoragePlace');

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