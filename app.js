/* ============================================
   Patel Dental Clinic — RVG Management System
   Application Logic
   ============================================ */

// ── State ──
const state = {
  currentStep: 1,
  imageFile: null,
  imageDataUrl: null,
  patientName: '',
  toothNumber: '',
  supabaseClient: null,
  isListening: false,
  currentRecognition: null,
};

// ── Supabase Init ──
function getSupabaseConfig() {
  return {
    url: localStorage.getItem('supabase_url') || '',
    key: localStorage.getItem('supabase_key') || '',
  };
}

function initSupabase() {
  const config = getSupabaseConfig();
  if (config.url && config.key) {
    try {
      state.supabaseClient = supabase.createClient(config.url, config.key);
      console.log('✅ Supabase connected');
      return true;
    } catch (err) {
      console.error('Supabase init error:', err);
      state.supabaseClient = null;
      return false;
    }
  }
  return false;
}

// ── DOM Elements ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Toast Notifications ──
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ── Loading Overlay ──
function showLoading(text = 'Saving record...') {
  $('#loading-text').textContent = text;
  $('#loading-overlay').classList.add('visible');
}

function hideLoading() {
  $('#loading-overlay').classList.remove('visible');
}

// ── Navigation Tabs ──
$$('.nav-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.view;
    $$('.nav-tab').forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.view-panel').forEach((p) => p.classList.remove('active'));
    $(`#view-${view}`).classList.add('active');

    if (view === 'search') {
      loadRecentRecords();
    }
  });
});

// ── Supabase Settings Modal ──
$('#btn-settings').addEventListener('click', () => {
  const config = getSupabaseConfig();
  $('#config-url').value = config.url;
  $('#config-key').value = config.key;
  $('#config-modal').classList.add('visible');
});

$('#btn-config-cancel').addEventListener('click', () => {
  $('#config-modal').classList.remove('visible');
});

$('#btn-config-save').addEventListener('click', () => {
  const url = $('#config-url').value.trim();
  const key = $('#config-key').value.trim();

  if (!url || !key) {
    showToast('Please enter both URL and Key', 'error');
    return;
  }

  localStorage.setItem('supabase_url', url);
  localStorage.setItem('supabase_key', key);

  if (initSupabase()) {
    showToast('Supabase connected successfully!', 'success');
    $('#config-modal').classList.remove('visible');
  } else {
    showToast('Failed to connect. Check your credentials.', 'error');
  }
});

// ── Step Navigation ──
function goToStep(step) {
  // Hide all step panels
  $$('.step-panel').forEach((p) => {
    p.classList.remove('active');
    p.style.display = '';
  });

  // Show target step
  const targetPanel = $(`#step-${step}`);
  if (targetPanel) {
    targetPanel.style.display = 'block';
    // Force reflow for animation
    void targetPanel.offsetHeight;
    targetPanel.classList.add('active');
  }

  // Update progress indicators
  $$('.step-indicator').forEach((indicator) => {
    const s = parseInt(indicator.dataset.step);
    indicator.classList.remove('active', 'completed');
    if (s === step) indicator.classList.add('active');
    else if (s < step) indicator.classList.add('completed');
  });

  // Update connectors
  $$('.step-connector').forEach((conn) => {
    const c = parseInt(conn.dataset.connector);
    conn.classList.remove('completed', 'active');
    if (c < step) conn.classList.add('completed');
    else if (c === step - 1) conn.classList.add('active');
  });

  state.currentStep = step;

  // If step 4, populate confirmation
  if (step === 4) populateConfirmation();
}

// ── STEP 1: Image Upload ──
const uploadArea = $('#upload-area');
const fileInput = $('#file-input');
const imagePreviewContainer = $('#image-preview-container');
const imagePreview = $('#image-preview');

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    handleImageUpload(file);
  } else {
    showToast('Please upload an image file', 'error');
  }
});

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) handleImageUpload(file);
});

function handleImageUpload(file) {
  state.imageFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    state.imageDataUrl = e.target.result;
    imagePreview.src = e.target.result;
    imagePreviewContainer.classList.add('visible');
    uploadArea.style.display = 'none';

    $('#file-name').textContent = file.name;
    $('#file-size').textContent = ` — ${(file.size / 1024).toFixed(1)} KB`;

    $('#btn-next-1').disabled = false;
    showToast('Image uploaded successfully', 'success');
  };
  reader.readAsDataURL(file);
}

$('#remove-image-btn').addEventListener('click', () => {
  state.imageFile = null;
  state.imageDataUrl = null;
  imagePreview.src = '';
  imagePreviewContainer.classList.remove('visible');
  uploadArea.style.display = '';
  fileInput.value = '';
  $('#btn-next-1').disabled = true;
});

$('#btn-next-1').addEventListener('click', () => {
  if (state.imageFile) goToStep(2);
});

// ── STEP 2: Patient Name — Voice Input ──
const micNameBtn = $('#mic-name');
const nameDisplay = $('#name-display');
const micNameStatus = $('#mic-name-status');

micNameBtn.addEventListener('click', () => {
  if (state.isListening) {
    stopListening();
  } else {
    startListening('name');
  }
});

// Manual input toggle
$('#manual-name-toggle').addEventListener('click', () => {
  $('#manual-name-wrapper').classList.toggle('visible');
});

$('#manual-name-apply').addEventListener('click', () => {
  const val = $('#manual-name-input').value.trim();
  if (val) {
    state.patientName = val;
    updateNameDisplay(val);
    showToast('Name applied', 'success');
  }
});

$('#manual-name-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    $('#manual-name-apply').click();
  }
});

function updateNameDisplay(name) {
  nameDisplay.innerHTML = name;
  nameDisplay.classList.add('has-value');
  state.patientName = name;
  $('#btn-next-2').disabled = false;
}

$('#btn-back-2').addEventListener('click', () => goToStep(1));
$('#btn-next-2').addEventListener('click', () => {
  if (state.patientName) goToStep(3);
});

// ── STEP 3: Tooth Number — Voice Input ──
const micToothBtn = $('#mic-tooth');
const toothDisplay = $('#tooth-display');
const micToothStatus = $('#mic-tooth-status');

micToothBtn.addEventListener('click', () => {
  if (state.isListening) {
    stopListening();
  } else {
    startListening('tooth');
  }
});

// Manual input toggle
$('#manual-tooth-toggle').addEventListener('click', () => {
  $('#manual-tooth-wrapper').classList.toggle('visible');
});

$('#manual-tooth-apply').addEventListener('click', () => {
  const val = $('#manual-tooth-input').value.trim();
  if (val) {
    state.toothNumber = val;
    updateToothDisplay(val);
    showToast('Tooth number applied', 'success');
  }
});

$('#manual-tooth-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    $('#manual-tooth-apply').click();
  }
});

function updateToothDisplay(tooth) {
  toothDisplay.innerHTML = tooth;
  toothDisplay.classList.add('has-value');
  state.toothNumber = tooth;
  $('#btn-next-3').disabled = false;

  // Highlight in tooth chart
  $$('.tooth-num').forEach((tn) => tn.classList.remove('selected'));
  const toothEl = document.querySelector(`.tooth-num[data-tooth="${tooth}"]`);
  if (toothEl) toothEl.classList.add('selected');
}

// Tooth chart click
$$('.tooth-num').forEach((tn) => {
  tn.addEventListener('click', () => {
    const num = tn.dataset.tooth;
    state.toothNumber = num;
    updateToothDisplay(num);
    showToast(`Tooth ${num} selected`, 'info');
  });
});

$('#btn-back-3').addEventListener('click', () => goToStep(2));
$('#btn-next-3').addEventListener('click', () => {
  if (state.toothNumber) goToStep(4);
});

// ── Speech Recognition ──
function startListening(mode) {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showToast('Speech recognition not supported. Please type manually.', 'error');
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  state.currentRecognition = recognition;
  state.isListening = true;

  const micBtn = mode === 'name' ? micNameBtn : micToothBtn;
  const statusEl = mode === 'name' ? micNameStatus : micToothStatus;
  const displayEl = mode === 'name' ? nameDisplay : toothDisplay;

  micBtn.classList.add('listening');
  statusEl.textContent = 'Listening...';
  statusEl.classList.add('listening');

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
    }
    transcript = transcript.trim();

    if (mode === 'name') {
      // Capitalize first letters
      transcript = transcript
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
      displayEl.innerHTML = transcript;
      displayEl.classList.add('has-value');
      state.patientName = transcript;
      $('#btn-next-2').disabled = !transcript;
    } else {
      // Extract numbers from speech
      const extracted = extractToothNumber(transcript);
      displayEl.innerHTML = extracted || transcript;
      displayEl.classList.add('has-value');
      state.toothNumber = extracted || transcript;
      $('#btn-next-3').disabled = !(extracted || transcript);

      // Highlight tooth chart
      if (extracted) {
        $$('.tooth-num').forEach((tn) => tn.classList.remove('selected'));
        const toothEl = document.querySelector(
          `.tooth-num[data-tooth="${extracted}"]`
        );
        if (toothEl) toothEl.classList.add('selected');
      }
    }
  };

  recognition.onend = () => {
    micBtn.classList.remove('listening');
    statusEl.textContent = 'Tap to speak again';
    statusEl.classList.remove('listening');
    state.isListening = false;
    state.currentRecognition = null;

    if (mode === 'name' && state.patientName) {
      showToast(`Name captured: ${state.patientName}`, 'success');
    } else if (mode === 'tooth' && state.toothNumber) {
      showToast(`Tooth number captured: ${state.toothNumber}`, 'success');
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    micBtn.classList.remove('listening');
    statusEl.textContent = 'Tap to try again';
    statusEl.classList.remove('listening');
    state.isListening = false;
    state.currentRecognition = null;

    if (event.error === 'no-speech') {
      showToast('No speech detected. Please try again.', 'error');
    } else if (event.error === 'not-allowed') {
      showToast('Microphone access denied. Please allow microphone permission.', 'error');
    } else {
      showToast(`Speech error: ${event.error}. Try typing manually.`, 'error');
    }
  };

  recognition.start();
}

function stopListening() {
  if (state.currentRecognition) {
    state.currentRecognition.stop();
    state.isListening = false;
  }
}

// Extract tooth number from spoken text
function extractToothNumber(text) {
  // Number words to digits
  const wordToNum = {
    zero: '0', one: '1', two: '2', three: '3', four: '4',
    five: '5', six: '6', seven: '7', eight: '8', nine: '9',
    ten: '10', eleven: '11', twelve: '12', thirteen: '13',
    fourteen: '14', fifteen: '15', sixteen: '16', seventeen: '17',
    eighteen: '18', nineteen: '19', twenty: '20',
    'twenty one': '21', 'twenty two': '22', 'twenty three': '23',
    'twenty four': '24', 'twenty five': '25', 'twenty six': '26',
    'twenty seven': '27', 'twenty eight': '28',
    'thirty one': '31', 'thirty two': '32', 'thirty three': '33',
    'thirty four': '34', 'thirty five': '35', 'thirty six': '36',
    'thirty seven': '37', 'thirty eight': '38',
    'forty one': '41', 'forty two': '42', 'forty three': '43',
    'forty four': '44', 'forty five': '45', 'forty six': '46',
    'forty seven': '47', 'forty eight': '48',
  };

  let lower = text.toLowerCase().trim();

  // Check word matches first
  for (const [word, num] of Object.entries(wordToNum)) {
    if (lower.includes(word)) {
      return num;
    }
  }

  // Extract numeric digits
  const nums = text.replace(/[^0-9]/g, '');
  if (nums.length >= 2) {
    return nums.substring(0, 2);
  }
  if (nums.length === 1) {
    return nums;
  }

  return text;
}

// ── STEP 4: Confirmation ──
function populateConfirmation() {
  $('#confirm-image').src = state.imageDataUrl;
  $('#confirm-name').textContent = state.patientName;
  $('#confirm-tooth').textContent = state.toothNumber;
  $('#confirm-datetime').textContent = new Date().toLocaleString('en-IN', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

$('#btn-back-4').addEventListener('click', () => goToStep(3));

// ── Save Record ──
$('#btn-save').addEventListener('click', saveRecord);

async function saveRecord() {
  if (!state.supabaseClient) {
    showToast('Please configure Supabase first (⚙️ button)', 'error');
    return;
  }

  showLoading('Saving record...');

  try {
    // 1. Generate Patient ID
    const patientId = await generatePatientId();

    // 2. Upload image to Supabase Storage
    const fileExt = state.imageFile.name.split('.').pop();
    const filePath = `${patientId}.${fileExt}`;

    showLoading('Uploading RVG image...');

    const { data: uploadData, error: uploadError } =
      await state.supabaseClient.storage
        .from('rvg-images')
        .upload(filePath, state.imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

    if (uploadError) {
      throw new Error(`Image upload failed: ${uploadError.message}`);
    }

    // 3. Get public URL
    const { data: urlData } = state.supabaseClient.storage
      .from('rvg-images')
      .getPublicUrl(filePath);

    const imageUrl = urlData.publicUrl;

    // 4. Insert record into database
    showLoading('Saving patient record...');

    const { data: insertData, error: insertError } =
      await state.supabaseClient.from('patients').insert([
        {
          patient_id: patientId,
          patient_name: state.patientName,
          tooth_number: state.toothNumber,
          image_url: imageUrl,
          image_path: filePath,
        },
      ]).select();

    if (insertError) {
      throw new Error(`Record save failed: ${insertError.message}`);
    }

    hideLoading();

    // 5. Show success
    showSuccess(patientId);
    showToast('Record saved successfully!', 'success');
  } catch (err) {
    hideLoading();
    console.error('Save error:', err);
    showToast(err.message || 'Failed to save record', 'error');
  }
}

async function generatePatientId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const dateStr = `${yy}${mm}${dd}`;

  try {
    // Get next sequence value from Supabase
    const { data, error } = await state.supabaseClient.rpc(
      'get_next_patient_seq'
    );

    if (error) throw error;

    const seq = String(data).padStart(4, '0');
    return `PDC-${dateStr}-${seq}`;
  } catch (err) {
    // Fallback: use timestamp-based ID
    console.warn('Sequence error, using fallback:', err);
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    return `PDC-${dateStr}-${seq}`;
  }
}

function showSuccess(patientId) {
  // Hide all step panels
  $$('.step-panel').forEach((p) => {
    p.classList.remove('active');
    p.style.display = 'none';
  });

  // Show success
  const successPanel = $('#step-success');
  successPanel.style.display = 'block';
  void successPanel.offsetHeight;
  successPanel.classList.add('active');

  $('#generated-patient-id').textContent = patientId;

  // Update progress - all completed
  $$('.step-indicator').forEach((i) => {
    i.classList.remove('active');
    i.classList.add('completed');
  });
  $$('.step-connector').forEach((c) => c.classList.add('completed'));
}

// Success actions
$('#btn-copy-id').addEventListener('click', () => {
  const id = $('#generated-patient-id').textContent;
  navigator.clipboard
    .writeText(id)
    .then(() => showToast('Patient ID copied to clipboard!', 'success'))
    .catch(() => showToast('Failed to copy', 'error'));
});

$('#btn-print-record').addEventListener('click', () => {
  window.print();
});

$('#btn-new-record').addEventListener('click', resetWizard);

function resetWizard() {
  // Reset state
  state.imageFile = null;
  state.imageDataUrl = null;
  state.patientName = '';
  state.toothNumber = '';
  state.currentStep = 1;

  // Reset UI
  imagePreview.src = '';
  imagePreviewContainer.classList.remove('visible');
  uploadArea.style.display = '';
  fileInput.value = '';
  $('#btn-next-1').disabled = true;

  nameDisplay.innerHTML = '<span class="placeholder">Patient name will appear here...</span>';
  nameDisplay.classList.remove('has-value');
  $('#btn-next-2').disabled = true;
  $('#manual-name-input').value = '';
  $('#manual-name-wrapper').classList.remove('visible');

  toothDisplay.innerHTML = '<span class="placeholder">Tooth number will appear here...</span>';
  toothDisplay.classList.remove('has-value');
  $('#btn-next-3').disabled = true;
  $('#manual-tooth-input').value = '';
  $('#manual-tooth-wrapper').classList.remove('visible');
  $$('.tooth-num').forEach((tn) => tn.classList.remove('selected'));

  // Reset step indicators
  $$('.step-indicator').forEach((i) => {
    i.classList.remove('active', 'completed');
  });
  $$('.step-connector').forEach((c) => {
    c.classList.remove('active', 'completed');
  });

  // Show step 1
  $$('.step-panel').forEach((p) => {
    p.classList.remove('active');
    p.style.display = '';
  });
  goToStep(1);
}

// ── Search ──
$('#btn-search').addEventListener('click', searchPatient);
$('#search-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchPatient();
});

async function searchPatient() {
  const query = $('#search-input').value.trim().toUpperCase();

  if (!query) {
    showToast('Please enter a Patient ID', 'error');
    return;
  }

  if (!state.supabaseClient) {
    showToast('Please configure Supabase first (⚙️ button)', 'error');
    return;
  }

  // Hide previous results
  $('#search-result').classList.remove('visible');
  $('#no-result').classList.remove('visible');

  try {
    const { data, error } = await state.supabaseClient
      .from('patients')
      .select('*')
      .eq('patient_id', query)
      .single();

    if (error || !data) {
      $('#no-result').classList.add('visible');
      return;
    }

    displaySearchResult(data);
  } catch (err) {
    console.error('Search error:', err);
    showToast('Search failed. Please try again.', 'error');
  }
}

function displaySearchResult(record) {
  $('#result-id-badge').textContent = record.patient_id;
  $('#result-image').src = record.image_url;
  $('#result-name').textContent = record.patient_name;
  $('#result-tooth').textContent = record.tooth_number;
  $('#result-patient-id').textContent = record.patient_id;
  $('#result-datetime').textContent = new Date(record.created_at).toLocaleString(
    'en-IN',
    { dateStyle: 'full', timeStyle: 'short' }
  );

  $('#search-result').classList.add('visible');
  $('#no-result').classList.remove('visible');
}

$('#btn-print-result').addEventListener('click', () => window.print());

// ── Recent Records ──
async function loadRecentRecords() {
  if (!state.supabaseClient) {
    $('#records-list').innerHTML =
      '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:1rem;">Configure Supabase to view records</p>';
    return;
  }

  try {
    const { data, error } = await state.supabaseClient
      .from('patients')
      .select('patient_id, patient_name, tooth_number, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    const list = $('#records-list');

    if (!data || data.length === 0) {
      list.innerHTML =
        '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:1rem;">No records yet</p>';
      return;
    }

    list.innerHTML = data
      .map((r) => {
        const initials = r.patient_name
          .split(' ')
          .map((w) => w[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        const date = new Date(r.created_at).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: '2-digit',
        });
        return `
          <div class="record-item" data-pid="${r.patient_id}">
            <div class="record-item-left">
              <div class="record-item-avatar">${initials}</div>
              <div class="record-item-info">
                <div class="name">${r.patient_name}</div>
                <div class="id">${r.patient_id}</div>
              </div>
            </div>
            <div class="record-item-right">
              <div class="tooth">Tooth ${r.tooth_number}</div>
              <div class="date">${date}</div>
            </div>
          </div>
        `;
      })
      .join('');

    // Click to view record
    list.querySelectorAll('.record-item').forEach((item) => {
      item.addEventListener('click', () => {
        $('#search-input').value = item.dataset.pid;
        searchPatient();
      });
    });
  } catch (err) {
    console.error('Load recent error:', err);
    $('#records-list').innerHTML =
      '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:1rem;">Failed to load records</p>';
  }
}

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  const connected = initSupabase();

  if (!connected) {
    // Show config modal on first visit
    const config = getSupabaseConfig();
    if (!config.url || !config.key) {
      $('#config-modal').classList.add('visible');
    }
  }

  // Start at step 1
  goToStep(1);
});
