// ==========================================
// 1. KẾT NỐI SUPABASE & QUẢN LÝ DỮ LIỆU
// ==========================================
const SUPABASE_URL = 'https://fbrecqsubakpighnbqpu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicmVjcXN1YmFrcGlnaG5icXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NjYwNjksImV4cCI6MjEwMzU0MjA2OX0.LaBxU2s0FWSNDjGbcuJaU4Xcm0BPcDx2Wj3vnndOdn4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let vocabList = [];

async function fetchDatabase() {
    const { data, error } = await supabaseClient.from('vocab').select('*').order('id', { ascending: false });
    if (error) {
        console.error("Lỗi:", error);
    } else {
        vocabList = data || [];
        filterList('list');
        filterList('mastered');
    }
}
fetchDatabase();

function exportJSON() {
    const dataStr = JSON.stringify(vocabList, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "tu_vung_tieng_trung_supabase.json";
    a.click();
    URL.revokeObjectURL(url);
}

async function importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (Array.isArray(importedData)) {
                let newDataToInsert = [];
                let count = 0;
                importedData.forEach(newWord => {
                    if (!vocabList.find(w => w.hanzi === newWord.hanzi)) {
                        newWord.id = Date.now() + count++;
                        if(newWord.isMastered === undefined) newWord.isMastered = false;
                        if(newWord.nextReview === undefined) newWord.nextReview = Date.now();
                        newDataToInsert.push(newWord);
                    }
                });
                if (newDataToInsert.length > 0) {
                    const { error } = await supabaseClient.from('vocab').insert(newDataToInsert);
                    if (error) throw error;
                    vocabList = [...newDataToInsert, ...vocabList];
                    alert(`Đã nhập thành công ${newDataToInsert.length} từ mới!`);
                    filterList('list');
                } else {
                    alert("Tất cả các từ trong file đã tồn tại.");
                }
                event.target.value = ''; 
            }
        } catch (error) {}
    };
    reader.readAsText(file);
}

// ==========================================
// 2. GIAO DIỆN & TÌM KIẾM
// ==========================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');

    const activeBtn = document.querySelector(`.nav-btn[onclick="switchTab('${tabId}')"]`);
    if(activeBtn) activeBtn.classList.add('active');

    if (tabId === 'list') filterList('list');
    if (tabId === 'mastered') filterList('mastered'); 
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
    }
}

function filterList(type) {
    const query = document.getElementById(type === 'list' ? 'search-list' : 'search-mastered').value.toLowerCase();
    const grid = document.getElementById(type === 'list' ? 'flashcard-grid' : 'mastered-grid');
    grid.innerHTML = ''; 
    
    const words = vocabList.filter(w => type === 'list' ? !w.isMastered : w.isMastered);
    const filtered = words.filter(w => 
        w.hanzi.toLowerCase().includes(query) || 
        w.pinyin.toLowerCase().includes(query) || 
        w.viDef.toLowerCase().includes(query) || 
        (w.enDef && w.enDef.toLowerCase().includes(query))
    );

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#6c757d;">Không tìm thấy kết quả.</p>';
        return;
    }
    filtered.forEach(word => grid.appendChild(createCardElement(word, type === 'mastered')));
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
        card.innerHTML += `
            <div style="position:absolute; top:10px; right:10px; display: flex; gap: 8px;">
                <button class="action-icon" onclick="restoreWord(${word.id})" title="Khôi phục"><i class="fas fa-undo"></i></button>
                <button class="action-icon delete" onclick="deleteWord(${word.id}, 'mastered')" title="Xóa vĩnh viễn"><i class="fas fa-trash"></i></button>
            </div>
        `;
    } else {
        card.innerHTML += `
            <div style="position:absolute; top:10px; right:10px; display: flex; gap: 8px;">
                <button class="action-icon edit" onclick="openEditModal(${word.id})" title="Sửa"><i class="fas fa-edit"></i></button>
                <button class="action-icon delete" onclick="deleteWord(${word.id}, 'list')" title="Xóa"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }
    return card;
}

// ==========================================
// 3. THÊM TỪ & SỬA TỪ (DỊCH SONG NGỮ)
// ==========================================
async function autoFill() {
    const hanziInput = document.getElementById('input-hanzi').value.trim();
    if (!hanziInput) {
        alert("Vui lòng nhập Chữ Hán trước!");
        return;
    }
    const btn = document.querySelector('button[onclick="autoFill()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        if (window.pinyinPro) {
            document.getElementById('input-pinyin').value = window.pinyinPro.pinyin(hanziInput);
        }
        // Gọi API song song cho 2 ngôn ngữ
        const [resVi, resEn] = await Promise.all([
            fetch(`https://api.mymemory.translated.net/get?q=${hanziInput}&langpair=zh|vi`).then(r => r.json()).catch(()=>null),
            fetch(`https://api.mymemory.translated.net/get?q=${hanziInput}&langpair=zh|en`).then(r => r.json()).catch(()=>null)
        ]);
        
        if (resVi?.responseData?.translatedText) document.getElementById('input-vi').value = resVi.responseData.translatedText;
        if (resEn?.responseData?.translatedText) document.getElementById('input-en').value = resEn.responseData.translatedText;
    } catch (error) {
        alert("Lỗi mạng khi dịch.");
    } finally {
        btn.innerHTML = oldText;
        btn.disabled = false;
    }
}

document.getElementById('add-word-form').addEventListener('submit', async function(e) {
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
    
    vocabList.unshift(newWord); 
    this.reset(); 
    
    // Phát âm ngay sau khi thêm
    playAudio(newWord.hanzi);
    alert('Thêm từ thành công!');

    const { error } = await supabaseClient.from('vocab').insert([newWord]);
    if (error) console.error("Lỗi:", error);
});

// Chức năng Modal Sửa Từ
function openEditModal(id) {
    const word = vocabList.find(w => w.id === id);
    if(!word) return;
    document.getElementById('edit-id').value = word.id;
    document.getElementById('edit-hanzi').value = word.hanzi;
    document.getElementById('edit-pinyin').value = word.pinyin;
    document.getElementById('edit-en').value = word.enDef || "";
    document.getElementById('edit-vi').value = word.viDef || "";
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

async function saveEditWord() {
    const id = parseInt(document.getElementById('edit-id').value);
    const index = vocabList.findIndex(w => w.id === id);
    if(index === -1) return;

    vocabList[index].hanzi = document.getElementById('edit-hanzi').value.trim();
    vocabList[index].pinyin = document.getElementById('edit-pinyin').value.trim();
    vocabList[index].enDef = document.getElementById('edit-en').value.trim();
    vocabList[index].viDef = document.getElementById('edit-vi').value.trim();

    closeEditModal();
    filterList('list'); // Re-render

    await supabaseClient.from('vocab').update({ 
        hanzi: vocabList[index].hanzi,
        pinyin: vocabList[index].pinyin,
        "enDef": vocabList[index].enDef,
        "viDef": vocabList[index].viDef
    }).eq('id', id);
}

// Xóa và khôi phục
async function restoreWord(id) {
    const index = vocabList.findIndex(w => w.id === id);
    if(index !== -1) {
        vocabList[index].isMastered = false; 
        vocabList[index].nextReview = Date.now(); 
        filterList('mastered'); 
        await supabaseClient.from('vocab').update({ isMastered: false, nextReview: vocabList[index].nextReview }).eq('id', id);
    }
}

async function deleteWord(id, type) {
    if(confirm("Bạn có chắc chắn muốn xóa vĩnh viễn từ này khỏi hệ thống?")) {
        vocabList = vocabList.filter(word => word.id !== id);
        filterList(type); 
        await supabaseClient.from('vocab').delete().eq('id', id);
    }
}

// ==========================================
// 4. LOGIC ÔN TẬP (SRS & CHẶN HINT)
// ==========================================
let currentQuizWord = null;
let hintRevealed = 0; 

function startReview() {
    const now = Date.now();
    let dueWords = vocabList.filter(w => !w.isMastered && (!w.nextReview || w.nextReview <= now));

    document.getElementById('srs-controls').style.display = 'none';
    const reviewContainer = document.getElementById('review-container');

    if (dueWords.length === 0) {
        reviewContainer.innerHTML = `<h3 style="color:#34a853; text-align:center;">Tuyệt vời! Bạn đã hoàn thành các từ cần ôn lúc này.</h3>`;
        document.getElementById('default-controls').style.display = 'none';
        return;
    }

    document.getElementById('default-controls').style.display = 'block';
    const randomIndex = Math.floor(Math.random() * dueWords.length);
    currentQuizWord = dueWords[randomIndex];
    hintRevealed = 0; 
    
    let displayQuestion = currentQuizWord.enDef ? currentQuizWord.enDef : "<i>(Chưa có nghĩa tiếng Anh)</i>";

    reviewContainer.innerHTML = `
        <div style="text-align: right; color: #868e96; font-size: 15px; font-weight: bold; margin-bottom: 10px; background: #f8f9fa; padding: 5px 10px; border-radius: 8px; display: inline-block; float: right;">
            <i class="fas fa-layer-group"></i> Còn lại: <span style="color: #ea4335; font-size: 18px;">${dueWords.length}</span> từ
        </div>
        <div style="clear: both;"></div>

        <h3 id="quiz-title" style="margin-bottom: 20px;">
            <span style="display: block; color: #868e96; font-size: 16px; margin-bottom: 5px; font-weight: normal;">English Definition:</span>
            <span style="color: #4285f4; font-size: 28px;">${displayQuestion}</span>
        </h3>
        
        <div style="text-align: center; margin-bottom: 15px;">
            <button type="button" onclick="showHint()" tabindex="-1" style="background: #ffc107; color: #333; border: none; padding: 8px 20px; border-radius: 20px; font-size: 14px; cursor: pointer; font-weight: bold;">
                <i class="fas fa-lightbulb"></i> Xem gợi ý Pinyin
            </button>
        </div>

        <input type="text" id="quiz-input" class="review-input" lang="zh-CN" oninput="this.style.color='#333'" placeholder="Nhập Chữ Hán hoặc Pinyin (Bấm \`)...">
        
        <div id="action-buttons" class="review-actions">
            <button onclick="skipQuiz()" tabindex="-1" class="btn-danger"><i class="fas fa-eye"></i> Không nhớ</button>
            <button onclick="checkAnswer()" tabindex="-1" class="btn-success"><i class="fas fa-check"></i> Kiểm tra</button>
        </div>
        <div id="quiz-feedback" class="feedback-msg"></div>
    `;
    document.getElementById('quiz-input').focus();
}

function showHint() {
    if (!currentQuizWord) return;
    // Chặn gọi Hint nếu phần nút action (Kiểm tra) đã bị ẩn -> Tránh chèn lên kết quả và tắt tiếng
    if (document.getElementById('action-buttons').style.display === 'none') return;
    
    hintRevealed++;
    const pinyin = currentQuizWord.pinyin; 
    if (hintRevealed > pinyin.length) hintRevealed = pinyin.length;
    
    const revealedText = pinyin.substring(0, hintRevealed);
    const hiddenText = '*'.repeat(pinyin.length - hintRevealed);
    
    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `<span style="color: #f29900;">Gợi ý Pinyin: <strong style="letter-spacing: 3px;">${revealedText}${hiddenText}</strong></span>`;
    feedback.className = 'feedback-msg'; 
    
    const inputField = document.getElementById('quiz-input');
    if (inputField && !inputField.disabled) inputField.focus();
}

function removeTones(str) {
    if (!str) return "";
    let s = str.toLowerCase().replace(/\s/g, "");
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    s = s.replace(/v/g, "u");
    return s;
}

function getFeedbackHTML(isCorrect) {
    const title = isCorrect ? "Chính xác!" : "Đáp án là:";
    return `
        ${title} <strong style="font-size: 20px;">${currentQuizWord.hanzi}</strong> (${currentQuizWord.pinyin})<br>
        <div style="margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 8px;">
            <span style="color: #2b3a55; font-size: 16px; font-weight: 600;">🇻🇳 Nghĩa VN: ${currentQuizWord.viDef}</span>
        </div>
        <button onclick="playAudio('${currentQuizWord.hanzi}')" style="margin-top: 15px; padding: 8px 16px; background: #e9ecef; color: #333; border: 1px solid #ccc; border-radius: 8px; cursor: pointer; font-weight: bold;">
            <i class="fas fa-volume-up"></i> Nghe lại âm thanh
        </button>
    `;
}

function checkAnswer() {
    const inputField = document.getElementById('quiz-input');
    const feedback = document.getElementById('quiz-feedback');
    const userAnswer = inputField.value.trim();
    
    const cleanPinyinData = removeTones(currentQuizWord.pinyin);
    const cleanUserInput = removeTones(userAnswer);
    
    if (userAnswer === currentQuizWord.hanzi || cleanUserInput === cleanPinyinData) {
        feedback.innerHTML = getFeedbackHTML(true);
        feedback.className = 'feedback-msg correct';
        inputField.style.color = "#333";
        showSRSControls();
    } else {
        feedback.innerHTML = `Chưa đúng! Hãy thử lại. (Ấn nút đỏ nếu không nhớ)`;
        feedback.className = 'feedback-msg wrong';
        inputField.style.color = "#ea4335"; 
        inputField.focus(); 
    }
}

function skipQuiz() {
    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = getFeedbackHTML(false);
    feedback.className = 'feedback-msg wrong';
    showSRSControls();
}

function showSRSControls() {
    playAudio(currentQuizWord.hanzi);
    document.getElementById('action-buttons').style.display = 'none'; 
    document.getElementById('default-controls').style.display = 'none'; 
    document.getElementById('srs-controls').style.display = 'flex'; 
    
    const inputField = document.getElementById('quiz-input');
    if (inputField) inputField.disabled = true;
}

async function updateSRS(level) {
    if (!currentQuizWord) return;
    const now = Date.now();
    
    // Áp dụng mốc thời gian mới: 30p, 1 ngày, 4 ngày, 6 ngày
    if (level === 1) currentQuizWord.nextReview = now + 30 * 60 * 1000; 
    else if (level === 2) currentQuizWord.nextReview = now + 24 * 60 * 60 * 1000; 
    else if (level === 3) currentQuizWord.nextReview = now + 4 * 24 * 60 * 60 * 1000; 
    else if (level === 4) currentQuizWord.nextReview = now + 6 * 24 * 60 * 60 * 1000; 
    else if (level === 5) currentQuizWord.isMastered = true; 

    const index = vocabList.findIndex(w => w.id === currentQuizWord.id);
    if(index !== -1) vocabList[index] = currentQuizWord;
    setTimeout(() => { startReview(); }, 50);

    await supabaseClient.from('vocab').update({ 
        isMastered: currentQuizWord.isMastered, 
        nextReview: currentQuizWord.nextReview 
    }).eq('id', currentQuizWord.id);
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