// --- Default Configuration & Questions ---
const DEFAULT_CONFIG = {
  adminPassword: "admin123",
  title: "Online Examination",
  timeLimitMinutes: 5,
  questions: [
    {
      question: "What does HTML stand for?",
      options: [
        "Hyper Text Markup Language",
        "High Tech Modern Language",
        "Hyper Transfer Markup Language",
        "Home Tool Markup Language"
      ],
      answer: 0
    },
    {
      question: "Which CSS property controls text size?",
      options: ["font-style", "text-size", "font-size", "text-style"],
      answer: 2
    }
  ]
};

// --- Load Saved Config or Use Defaults ---
let config = JSON.parse(localStorage.getItem("quiz_config")) || DEFAULT_CONFIG;

// --- State Variables ---
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;
let timer;
let timeLeft = config.timeLimitMinutes * 60;

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
const saveSettingsBtn = document.getElementById("save-settings-btn");
const exportJsonBtn = document.getElementById("export-json-btn");

const appTitle = document.getElementById("app-title");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");
const questionNumber = document.getElementById("question-number");
const progressBar = document.getElementById("progress");
const timeDisplay = document.getElementById("time");

// --- Initialize App UI ---
function applyConfigUI() {
  appTitle.textContent = config.title;
  document.getElementById("setting-title").value = config.title;
  document.getElementById("setting-time").value = config.timeLimitMinutes;
  
  let mins = config.timeLimitMinutes.toString().padStart(2, '0');
  timeDisplay.textContent = `${mins}:00`;
}
applyConfigUI();

// --- Test Execution Functions ---
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", handleNextQuestion);
restartBtn.addEventListener("click", restartQuiz);

function startQuiz() {
  if (config.questions.length === 0) {
    alert("No questions available! Please add questions in Admin mode.");
    return;
  }
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
      endQuiz();
    }
  }, 1000);
}

function loadQuestion() {
  selectedOption = null;
  nextBtn.disabled = true;

  const q = config.questions[currentQuestionIndex];
  questionNumber.textContent = `Question ${currentQuestionIndex + 1} of ${config.questions.length}`;
  progressBar.style.width = `${((currentQuestionIndex + 1) / config.questions.length) * 100}%`;
  questionText.textContent = q.question;

  optionsContainer.innerHTML = "";
  q.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.classList.add("option-btn");
    button.textContent = option;
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
  if (selectedOption === config.questions[currentQuestionIndex].answer) {
    score++;
  }
  currentQuestionIndex++;
  if (currentQuestionIndex < config.questions.length) {
    loadQuestion();
  } else {
    endQuiz();
  }
}

function endQuiz() {
  clearInterval(timer);
  quizScreen.classList.remove("active");
  resultScreen.classList.add("active");

  document.getElementById("final-score").textContent = score;
  document.getElementById("total-score").textContent = config.questions.length;
  const percentage = Math.round((score / config.questions.length) * 100);
  document.getElementById("score-percentage").textContent = `You scored ${percentage}%`;
}

function restartQuiz() {
  currentQuestionIndex = 0;
  score = 0;
  resultScreen.classList.remove("active");
  startQuiz();
}

// --- ADMIN PANEL FUNCTIONS ---

adminLoginBtn.addEventListener("click", () => {
  const pass = prompt("Enter Admin Password:");
  if (pass === config.adminPassword) {
    openAdminPanel();
  } else if (pass !== null) {
    alert("Incorrect password!");
  }
});

closeAdminBtn.addEventListener("click", () => {
  adminScreen.classList.remove("active");
  startScreen.classList.add("active");
});

function openAdminPanel() {
  // Hide screens & open Admin
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  adminScreen.classList.add("active");
  renderQuestionsList();
}

function renderQuestionsList() {
  const list = document.getElementById("questions-list");
  document.getElementById("q-count-label").textContent = config.questions.length;
  list.innerHTML = "";

  config.questions.forEach((q, idx) => {
    const li = document.createElement("li");
    li.className = "q-item";
    li.innerHTML = `
      <span><strong>Q${idx + 1}:</strong> ${q.question}</span>
      <button class="btn-sm danger" onclick="deleteQuestion(${idx})">Delete</button>
    `;
    list.appendChild(li);
  });
}

function deleteQuestion(index) {
  config.questions.splice(index, 1);
  renderQuestionsList();
}

addQBtn.addEventListener("click", () => {
  const qText = document.getElementById("new-q-text").value.trim();
  const opt0 = document.getElementById("new-opt-0").value.trim();
  const opt1 = document.getElementById("new-opt-1").value.trim();
  const opt2 = document.getElementById("new-opt-2").value.trim();
  const opt3 = document.getElementById("new-opt-3").value.trim();
  const correct = parseInt(document.getElementById("new-q-correct").value);

  if (!qText || !opt0 || !opt1 || !opt2 || !opt3) {
    alert("Please fill in all question fields and options!");
    return;
  }

  config.questions.push({
    question: qText,
    options: [opt0, opt1, opt2, opt3],
    answer: correct
  });

  // Reset inputs
  document.getElementById("new-q-text").value = "";
  document.getElementById("new-opt-0").value = "";
  document.getElementById("new-opt-1").value = "";
  document.getElementById("new-opt-2").value = "";
  document.getElementById("new-opt-3").value = "";

  renderQuestionsList();
});

saveSettingsBtn.addEventListener("click", () => {
  const newTitle = document.getElementById("setting-title").value.trim();
  const newTime = parseInt(document.getElementById("setting-time").value);

  if (newTitle) config.title = newTitle;
  if (newTime && newTime > 0) config.timeLimitMinutes = newTime;

  // Save to browser storage
  localStorage.setItem("quiz_config", JSON.stringify(config));
  applyConfigUI();
  alert("Settings and Questions saved to local browser!");
});

// Download JSON Config (To easily overwrite DEFAULT_CONFIG for GitHub deployment)
exportJsonBtn.addEventListener("click", () => {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", "quiz_config.json");
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
});
