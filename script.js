// --- Default Configuration ---
const DEFAULT_CONFIG = {
  adminPassword: "admin123",
  title: "Online Examination",
  timeLimitMinutes: 5,
  questions: [
    {
      question: "Apa nama hewan pada gambar di bawah ini?",
      image: "",
      options: [
        { text: "Kucing", image: "" },
        { text: "Anjing", image: "" },
        { text: "Burung", image: "" }
      ],
      answer: 0
    }
  ]
};

// --- Load Saved Data ---
let config = JSON.parse(localStorage.getItem("quiz_config")) || DEFAULT_CONFIG;
let submissions = JSON.parse(localStorage.getItem("quiz_submissions")) || [];

// --- State Variables ---
let sessionQuestions = []; // Stores randomized questions for current student
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let timer;
let timeLeft = config.timeLimitMinutes * 60;

// Anti-Cheat & Student State
let isQuizActive = false;
let warningCount = 0;
const MAX_WARNINGS = 3;

let studentInfo = { name: "", id: "" };
let userAnswers = [];

// Admin State for Options
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
const progressBar = document.getElementById("progress");
const timeDisplay = document.getElementById("time");

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

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
  let arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// File to Base64 Converter
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function applyConfigUI() {
  appTitle.textContent = config.title;
  document.getElementById("setting-title").value = config.title;
  document.getElementById("setting-time").value = config.timeLimitMinutes;
  
  let mins = config.timeLimitMinutes.toString().padStart(2, '0');
  timeDisplay.textContent = `${mins}:00`;
}
applyConfigUI();

// --- TEST EXECUTION & SHUFFLING ---
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", handleNextQuestion);
restartBtn.addEventListener("click", restartQuiz);

function prepareRandomizedQuiz() {
  // 1. Shuffle Questions
  let shuffledQuestions = shuffleArray(config.questions);

  // 2. Shuffle Options for Each Question & Track Correct Answer
  sessionQuestions = shuffledQuestions.map(q => {
    // Map options with their original correctness flag
    let optionsMapped = q.options.map((opt, idx) => ({
      ...opt,
      isCorrect: idx === q.answer
    }));

    // Shuffle the options
    let shuffledOptions = shuffleArray(optionsMapped);

    // Find new correct index
    let newCorrectIndex = shuffledOptions.findIndex(o => o.isCorrect);

    return {
      question: q.question,
      image: q.image,
      options: shuffledOptions,
      answer: newCorrectIndex
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

  prepareRandomizedQuiz(); // Acak Soal dan Pilihan per Siswa!
  
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
  selectedOption = null;
  nextBtn.disabled = true;

  const q = sessionQuestions[currentQuestionIndex];
  questionNumber.textContent = `Soal ${currentQuestionIndex + 1} dari ${sessionQuestions.length}`;
  progressBar.style.width = `${((currentQuestionIndex + 1) / sessionQuestions.length) * 100}%`;
  questionText.textContent = q.question;

  // Render Question Image if exists
  if (q.image) {
    questionImageContainer.innerHTML = `<img src="${q.image}" alt="Gambar Soal">`;
    questionImageContainer.classList.remove("hidden");
  } else {
    questionImageContainer.innerHTML = "";
    questionImageContainer.classList.add("hidden");
  }

  // Render Options (With Image Support)
  optionsContainer.innerHTML = "";
  q.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.classList.add("option-btn");
    
    let optImgHtml = option.image ? `<img src="${option.image}" class="option-img" alt="Pilihan">` : '';
    button.innerHTML = `${optImgHtml} <span>${option.text}</span>`;

    button.addEventListener("click", () => selectOption(index, button));
    optionsContainer.appendChild(button);
  });
}

function selectOption(index, buttonElement) {
  selectedOption = index;
  document.querySelectorAll(".option-btn").forEach(btn => btn.classList.remove("selected"));
  buttonElement.classList.add("selected");
  nextBtn.disabled = false;
}

function handleNextQuestion() {
  const q = sessionQuestions[currentQuestionIndex];
  const isCorrect = (selectedOption === q.answer);

  if (isCorrect) score++;

  userAnswers.push({
    questionText: q.question,
    questionImage: q.image,
    options: q.options,
    selectedOption: selectedOption,
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

// --- ADMIN PANEL & DYNAMIC OPTIONS FORM ---

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
}

// Render Dynamic Option Inputs in Admin Panel
function renderAdminOptionsInputs(selectedCorrectIndex = 0) {
  dynamicOptionsList.innerHTML = "";

  adminCurrentOptions.forEach((opt, idx) => {
    const row = document.createElement("div");
    row.className = "dynamic-option-row";
    
    let isChecked = (idx === selectedCorrectIndex) ? 'checked' : '';
    let imgPreview = opt.image ? `<img src="${opt.image}" class="option-img" alt="Pilihan">` : '';

    row.innerHTML = `
      <input type="radio" name="admin-correct-opt" value="${idx}" ${isChecked} title="Tandai sebagai jawaban benar">
      <input type="text" value="${opt.text}" placeholder="Teks Pilihan ${idx + 1}" oninput="updateAdminOptText(${idx}, this.value)">
      <input type="file" accept="image/*" onchange="uploadAdminOptImg(${idx}, this)" style="width: 130px; font-size:0.75rem;">
      ${imgPreview}
      ${adminCurrentOptions.length > 2 ? `<button type="button" class="btn-sm danger" onclick="removeAdminOption(${idx})">✕</button>` : ''}
    `;
    dynamicOptionsList.appendChild(row);
  });
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
  renderAdminOptionsInputs(0);
};

addOptionFieldBtn.addEventListener("click", () => {
  adminCurrentOptions.push({ text: "", image: "" });
  renderAdminOptionsInputs(getSelectedCorrectIndex());
});

function getSelectedCorrectIndex() {
  const radios = document.getElementsByName("admin-correct-opt");
  for (let i = 0; i < radios.length; i++) {
    if (radios[i].checked) return i;
  }
  return 0;
}

// Question Image File Handler
newQImgInput.addEventListener("change", async (e) => {
  if (e.target.files && e.target.files[0]) {
    adminQuestionImage = await fileToBase64(e.target.files[0]);
    previewQImg.innerHTML = `<img src="${adminQuestionImage}" alt="Preview Soal">`;
  }
});

// Save / Add Question
addQBtn.addEventListener("click", () => {
  const qText = document.getElementById("new-q-text").value.trim();
  const correctIdx = getSelectedCorrectIndex();

  if (!qText) {
    alert("Harap isi pertanyaan terlebih dahulu!");
    return;
  }

  // Validate options
  for (let opt of adminCurrentOptions) {
    if (!opt.text && !opt.image) {
      alert("Setiap pilihan jawaban harus memiliki teks atau gambar!");
      return;
    }
  }

  const newQuestionData = {
    question: qText,
    image: adminQuestionImage,
    options: [...adminCurrentOptions],
    answer: correctIdx
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
    li.innerHTML = `
      <span><strong>Q${idx + 1}:</strong> ${q.question} (${q.options.length} Pilihan) ${q.image ? '🖼️' : ''}</span>
      <div class="q-actions">
        <button class="btn-sm warning" onclick="editQuestion(${idx})">Edit</button>
        <button class="btn-sm danger" onclick="deleteQuestion(${idx})">Hapus</button>
      </div>
    `;
    list.appendChild(li);
  });
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
        let isSelected = (optIdx === ans.selectedOption);
        let isCorrectKey = (optIdx === ans.correctOption);

        let optClass = "review-opt";
        if (isCorrectKey) optClass += " is-correct";
        else if (isSelected && !ans.isCorrect) optClass += " is-wrong";

        let optImg = opt.image ? `<img src="${opt.image}" class="option-img" alt="Pilihan">` : '';
        optionsHtml += `<div class="${optClass}">${isSelected ? '👉 ' : ''}${optImg} ${opt.text} ${isCorrectKey ? ' (Kunci)' : ''}</div>`;
      });

      card.innerHTML = `
        <p><strong>Soal ${i + 1}:</strong> ${ans.questionText}</p>
        ${ans.questionImage ? `<div class="image-box"><img src="${ans.questionImage}" style="max-height:120px;"></div>` : ''}
        <div>${optionsHtml}</div>
      `;
      answersList.appendChild(card);
    });
  }

  detailModal.classList.remove("hidden");
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
