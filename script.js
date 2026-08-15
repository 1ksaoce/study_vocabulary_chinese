// ==========================================
// 1. QUẢN LÝ DỮ LIỆU
// ==========================================
const defaultVocab = [
    { id: 101, hanzi: "公司", pinyin: "gōngsī", type: "Noun", enDef: "Company", viDef: "Công ty" },
    { id: 102, hanzi: "同事", pinyin: "tóngshì", type: "Noun", enDef: "Colleague", viDef: "Đồng nghiệp" },
    { id: 103, hanzi: "老板", pinyin: "lǎobǎn", type: "Noun", enDef: "Boss", viDef: "Sếp, ông chủ" },
    { id: 104, hanzi: "面试", pinyin: "miànshì", type: "Verb", enDef: "To interview", viDef: "Phỏng vấn" },
    { id: 105, hanzi: "开会", pinyin: "kāihuì", type: "Verb", enDef: "To have a meeting", viDef: "Họp" },
    { id: 106, hanzi: "加班", pinyin: "jiābān", type: "Verb", enDef: "To work overtime", viDef: "Tăng ca" }
];

let vocabList = JSON.parse(localStorage.getItem('vocabList'));
if (!vocabList || vocabList.length === 0) {
    vocabList = defaultVocab;
    localStorage.setItem('vocabList', JSON.stringify(vocabList));
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const activeBtn = document.querySelector(`.nav-btn[onclick="switchTab('${tabId}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if (tabId === 'list') renderList();
    if (tabId === 'mastered') renderMasteredList(); 
    if (tabId === 'review') {
        document.getElementById('srs-controls').style.display = 'none';
        document.getElementById('default-controls').style.display = 'block';
        document.getElementById('review-container').innerHTML = '<div class="empty-state">Nhấn "Bắt đầu ôn tập" để kiểm tra từ vựng.</div>';
    }
}

function playAudio(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN'; 
        utterance.rate = 0.9;     
        window.speechSynthesis.speak(utterance);
    } else {
        alert("Trình duyệt của bạn không hỗ trợ tính năng phát âm.");
    }
}

// ==========================================
// TÍNH NĂNG ĐIỀN TỰ ĐỘNG TỪ ĐIỂN
// ==========================================
async function autoFill() {
    const hanziInput = document.getElementById('input-hanzi').value.trim();
    if (!hanziInput) {
        alert("Vui lòng nhập Chữ Hán trước rồi mới bấm 'Điền tự động'!");
        return;
    }

    const btn = document.querySelector('button[onclick="autoFill()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tải...';
    btn.disabled = true;

    try {
        // 1. Dịch Pinyin trực tiếp bằng thư viện (Không cần mạng vẫn chạy được)
        if (window.pinyinPro) {
            const { pinyin } = window.pinyinPro;
            document.getElementById('input-pinyin').value = pinyin(hanziInput);
        }

        // 2. Gọi API MyMemory để dịch nghĩa tiếng Việt (Cần mạng)
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${hanziInput}&langpair=zh|vi`);
        const data = await response.json();
        
        if (data && data.responseData && data.responseData.translatedText) {
            document.getElementById('input-vi').value = data.responseData.translatedText;
        }
    } catch (error) {
        console.error(error);
        alert("Không thể dịch tiếng Việt (Hãy kiểm tra lại mạng Internet). Pinyin vẫn được điền.");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

document.getElementById('add-word-form').addEventListener('submit', function(e) {
    e.preventDefault(); 
    const newWord = {
        id: Date.now(),
        hanzi: document.getElementById('input-hanzi').value.trim(),
        pinyin: document.getElementById('input-pinyin').value.trim(),
        type: document.getElementById('input-type').value,
        enDef: document.getElementById('input-en').value.trim(),
        viDef: document.getElementById('input-vi').value.trim(),
        isMastered: false, 
        nextReview: Date.now() 
    };
    vocabList.push(newWord);
    saveData();
    alert('Thêm từ thành công!');
    this.reset(); 
});

function saveData() {
    localStorage.setItem('vocabList', JSON.stringify(vocabList));
}

function renderList() {
    const grid = document.getElementById('flashcard-grid');
    grid.innerHTML = ''; 
    const activeWords = vocabList.filter(w => !w.isMastered);

    if (activeWords.length === 0) {
        grid.innerHTML = '<p>Không có từ vựng nào.</p>';
        return;
    }
    activeWords.forEach(word => grid.appendChild(createCardElement(word)));
}

function renderMasteredList() {
    const grid = document.getElementById('mastered-grid');
    grid.innerHTML = '';
    const masteredWords = vocabList.filter(w => w.isMastered);

    if (masteredWords.length === 0) {
        grid.innerHTML = '<p>Bạn chưa có từ nào bị ẩn cả.</p>';
        return;
    }
    masteredWords.forEach(word => grid.appendChild(createCardElement(word, true)));
}

function createCardElement(word, isMasteredView = false) {
    const card = document.createElement('div');
    card.className = 'flashcard';
    card.innerHTML = `
        <div class="flashcard-header">
            <span class="hanzi-text">${word.hanzi}</span>
            <button class="btn-audio" onclick="playAudio('${word.hanzi}')"><i class="fas fa-volume-up"></i></button>
        </div>
        <div class="pinyin-text">Pinyin: ${word.pinyin}</div>
        <div class="definition vi">VI: ${word.viDef}</div>
    `;
    
    if (isMasteredView) {
        card.innerHTML += `<button class="btn-restore" onclick="restoreWord(${word.id})" style="position:absolute; top:10px; right:10px;"><i class="fas fa-undo"></i> Khôi phục</button>`;
    } else {
        card.innerHTML += `<button onclick="deleteWord(${word.id})" style="position:absolute; top:10px; right:10px; color:red; border:none; background:none; cursor:pointer;"><i class="fas fa-trash"></i></button>`;
    }
    return card;
}

function restoreWord(id) {
    const index = vocabList.findIndex(w => w.id === id);
    if(index !== -1) {
        vocabList[index].isMastered = false; 
        vocabList[index].nextReview = Date.now(); 
        saveData();
        renderMasteredList();
        alert("Đã khôi phục từ này về Danh sách chính!");
    }
}

function deleteWord(id) {
    if(confirm("Bạn có chắc chắn muốn xóa từ này?")) {
        vocabList = vocabList.filter(word => word.id !== id);
        saveData();
        renderList();
    }
}

// ==========================================
// 6. LOGIC ÔN TẬP
// ==========================================
let currentQuizWord = null;
let hintRevealed = 0; 

function startReview() {
    const now = Date.now();
    let dueWords = vocabList.filter(w => !w.isMastered && (!w.nextReview || w.nextReview <= now));

    document.getElementById('srs-controls').style.display = 'none';
    const reviewContainer = document.getElementById('review-container');

    if (dueWords.length === 0) {
        reviewContainer.innerHTML = `<h3 style="color:#34a853; text-align:center;">Tuyệt vời! Bạn đã hoàn thành các từ cần ôn lúc này. Hãy quay lại sau nhé!</h3>`;
        document.getElementById('default-controls').style.display = 'none';
        return;
    }

    document.getElementById('default-controls').style.display = 'block';
    
    const randomIndex = Math.floor(Math.random() * dueWords.length);
    currentQuizWord = dueWords[randomIndex];
    hintRevealed = 0; 

    // CẬP NHẬT GIAO DIỆN MỚI: Phân tách màu sắc tiêu đề & Bổ sung nút gợi ý Mobile
    reviewContainer.innerHTML = `
        <h3 id="quiz-title" style="margin-bottom: 20px;">
            <span style="display: block; color: #868e96; font-size: 16px; margin-bottom: 5px; font-weight: normal;">Nghĩa tiếng Việt:</span>
            <span style="color: #4285f4; font-size: 32px;">${currentQuizWord.viDef}</span>
        </h3>
        
        <div style="text-align: center; margin-bottom: 15px;">
            <button type="button" onclick="showHint()" tabindex="-1" style="background: #ffc107; color: #333; border: none; padding: 8px 20px; border-radius: 20px; font-size: 14px; cursor: pointer; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <i class="fas fa-lightbulb"></i> Xem gợi ý Pinyin
            </button>
        </div>

        <input type="text" id="quiz-input" class="review-input" oninput="this.style.color='#333'" placeholder="Nhập Chữ Hán hoặc Pinyin...">
        
        <div id="action-buttons" class="review-actions">
            <button onclick="skipQuiz()" tabindex="-1" class="btn-danger"><i class="fas fa-eye"></i> Không nhớ (Tab)</button>
            <button onclick="checkAnswer()" tabindex="-1" class="btn-success"><i class="fas fa-check"></i> Kiểm tra (Enter)</button>
        </div>
        <div id="quiz-feedback" class="feedback-msg"></div>
    `;
    
    document.getElementById('quiz-input').focus();
}

function showHint() {
    if (!currentQuizWord) return;
    
    hintRevealed++;
    const pinyin = currentQuizWord.pinyin; 
    
    if (hintRevealed > pinyin.length) {
        hintRevealed = pinyin.length;
    }
    
    const revealedText = pinyin.substring(0, hintRevealed);
    const hiddenText = '*'.repeat(pinyin.length - hintRevealed);
    
    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `<span style="color: #f29900;">Gợi ý Pinyin: <strong style="letter-spacing: 3px;">${revealedText}${hiddenText}</strong></span>`;
    feedback.className = 'feedback-msg'; 
    
    // Focus lại vào ô input sau khi bấm nút trên điện thoại
    const inputField = document.getElementById('quiz-input');
    if (inputField && !inputField.disabled) {
        inputField.focus();
    }
}

function removeTones(str) {
    if (!str) return "";
    let s = str.toLowerCase().replace(/\s/g, "");
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/v/g, "u");
    return s;
}

function checkAnswer() {
    const inputField = document.getElementById('quiz-input');
    const feedback = document.getElementById('quiz-feedback');
    const userAnswer = inputField.value.trim();
    
    const cleanPinyinData = removeTones(currentQuizWord.pinyin);
    const cleanUserInput = removeTones(userAnswer);
    
    if (userAnswer === currentQuizWord.hanzi || cleanUserInput === cleanPinyinData) {
        feedback.innerHTML = `Chính xác! Đáp án là: <strong>${currentQuizWord.hanzi}</strong> (${currentQuizWord.pinyin})`;
        feedback.className = 'feedback-msg correct';
        inputField.style.color = "#333";
        showSRSControls();
    } else {
        feedback.innerHTML = `Chưa đúng! Hãy thử lại. (Ấn Tab hoặc Nút đỏ nếu không nhớ)`;
        feedback.className = 'feedback-msg wrong';
        inputField.style.color = "#ea4335"; 
        inputField.focus(); 
    }
}

function skipQuiz() {
    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `Đáp án là: <strong>${currentQuizWord.hanzi}</strong> (${currentQuizWord.pinyin})`;
    feedback.className = 'feedback-msg wrong';
    showSRSControls();
}

function showSRSControls() {
    playAudio(currentQuizWord.hanzi);
    document.getElementById('action-buttons').style.display = 'none'; 
    document.getElementById('default-controls').style.display = 'none'; 
    document.getElementById('srs-controls').style.display = 'flex'; 
    
    const inputField = document.getElementById('quiz-input');
    if (inputField) {
        inputField.disabled = true;
    }
}

function updateSRS(level) {
    if (!currentQuizWord) return;
    const now = Date.now();
    
    if (level === 1) currentQuizWord.nextReview = now + 5 * 60 * 1000; 
    else if (level === 2) currentQuizWord.nextReview = now + 60 * 60 * 1000; 
    else if (level === 3) currentQuizWord.nextReview = now + 24 * 60 * 60 * 1000; 
    else if (level === 4) currentQuizWord.nextReview = now + 5 * 24 * 60 * 60 * 1000; 
    else if (level === 5) {
        currentQuizWord.isMastered = true; 
    }

    const index = vocabList.findIndex(w => w.id === currentQuizWord.id);
    if(index !== -1) vocabList[index] = currentQuizWord;
    
    saveData();
    setTimeout(() => { startReview(); }, 50);
}

document.addEventListener('keydown', function(e) {
    if (!document.getElementById('tab-review').classList.contains('active')) return;

    const srsControls = document.getElementById('srs-controls');
    const actionButtons = document.getElementById('action-buttons');

    if (srsControls && srsControls.style.display !== 'none') {
        if (['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault(); 
            updateSRS(parseInt(e.key));
        }
    } 
    else if (actionButtons && actionButtons.style.display !== 'none') {
        if (e.key === 'Enter') {
            e.preventDefault(); 
            checkAnswer();
        } 
        else if (e.key === 'Tab') {
            e.preventDefault(); 
            skipQuiz();
        } 
        else if (e.key === '`') {
            e.preventDefault(); 
            showHint();
        }
    }
});

renderList();