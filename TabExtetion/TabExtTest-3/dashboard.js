let masterData = [];

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('searchInput').addEventListener('input', filterTable);
    document.getElementById('exportCsv').addEventListener('click', exportCSV);
    document.getElementById('exportJson').addEventListener('click', exportJSON);
    document.getElementById('exportHtml').addEventListener('click', exportHTML);
    document.getElementById('copyAll').addEventListener('click', copyToClipboard);
});

function loadData() {
    chrome.storage.local.get(['tabDatabase'], (result) => {
        masterData = result.tabDatabase || [];
        renderTable(masterData);
    });
}

function getRepeatIndicators(count) {
    let html = '';
    const stars = Math.floor(count / 5);
    const ticks = count % 5;

    // 5 repeats = 1 Red Star
    for (let i = 0; i < stars; i++) {
        html += '<span class="star-red">★</span>';
    }

    // Ticks: 1=R, 2=Y, 3=G, 4=B
    const tickColors = ['tick-r', 'tick-y', 'tick-g', 'tick-b'];
    for (let i = 0; i < ticks; i++) {
        if (i < 4) {
            html += `<span class="${tickColors[i]}">✔</span>`;
        }
    }
    return html;
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    data.forEach((item, index) => {
        const row = document.createElement('tr');
        const indicators = getRepeatIndicators(item.repeatCount);
        const lastTime = item.timestamps[item.timestamps.length - 1];

        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${indicators} <strong>${item.title}</strong></td>
            <td class="url-cell" title="${item.url}">${item.url}</td>
            <td>${lastTime}</td>
            <td>${item.repeatCount}</td>
            <td><input class="notes-input" data-id="${item.id}" value="${item.notes}" placeholder="Add note..."></td>
            <td>
                <button class="btn-open" onclick="window.open('${item.url}', '_blank')">Open</button>
                <button class="btn-del" data-id="${item.id}">Del</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    // Attach event listeners for dynamic elements
    document.querySelectorAll('.notes-input').forEach(input => {
        input.addEventListener('change', updateNote);
    });
    document.querySelectorAll('.btn-del').forEach(btn => {
        btn.addEventListener('click', deleteItem);
    });
}

function updateNote(e) {
    const id = parseFloat(e.target.dataset.id);
    const note = e.target.value;
    const item = masterData.find(i => i.id === id);
    if (item) {
        item.notes = note;
        saveToStorage();
    }
}

function deleteItem(e) {
    const id = parseFloat(e.target.dataset.id);
    masterData = masterData.filter(i => i.id !== id);
    saveToStorage();
    renderTable(masterData);
}

function saveToStorage() {
    chrome.storage.local.set({ 'tabDatabase': masterData });
}

function filterTable(e) {
    const query = e.target.value.toLowerCase();
    const filtered = masterData.filter(item => 
        item.title.toLowerCase().includes(query) || 
        item.url.toLowerCase().includes(query) || 
        item.notes.toLowerCase().includes(query)
    );
    renderTable(filtered);
}

// EXPORT FUNCTIONS
function exportCSV() {
    let csvContent = "data:text/csv;charset=utf-8,Serial,Title,URL,RepeatCount,LastTimestamp,Notes\n";
    masterData.forEach((item, index) => {
        const row = [
            index + 1,
            `"${item.title.replace(/"/g, '""')}"`,
            `"${item.url}"`,
            item.repeatCount,
            `"${item.timestamps[item.timestamps.length - 1]}"`,
            `"${item.notes.replace(/"/g, '""')}"`
        ].join(",");
        csvContent += row + "\n";
    });
    downloadFile(csvContent, "tab_database.csv");
}

function exportJSON() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(masterData, null, 2));
    downloadFile(dataStr, "tab_database.json");
}

function exportHTML() {
    let html = `<html><head><title>Tab Export</title><style>table{width:100%;border-collapse:collapse;}th,td{border:1px solid #ccc;padding:8px;}</style></head><body>`;
    html += `<h1>Saved Tab List</h1><table><tr><th>Title</th><th>URL</th><th>Repeats</th><th>Notes</th></tr>`;
    masterData.forEach(item => {
        html += `<tr><td>${item.title}</td><td><a href="${item.url}">${item.url}</a></td><td>${item.repeatCount}</td><td>${item.notes}</td></tr>`;
    });
    html += `</table></body></html>`;
    const dataStr = "data:text/html;charset=utf-8," + encodeURIComponent(html);
    downloadFile(dataStr, "tab_database.html");
}

function downloadFile(content, fileName) {
    const link = document.createElement("a");
    link.setAttribute("href", content);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function copyToClipboard() {
    const text = JSON.stringify(masterData, null, 2);
    navigator.clipboard.writeText(text).then(() => alert("All data copied to clipboard as JSON."));
}