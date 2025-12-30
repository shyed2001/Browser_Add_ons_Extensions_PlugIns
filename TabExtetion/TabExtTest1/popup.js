document.addEventListener('DOMContentLoaded', function() {
  const tabListElement = document.getElementById('tabList');
  const tabListTextElement = document.getElementById('tabListText');
  const copyButton = document.getElementById('copyButton');
  let fullTextToCopy = '';

  // Query for all tabs in the current window
  chrome.tabs.query({currentWindow: true}, function(tabs) {
    tabs.forEach(function(tab) {
      const listItem = document.createElement('li');
      const link = document.createElement('a');
      link.href = tab.url;
      link.textContent = tab.title || tab.url; // Display title, or URL if title is empty
      link.target = "_blank"; // Open link in new tab if clicked

      listItem.appendChild(link);
      tabListElement.appendChild(listItem);

      // Prepare text for the textarea and copying
      fullTextToCopy += `${tab.title || 'No Title'}\n${tab.url}\n\n`;
    });
    tabListTextElement.value = fullTextToCopy.trim();
  });

  copyButton.addEventListener('click', function() {
    tabListTextElement.select();
    try {
      document.execCommand('copy');
      copyButton.textContent = 'Copied!';
      setTimeout(() => { copyButton.textContent = 'Copy to Clipboard'; }, 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      copyButton.textContent = 'Error Copying';
    }
    window.getSelection().removeAllRanges(); // Deselect
  });
});