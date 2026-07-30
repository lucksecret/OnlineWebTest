// --- Default Configuration (With LaTeX & Complex MC Samples) ---
const DEFAULT_CONFIG = {
  adminPassword: "admin123",
  title: "Online Examination",
  timeLimitMinutes: 5,
  questions: [
    {
      type: "single", // Pilihan Ganda Biasa
      question: "Berapakah hasil dari pecahan berikut $\\int_0^2 x^2 \\, dx$ ?",
      image: "",
      options: [
        { text: "$\\frac{8}{3}$", image: "" },
        { text: "$\\frac{4}{3}$", image: "" },
        { text: "$2$", image: "" },
        { text: "$4$", image: "" }
      ],
      answer: 0 // Index tunggal
    },
    {
      type: "multiple", // Pilihan Ganda Kompleks
      question: "Manakah dari persamaan berikut yang memiliki akar real? (Pilih semua yang benar)",
      image: "",
      options: [
        { text: "$x^2 - 4 = 0$", image: "" },
        { text: "$x^2 + 4 = 0$", image: "" },
        { text: "$x^2 - 5x + 6 = 0$", image: "" },
        { text: "$x^2 + x + 1 = 0$", image: "" }
      ],
      answer: [0, 2] // Array index kunci jawaban
    }
  ]
};

// --- Load Saved Data ---
let config = JSON.parse(localStorage.getItem("quiz_config")) || DEFAULT_CONFIG;
let submissions = JSON.parse(localStorage.getItem("quiz_submissions")) || [];

// --- State Variables ---
let sessionQuestions = [];
let currentQuestionIndex = 0;
let score = 0;
let selectedOptions = []; // Array to store 1 or more choices
let timer;
let timeLeft = config.timeLimitMinutes * 60;

// Anti-Cheat & Student State
let isQuizActive = false;
let warningCount = 0;
const MAX_WARNINGS = 3;

let studentInfo = { name: "", id: "" };
let userAnswers = [];

// Admin State
let adminCurrentType = "single";
let adminCurrentOptions = [
  { text: "", image: "" },
  { text: "", image: "" }
];
let adminQuestionImage = "";
let editingIndex = null;

// --- DOM Elements ---
const startScreen = document.getElementById("start-screen");
const quizScreen = document.getElementById("quiz-screen");
const resultScreen = document.getElementById("result-screen");
const adminScreen = document.getElementById("admin-screen");

const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const restartBtn = document.getElementById("restart-btn");
const adminLoginBtn = document.getElementById("admin-login-btn");
const closeAdminBtn = document.getElementById("close-admin-btn");
const addQBtn = document.getElementById("add-q-btn");
const cancelEditBtn = document.getElementById("cancel-edit-btn");
const saveSettingsBtn = document.getElementById("save-settings-btn");
const exportJsonBtn = document.getElementById("export-json-btn");

const warningBadge = document.getElementById("warning-badge");
const warningCountEl = document.getElementById("warning-count");
const warningModal = document.getElementById("warning-modal");
const closeWarningBtn = document.getElementById("close-warning-btn");
const modalWarningMsg = document.getElementById("modal-warning-msg");

const appTitle = document.getElementById("app-title");
const questionText = document.getElementById("question-text");
const questionImageContainer = document.getElementById("question-image-container");
const optionsContainer = document.getElementById("options-container");
const questionNumber = document.getElementById("question-number");
const questionTypeTag = document.getElementById("question-type-tag");
const progressBar = document.getElementById("progress");
const timeDisplay = document.getElementById("time");

const newQTypeSelect = document.getElementById("new-q-type");
const dynamicOptionsList = document.getElementById("dynamic-options-list");
const addOptionFieldBtn = document.getElementById("add-option-field-btn");
const newQImgInput = document.getElementById("new-q-img");
const previewQImg = document.getElementById("preview-q-img");

// Admin Tabs & Results
const tabBtnSettings = document.getElementById("tab-btn-settings");
const tabBtnResults = document.getElementById("tab-btn-results");
const tabContentSettings = document.getElementById("admin-tab-settings");
const tabContentResults = document.getElementById("admin-tab-results");
const resultsTableBody = document.getElementById("results-table-body");
const exportCsvBtn = document.getElementById("export-csv-btn");
const clearResultsBtn = document.getElementById("clear-results-btn");
const searchInput = document.getElementById("search-student-input");

const detailModal = document.getElementById("detail-modal");
const closeDetailBtn = document.getElementById("close-detail-btn");

// --- Helper Functions ---

// Render LaTeX Formulas using KaTeX
function renderMath() {
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });
  }
}

// Fisher-Yates Shuffle
function shuffleArray(array) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  let sA = [...a].sort();
  let sB = [...b].sort();
  return sA.every((val, index) => val === sB[index]);
}

function applyConfigUI() {
  appTitle.textContent = config.title;
  document.getElementById("setting-title").value = config.title;
  document.getElementById("setting-time").value = config.timeLimitMinutes;
  
  let mins = config.timeLimitMinutes.toString().padStart(2, '0');
  timeDisplay.textContent = `${mins}:00`;
  setTimeout(renderMath, 100);
}
applyConfigUI();

// --- TEST EXECUTION & SHUFFLING ---
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", handleNextQuestion);
restartBtn.addEventListener("click", restartQuiz);

function prepareRandomizedQuiz() {
  let shuffledQuestions = shuffleArray(config.questions);

  sessionQuestions = shuffledQuestions.map(q => {
    let qType = q.type || "single";
    let isCorrectCheck = (idx) => {
      if (qType === "multiple") {
        return Array.isArray(q.answer) && q.answer.includes(idx);
      }
      return idx === q.answer;
    };

    let optionsMapped = q.options.map((opt, idx) => ({
      ...opt,
      isCorrect: isCorrectCheck(idx)
    }));

    let shuffledOptions = shuffleArray(optionsMapped);

    let newCorrectAnswer;
    if (qType === "multiple") {
      newCorrectAnswer = shuffledOptions
        .map((o, i) => o.isCorrect ? i : null)
        .filter(i => i !== null);
    } else {
      newCorrectAnswer = shuffledOptions.findIndex(o => o.isCorrect);
    }

    return {
      type: qType,
      question: q.question,
      image: q.image,
      options: shuffledOptions,
      answer: newCorrectAnswer
    };
  });
}

function startQuiz() {
  const nameInput = document.getElementById("student-name").value.trim();
  const idInput = document.getElementById("student-id").value.trim();

  if (!nameInput || !idInput) {
    alert("Harap isi Nama Lengkap dan NIM/Kelas terlebih dahulu!");
    return;
  }

  if (config.questions.length === 0) {
    alert("Belum ada soal! Silakan tambah soal di Admin panel.");
    return;
  }

  prepareRandomizedQuiz();
  
  studentInfo = { name: nameInput, id: idInput };
  userAnswers = [];
  currentQuestionIndex = 0;
  score = 0;
  
  isQuizActive = true;
  warningCount = 0;
  warningCountEl.textContent = warningCount;
  warningBadge.classList.remove("hidden");

  startScreen.classList.remove("active");
  quizScreen.classList.add("active");
  
  timeLeft = config.timeLimitMinutes * 60;
  startTimer();
  loadQuestion();
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    let minutes = Math.floor(timeLeft / 60);
    let seconds = timeLeft % 60;
    timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (timeLeft <= 0) {
      clearInterval(timer);
      endQuiz("Waktu Habis!");
    }
  }, 1000);
}

function loadQuestion() {
  selectedOptions = [];
  nextBtn.disabled = true;

  const q = sessionQuestions[currentQuestionIndex];
  questionNumber.textContent = `Soal ${currentQuestionIndex + 1} dari ${sessionQuestions.length}`;
  progressBar.style.width = `${((currentQuestionIndex + 1) / sessionQuestions.length) * 100}%`;
  questionText.textContent = q.question;

  if (q.type === "multiple") {
    questionTypeTag.textContent = "Pilihan Ganda Kompleks (Centang >1)";
    questionTypeTag.className = "type-tag complex";
  } else {
    questionTypeTag.textContent = "Pilihan Ganda";
    questionTypeTag.className = "type-tag";
  }

  if (q.image) {
    questionImageContainer.innerHTML = `<img src="${q.image}" alt="Gambar Soal">`;
    questionImageContainer.classList.remove("hidden");
  } else {
    questionImageContainer.innerHTML = "";
    questionImageContainer.classList.add("hidden");
  }

  optionsContainer.innerHTML = "";
  q.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.classList.add("option-btn");
    
    let iconHtml = (q.type === "multiple") ? '<span class="option-checkbox-icon">✓</span>' : '';
    let optImgHtml = option.image ? `<img src="${option.image}" class="option-img" alt="Pilihan">` : '';
    button.innerHTML = `${iconHtml}${optImgHtml} <span>${option.text}</span>`;

    button.addEventListener("click", () => selectOption(index, button, q.type));
    optionsContainer.appendChild(button);
  });

  setTimeout(renderMath, 50);
}

function selectOption(index, buttonElement, type) {
  if (type === "multiple") {
    // Toggle in array
    if (selectedOptions.includes(index)) {
      selectedOptions = selectedOptions.filter(i => i !== index);
      buttonElement.classList.remove("selected");
    } else {
      selectedOptions.push(index);
      buttonElement.classList.add("selected");
    }
  } else {
    // Single Choice
    selectedOptions = [index];
    document.querySelectorAll(".option-btn").forEach(btn => btn.classList.remove("selected"));
    buttonElement.classList.add("selected");
  }

  nextBtn.disabled = (selectedOptions.length === 0);
}

function handleNextQuestion() {
  const q = sessionQuestions[currentQuestionIndex];
  let isCorrect = false;

  if (q.type === "multiple") {
    isCorrect = arraysEqual(selectedOptions, q.answer);
  } else {
    isCorrect = (selectedOptions[0] === q.answer);
  }

  if (isCorrect) score++;

  userAnswers.push({
    type: q.type,
    questionText: q.question,
    questionImage: q.image,
    options: q.options,
    selectedOptions: [...selectedOptions],
    correctOption: q.answer,
    isCorrect: isCorrect
  });

  currentQuestionIndex++;
  if (currentQuestionIndex < sessionQuestions.length) {
    loadQuestion();
  } else {
    endQuiz("Ujian Selesai!");
  }
}

function endQuiz(reasonMessage = "Berikut adalah nilai akhir Anda:") {
  isQuizActive = false;
  clearInterval(timer);

  const submissionData = {
    timestamp: new Date().toLocaleString("id-ID"),
    studentName: studentInfo.name,
    studentId: studentInfo.id,
    score: score,
    totalQuestions: sessionQuestions.length,
    percentage: Math.round((score / sessionQuestions.length) * 100),
    warnings: warningCount,
    userAnswers: userAnswers
  };

  submissions.push(submissionData);
  localStorage.setItem("quiz_submissions", JSON.stringify(submissions));

  quizScreen.classList.remove("active");
  resultScreen.classList.add("active");
  warningBadge.classList.add("hidden");

  document.getElementById("finish-reason-text").textContent = reasonMessage;
  document.getElementById("final-score").textContent = score;
  document.getElementById("total-score").textContent = sessionQuestions.length;
  document.getElementById("score-percentage").textContent = `Skor Anda: ${submissionData.percentage}%`;
}

function restartQuiz() {
  resultScreen.classList.remove("active");
  startScreen.classList.add("active");
  document.getElementById("student-name").value = "";
  document.getElementById("student-id").value = "";
}

// --- ANTI-CHEAT DETECTION ---
document.addEventListener("visibilitychange", () => {
  if (!isQuizActive) return;

  if (document.hidden) {
    warningCount++;
    warningCountEl.textContent = warningCount;

    if (warningCount >= MAX_WARNINGS) {
      endQuiz("Ujian dihentikan secara otomatis karena Anda melanggar aturan berpindah tab sebanyak 3 kali!");
      alert("❌ UJIAN DIHENTIKAN! Anda telah berpindah tab sebanyak 3 kali.");
    } else {
      modalWarningMsg.textContent = `DILARANG BERPINDAH TAB! Peringatan (${warningCount}/${MAX_WARNINGS}). Jika mencapai ${MAX_WARNINGS} kali, ujian Anda akan otomatis dihentikan!`;
      warningModal.classList.remove("hidden");
    }
  }
});

closeWarningBtn.addEventListener("click", () => {
  warningModal.classList.add("hidden");
});

// --- ADMIN PANEL FUNCTIONS ---

adminLoginBtn.addEventListener("click", () => {
  const pass = prompt("Masukkan Password Admin:");
  if (pass === config.adminPassword) {
    openAdminPanel();
  } else if (pass !== null) {
    alert("Password Salah!");
  }
});

closeAdminBtn.addEventListener("click", () => {
  adminScreen.classList.remove("active");
  startScreen.classList.add("active");
  resetForm();
});

function openAdminPanel() {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  adminScreen.classList.add("active");
  renderAdminOptionsInputs();
  renderQuestionsList();
  renderResultsTable();
  setTimeout(renderMath, 100);
}

newQTypeSelect.addEventListener("change", (e) => {
  adminCurrentType = e.target.value;
  renderAdminOptionsInputs();
});

function renderAdminOptionsInputs(selectedCorrect = null) {
  dynamicOptionsList.innerHTML = "";
  const isMultiple = (adminCurrentType === "multiple");

  adminCurrentOptions.forEach((opt, idx) => {
    const row = document.createElement("div");
    row.className = "dynamic-option-row";
    
    let isChecked = false;
    if (isMultiple && Array.isArray(selectedCorrect)) {
      isChecked = selectedCorrect.includes(idx);
    } else if (!isMultiple) {
      isChecked = (idx === (selectedCorrect !== null ? selectedCorrect : 0));
    }

    let inputType = isMultiple ? 'checkbox' : 'radio';
    let inputName = isMultiple ? `admin-correct-opt-${idx}` : 'admin-correct-opt';
    let imgPreview = opt.image ? `<img src="${opt.image}" class="option-img" alt="Pilihan">` : '';

    row.innerHTML = `
      <input type="${inputType}" name="${inputName}" class="admin-opt-check" value="${idx}" ${isChecked ? 'checked' : ''} title="Tandai sebagai kunci jawaban benar">
      <input type="text" value="${opt.text}" placeholder="Teks Pilihan ${idx + 1} (Gunakan $...$ untuk LaTeX)" oninput="updateAdminOptText(${idx}, this.value)">
      <input type="file" accept="image/*" onchange="uploadAdminOptImg(${idx}, this)" style="width: 130px; font-size:0.75rem;">
      ${imgPreview}
      ${adminCurrentOptions.length > 2 ? `<button type="button" class="btn-sm danger" onclick="removeAdminOption(${idx})">✕</button>` : ''}
    `;
    dynamicOptionsList.appendChild(row);
  });
  
  setTimeout(renderMath, 50);
}

window.updateAdminOptText = function(index, text) {
  adminCurrentOptions[index].text = text;
};

window.uploadAdminOptImg = async function(index, inputElement) {
  if (inputElement.files && inputElement.files[0]) {
    adminCurrentOptions[index].image = await fileToBase64(inputElement.files[0]);
    renderAdminOptionsInputs(getSelectedCorrectIndex());
  }
};

window.removeAdminOption = function(index) {
  adminCurrentOptions.splice(index, 1);
  renderAdminOptionsInputs();
};

addOptionFieldBtn.addEventListener("click", () => {
  adminCurrentOptions.push({ text: "", image: "" });
  renderAdminOptionsInputs(getSelectedCorrectIndex());
});

function getSelectedCorrectIndex() {
  const isMultiple = (adminCurrentType === "multiple");
  const checks = document.querySelectorAll(".admin-opt-check");
  
  if (isMultiple) {
    let selected = [];
    checks.forEach((c, idx) => {
      if (c.checked) selected.push(idx);
    });
    return selected;
  } else {
    for (let i = 0; i < checks.length; i++) {
      if (checks[i].checked) return i;
    }
    return 0;
  }
}

newQImgInput.addEventListener("change", async (e) => {
  if (e.target.files && e.target.files[0]) {
    adminQuestionImage = await fileToBase64(e.target.files[0]);
    previewQImg.innerHTML = `<img src="${adminQuestionImage}" alt="Preview Soal">`;
  }
});

addQBtn.addEventListener("click", () => {
  const qText = document.getElementById("new-q-text").value.trim();
  const correctVal = getSelectedCorrectIndex();

  if (!qText) {
    alert("Harap isi pertanyaan terlebih dahulu!");
    return;
  }

  if (adminCurrentType === "multiple" && (!Array.isArray(correctVal) || correctVal.length === 0)) {
    alert("Untuk Pilihan Ganda Kompleks, pilih minimal 1 kunci jawaban benar!");
    return;
  }

  const newQuestionData = {
    type: adminCurrentType,
    question: qText,
    image: adminQuestionImage,
    options: [...adminCurrentOptions],
    answer: correctVal
  };

  if (editingIndex !== null) {
    config.questions[editingIndex] = newQuestionData;
    alert("Soal berhasil diperbarui!");
  } else {
    config.questions.push(newQuestionData);
  }

  resetForm();
  renderQuestionsList();
});

window.editQuestion = function(index) {
  editingIndex = index;
  const q = config.questions[index];

  adminCurrentType = q.type || "single";
  newQTypeSelect.value = adminCurrentType;

  document.getElementById("form-q-heading").textContent = `2. Edit Soal #${index + 1}`;
  document.getElementById("new-q-text").value = q.question;
  
  adminQuestionImage = q.image || "";
  previewQImg.innerHTML = adminQuestionImage ? `<img src="${adminQuestionImage}" alt="Preview">` : "";

  adminCurrentOptions = JSON.parse(JSON.stringify(q.options));
  renderAdminOptionsInputs(q.answer);

  addQBtn.textContent = "Simpan Perubahan Soal";
  addQBtn.classList.remove("success");
  addQBtn.classList.add("warning");
  cancelEditBtn.classList.remove("hidden");
};

cancelEditBtn.addEventListener("click", resetForm);

function resetForm() {
  editingIndex = null;
  adminCurrentType = "single";
  newQTypeSelect.value = "single";
  adminQuestionImage = "";
  previewQImg.innerHTML = "";
  newQImgInput.value = "";
  document.getElementById("form-q-heading").textContent = "2. Tambah Soal Baru";
  document.getElementById("new-q-text").value = "";

  adminCurrentOptions = [
    { text: "", image: "" },
    { text: "", image: "" }
  ];
  renderAdminOptionsInputs(0);

  addQBtn.textContent = "+ Tambah Soal";
  addQBtn.classList.remove("warning");
  addQBtn.classList.add("success");
  cancelEditBtn.classList.add("hidden");
}

window.deleteQuestion = function(index) {
  if (confirm("Apakah Anda yakin ingin menghapus soal ini?")) {
    config.questions.splice(index, 1);
    if (editingIndex === index) resetForm();
    renderQuestionsList();
  }
};

function renderQuestionsList() {
  const list = document.getElementById("questions-list");
  document.getElementById("q-count-label").textContent = config.questions.length;
  list.innerHTML = "";

  config.questions.forEach((q, idx) => {
    const li = document.createElement("li");
    li.className = "q-item";
    let typeLabel = (q.type === "multiple") ? '[Kompleks]' : '[Biasa]';
    li.innerHTML = `
      <span><strong>Q${idx + 1} ${typeLabel}:</strong> ${q.question}</span>
      <div class="q-actions">
        <button class="btn-sm warning" onclick="editQuestion(${idx})">Edit</button>
        <button class="btn-sm danger" onclick="deleteQuestion(${idx})">Hapus</button>
      </div>
    `;
    list.appendChild(li);
  });
  setTimeout(renderMath, 100);
}

// Admin Tabs Navigation
tabBtnSettings.addEventListener("click", () => {
  tabBtnSettings.classList.add("active");
  tabBtnResults.classList.remove("active");
  tabContentSettings.classList.add("active");
  tabContentResults.classList.remove("active");
});

tabBtnResults.addEventListener("click", () => {
  tabBtnResults.classList.add("active");
  tabBtnSettings.classList.remove("active");
  tabContentResults.classList.add("active");
  tabContentSettings.classList.remove("active");
});

function renderResultsTable(filterQuery = "") {
  document.getElementById("submission-count-label").textContent = submissions.length;
  resultsTableBody.innerHTML = "";

  if (submissions.length > 0) {
    const totalStudents = submissions.length;
    const totalPercentage = submissions.reduce((acc, curr) => acc + curr.percentage, 0);
    const avgScore = Math.round(totalPercentage / totalStudents);
    const maxScore = Math.max(...submissions.map(s => s.percentage));

    document.getElementById("stat-total-students").textContent = totalStudents;
    document.getElementById("stat-avg-score").textContent = `${avgScore}%`;
    document.getElementById("stat-max-score").textContent = `${maxScore}%`;
  }

  const filtered = submissions.filter(sub => 
    sub.studentName.toLowerCase().includes(filterQuery.toLowerCase()) ||
    sub.studentId.toLowerCase().includes(filterQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    resultsTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Data tidak ditemukan.</td></tr>`;
    return;
  }

  filtered.forEach((sub, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${sub.timestamp}</td>
      <td><strong>${sub.studentName}</strong></td>
      <td>${sub.studentId}</td>
      <td><strong>${sub.score} / ${sub.totalQuestions}</strong> (${sub.percentage}%)</td>
      <td><span class="badge ${sub.warnings > 0 ? 'warning-bg' : ''}">${sub.warnings} Warning</span></td>
      <td><button class="btn-sm" onclick="viewDetailResult(${idx})">👁️ Detail Jawaban</button></td>
    `;
    resultsTableBody.appendChild(tr);
  });
}

if (searchInput) {
  searchInput.addEventListener("input", (e) => renderResultsTable(e.target.value));
}

window.viewDetailResult = function(index) {
  const sub = submissions[index];
  const infoBox = document.getElementById("detail-student-info");
  const answersList = document.getElementById("detail-answers-list");

  infoBox.innerHTML = `
    <p><strong>Nama:</strong> ${sub.studentName} | <strong>NIM/Kelas:</strong> ${sub.studentId}</p>
    <p><strong>Waktu:</strong> ${sub.timestamp} | <strong>Skor:</strong> ${sub.score}/${sub.totalQuestions} (${sub.percentage}%) | <strong>Pelanggaran Tab:</strong> ${sub.warnings}x</p>
  `;

  answersList.innerHTML = "";
  if (sub.userAnswers) {
    sub.userAnswers.forEach((ans, i) => {
      const card = document.createElement("div");
      card.className = `review-q-card ${ans.isCorrect ? 'correct' : 'incorrect'}`;
      
      let optionsHtml = "";
      ans.options.forEach((opt, optIdx) => {
        let isSelected = Array.isArray(ans.selectedOptions) ? ans.selectedOptions.includes(optIdx) : false;
        let isCorrectKey = Array.isArray(ans.correctOption) ? ans.correctOption.includes(optIdx) : (optIdx === ans.correctOption);

        let optClass = "review-opt";
        if (isCorrectKey) optClass += " is-correct";
        else if (isSelected && !ans.isCorrect) optClass += " is-wrong";

        let optImg = opt.image ? `<img src="${opt.image}" class="option-img" alt="Pilihan">` : '';
        optionsHtml += `<div class="${optClass}">${isSelected ? '👉 ' : ''}${optImg} ${opt.text} ${isCorrectKey ? ' (Kunci)' : ''}</div>`;
      });

      let typeBadge = (ans.type === "multiple") ? '[PG Kompleks]' : '[PG Biasa]';
      card.innerHTML = `
        <p><strong>Soal ${i + 1} ${typeBadge}:</strong> ${ans.questionText}</p>
        ${ans.questionImage ? `<div class="image-box"><img src="${ans.questionImage}" style="max-height:120px;"></div>` : ''}
        <div>${optionsHtml}</div>
      `;
      answersList.appendChild(card);
    });
  }

  detailModal.classList.remove("hidden");
  setTimeout(renderMath, 50);
};

closeDetailBtn.addEventListener("click", () => detailModal.classList.add("hidden"));

saveSettingsBtn.addEventListener("click", () => {
  const newTitle = document.getElementById("setting-title").value.trim();
  const newTime = parseInt(document.getElementById("setting-time").value);

  if (newTitle) config.title = newTitle;
  if (newTime && newTime > 0) config.timeLimitMinutes = newTime;

  localStorage.setItem("quiz_config", JSON.stringify(config));
  applyConfigUI();
  alert("Pengaturan berhasil disimpan!");
});

exportJsonBtn.addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "quiz_config.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});

exportCsvBtn.addEventListener("click", () => {
  if (submissions.length === 0) return alert("Belum ada data!");
  let csvContent = "data:text/csv;charset=utf-8,Waktu,Nama Siswa,NIM/Kelas,Skor,Total Soal,Persentase,Pelanggaran Tab\n";
  submissions.forEach(s => {
    csvContent += `"${s.timestamp}","${s.studentName}","${s.studentId}",${s.score},${s.totalQuestions},${s.percentage}%,${s.warnings}\n`;
  });
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(csvContent));
  link.setAttribute("download", `Rekap_Nilai_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
});

clearResultsBtn.addEventListener("click", () => {
  if (confirm("Apakah Anda yakin ingin menghapus SELURUH hasil ujian siswa?")) {
    submissions = [];
    localStorage.removeItem("quiz_submissions");
    renderResultsTable();
  }
});
