document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const shortenForm = document.getElementById('shorten-form');
  const urlInput = document.getElementById('url-input');
  const aliasInput = document.getElementById('alias-input');
  const advancedToggle = document.getElementById('advanced-toggle');
  const advancedContent = document.getElementById('advanced-content');
  const submitBtn = document.getElementById('submit-btn');
  const btnSpinner = document.getElementById('btn-spinner');
  
  const errorMessage = document.getElementById('error-message');
  const errorText = document.getElementById('error-text');
  
  const resultCard = document.getElementById('result-card');
  const resultUrl = document.getElementById('result-url');
  const copyBtn = document.getElementById('copy-btn');
  const checkIcon = copyBtn.querySelector('.check-icon');
  const copyIcon = copyBtn.querySelector('.copy-icon');
  const copyText = copyBtn.querySelector('.copy-text');
  const qrImage = document.getElementById('qr-image');
  const qrLoading = document.querySelector('.qr-loading');
  const metaOriginalUrl = document.getElementById('meta-original-url');
  const metaCode = document.getElementById('meta-code');
  const shortenAnotherBtn = document.getElementById('shorten-another-btn');
  
  const linksTbody = document.getElementById('links-tbody');
  const refreshBtn = document.getElementById('refresh-btn');
  const prevPageBtn = document.getElementById('prev-page-btn');
  const nextPageBtn = document.getElementById('next-page-btn');
  const paginationInfo = document.getElementById('pagination-info');

  // --- State Variables ---
  let currentPage = 1;
  const limitPerPage = 10;
  let totalPages = 1;

  // --- Event Listeners ---
  advancedToggle.addEventListener('click', toggleAdvanced);
  shortenForm.addEventListener('submit', handleShortenSubmit);
  copyBtn.addEventListener('click', handleCopyLink);
  shortenAnotherBtn.addEventListener('click', resetShortener);
  refreshBtn.addEventListener('click', () => fetchLinks(currentPage));
  prevPageBtn.addEventListener('click', () => changePage(-1));
  nextPageBtn.addEventListener('click', () => changePage(1));

  // Init
  fetchLinks(1);

  // --- Functions ---

  function toggleAdvanced() {
    advancedToggle.classList.toggle('active');
    advancedContent.classList.toggle('open');
  }

  function toggleLoading(isLoading) {
    if (isLoading) {
      submitBtn.disabled = true;
      btnSpinner.style.display = 'inline-block';
      submitBtn.querySelector('.btn-text').textContent = 'Shortening...';
      errorMessage.classList.add('hidden');
    } else {
      submitBtn.disabled = false;
      btnSpinner.style.display = 'none';
      submitBtn.querySelector('.btn-text').textContent = 'Shorten URL';
    }
  }

  async function handleShortenSubmit(e) {
    e.preventDefault();
    const destinationUrl = urlInput.value.trim();
    const customAlias = aliasInput.value.trim();

    if (!destinationUrl) return;

    toggleLoading(true);

    try {
      const payload = { url: destinationUrl };
      if (customAlias) {
        payload.customAlias = customAlias;
      }

      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to shorten URL');
      }

      showResult(result.data);
      fetchLinks(1); // Refresh history, go to page 1
    } catch (err) {
      showError(err.message);
    } finally {
      toggleLoading(false);
    }
  }

  function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');
    // Scroll error into view if needed
    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showResult(data) {
    resultUrl.value = data.shortUrl;
    metaOriginalUrl.href = data.originalUrl;
    metaOriginalUrl.textContent = data.originalUrl;
    metaCode.textContent = data.shortCode;

    // Load QR Code
    qrImage.style.display = 'none';
    qrLoading.style.display = 'flex';
    
    // Using standard free api.qrserver.com
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data.shortUrl)}`;
    
    qrImage.onload = () => {
      qrLoading.style.display = 'none';
      qrImage.style.display = 'block';
    };
    
    qrImage.onerror = () => {
      qrLoading.textContent = 'Failed QR';
    };
    
    qrImage.src = qrUrl;

    // Toggle Cards
    shortenForm.parentElement.classList.add('hidden');
    resultCard.classList.remove('hidden');
  }

  function resetShortener() {
    urlInput.value = '';
    aliasInput.value = '';
    resultCard.classList.add('hidden');
    shortenForm.parentElement.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    
    if (advancedToggle.classList.contains('active')) {
      toggleAdvanced();
    }
  }

  async function handleCopyLink() {
    const textToCopy = resultUrl.value;
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
      
      // Animate Copy Button
      copyIcon.classList.add('hidden');
      checkIcon.classList.remove('hidden');
      copyText.textContent = 'Copied!';
      copyBtn.classList.add('btn-primary');
      copyBtn.style.borderColor = 'var(--success)';

      setTimeout(() => {
        checkIcon.classList.add('hidden');
        copyIcon.classList.remove('hidden');
        copyText.textContent = 'Copy';
        copyBtn.classList.remove('btn-primary');
        copyBtn.style.borderColor = '';
      }, 2000);
    } catch (err) {
      console.error('Could not copy text: ', err);
    }
  }

  async function fetchLinks(page = 1) {
    // Show spinner in table
    linksTbody.innerHTML = `
      <tr class="table-state-row">
        <td colspan="5">
          <div class="table-spinner-wrapper">
            <span class="spinner"></span>
            <span class="loading-text">Fetching links from database...</span>
          </div>
        </td>
      </tr>
    `;

    try {
      const response = await fetch(`/api/urls?page=${page}&limit=${limitPerPage}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to fetch links');
      }

      currentPage = result.data.pagination.page;
      totalPages = result.data.pagination.totalPages;

      renderTable(result.data.urls);
      updatePaginationControls();
    } catch (err) {
      linksTbody.innerHTML = `
        <tr class="table-state-row">
          <td colspan="5" style="color: var(--error)">
            <div class="empty-state">
              <span class="empty-state-title">Error Loading Dashboard</span>
              <span>${err.message}</span>
            </div>
          </td>
        </tr>
      `;
    }
  }

  function renderTable(urls) {
    if (!urls || urls.length === 0) {
      linksTbody.innerHTML = `
        <tr class="table-state-row">
          <td colspan="5">
            <div class="empty-state">
              <span class="empty-state-title">No Links Found</span>
              <span>Shorten your first link to see it here!</span>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    linksTbody.innerHTML = '';
    urls.forEach(url => {
      const tr = document.createElement('tr');
      tr.id = `row-${url.shortCode}`;
      
      const createdDate = new Date(url.createdAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      tr.innerHTML = `
        <td>
          <div class="table-original-url" title="${url.originalUrl}">
            <a href="${url.originalUrl}" target="_blank">${url.originalUrl}</a>
          </div>
        </td>
        <td>
          <div class="table-short-url">
            <a href="${url.shortUrl}" target="_blank">${url.shortUrl}</a>
          </div>
        </td>
        <td>
          <span class="clicks-badge">${url.clickCount}</span>
        </td>
        <td>
          <span class="table-date">${createdDate}</span>
        </td>
        <td>
          <div class="table-actions">
            <button class="btn btn-icon-only btn-table-copy" data-url="${url.shortUrl}" title="Copy Link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 0.95rem; height: 0.95rem;">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <button class="btn-danger-link btn-table-delete" data-code="${url.shortCode}" title="Delete Link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span>Delete</span>
            </button>
          </div>
        </td>
      `;
      
      linksTbody.appendChild(tr);
    });

    // Add Copy event listeners to table rows
    linksTbody.querySelectorAll('.btn-table-copy').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const urlToCopy = btn.getAttribute('data-url');
        try {
          await navigator.clipboard.writeText(urlToCopy);
          // Simple hover tooltip animation using inline colors
          btn.style.color = 'var(--success)';
          btn.style.borderColor = 'var(--success-border)';
          setTimeout(() => {
            btn.style.color = '';
            btn.style.borderColor = '';
          }, 1500);
        } catch (err) {
          console.error(err);
        }
      });
    });

    // Add Delete event listeners to table rows
    linksTbody.querySelectorAll('.btn-table-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const code = btn.getAttribute('data-code');
        if (confirm(`Are you sure you want to delete the short code "${code}"?`)) {
          await deleteLink(code);
        }
      });
    });
  }

  async function deleteLink(code) {
    try {
      const response = await fetch(`/api/url/${code}`, { method: 'DELETE' });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete URL');
      }

      // Animate row removal
      const row = document.getElementById(`row-${code}`);
      if (row) {
        row.style.opacity = '0';
        row.style.transform = 'scale(0.95)';
        row.style.transition = 'all 0.3s ease';
        setTimeout(() => {
          fetchLinks(currentPage);
        }, 300);
      } else {
        fetchLinks(currentPage);
      }
    } catch (err) {
      alert(`Delete error: ${err.message}`);
    }
  }

  function changePage(direction) {
    const targetPage = currentPage + direction;
    if (targetPage >= 1 && targetPage <= totalPages) {
      fetchLinks(targetPage);
    }
  }

  function updatePaginationControls() {
    paginationInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
    prevPageBtn.disabled = currentPage <= 1;
    nextPageBtn.disabled = currentPage >= totalPages;
  }
});
