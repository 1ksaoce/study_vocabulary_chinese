// ==========================================
// 1. KẾT NỐI SUPABASE & QUẢN LÝ DỮ LIỆU
// ==========================================
const SUPABASE_URL = 'https://fbrecqsubakpighnbqpu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZicmVjcXN1YmFrcGlnaG5icXB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5NjYwNjksImV4cCI6MjEwMzU0MjA2OX0.LaBxU2s0FWSNDjGbcuJaU4Xcm0BPcDx2Wj3vnndOdn4';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let vocabList = [];
let audioRate = parseFloat(localStorage.getItem('audioRate')) || 0.8;

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
                        if(!newWord.type) newWord.type = "Noun";
                        if(newWord.example_zh === undefined) newWord.example_zh = "";
                        if(newWord.example_en === undefined) newWord.example_en = "";
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
// 2. GIAO DIỆN, CÀI ĐẶT & TÌM KIẾM
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

function openSettingsModal() {
    document.getElementById('speed-slider').value = audioRate;
    document.getElementById('speed-display').innerText = audioRate + 'x';
    document.getElementById('settings-modal').style.display = 'flex';
}

function closeSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function saveSettings() {
    audioRate = parseFloat(document.getElementById('speed-slider').value);
    localStorage.setItem('audioRate', audioRate);
    closeSettingsModal();
    alert("Đã lưu cài đặt tốc độ thành công!");
}
// ==========================================
// TTS TIẾNG TRUNG - GIỌNG TỰ NHIÊN HƠN
// ==========================================

let cachedChineseVoice = null;

function getBestChineseVoice() {
    if (!('speechSynthesis' in window)) return null;

    const voices = window.speechSynthesis.getVoices();

    // Ưu tiên các giọng Trung Quốc chất lượng cao
    const preferredNames = [
        'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland China)',
        'Microsoft Yunxi Online (Natural) - Chinese (Mainland China)',
        'Microsoft Yunxia Online (Natural) - Chinese (Mainland China)',
        'Microsoft Xiaoyi Online (Natural) - Chinese (Mainland China)',
        'Xiaoxiao',
        'Yunxi',
        'Yunxia',
        'Xiaoyi',
        'Ting-Ting',
        'Sin-ji',
        'Meijia'
    ];

    // 1. Ưu tiên đúng tên voice
    for (const name of preferredNames) {
        const voice = voices.find(v =>
            v.name.toLowerCase().includes(name.toLowerCase())
        );

        if (voice) return voice;
    }

    // 2. Ưu tiên voice zh-CN
    const zhCN = voices.find(v =>
        v.lang && v.lang.toLowerCase() === 'zh-cn'
    );

    if (zhCN) return zhCN;

    // 3. Fallback các voice zh khác
    const zhVoice = voices.find(v =>
        v.lang && v.lang.toLowerCase().startsWith('zh')
    );

    return zhVoice || null;
}

function playChineseSpeech(text, speed = audioRate) {
    if (!('speechSynthesis' in window) || !text) return;

    // Dừng câu đang đọc để tránh chồng âm
    window.speechSynthesis.cancel();

    const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);

        utterance.lang = 'zh-CN';

        // Tốc độ ổn định và tự nhiên hơn
        utterance.rate = Math.max(0.65, Math.min(speed, 1.0));

        // Giọng hơi thấp một chút sẽ tự nhiên hơn
        utterance.pitch = 1.0;

        const voice = cachedChineseVoice || getBestChineseVoice();

        if (voice) {
            utterance.voice = voice;
            cachedChineseVoice = voice;
        }

        utterance.volume = 1.0;

        window.speechSynthesis.speak(utterance);
    };

    // Một số trình duyệt chưa load voice ngay lần đầu
    if (window.speechSynthesis.getVoices().length === 0) {
        setTimeout(speak, 150);
    } else {
        speak();
    }
}


// Đọc thử trong phần Cài đặt
function testAudioSettings() {
    const tempRate =
        parseFloat(document.getElementById('speed-slider').value) || 0.85;

    playChineseSpeech(
        '你好，我是你的中文助手。',
        tempRate
    );
}


// Hàm được gọi khi bấm loa trên từ vựng
function playAudio(text) {
    playChineseSpeech(text, audioRate);
}


// Chrome / Edge thường load voice bất đồng bộ
if ('speechSynthesis' in window) {
    const loadChineseVoice = () => {
        cachedChineseVoice = getBestChineseVoice();
    };

    loadChineseVoice();
    window.speechSynthesis.onvoiceschanged = loadChineseVoice;
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
        grid.innerHTML = '<p style="text-align:center; width:100%; color:#6c757d; background:white; padding:20px; border-radius:12px;">Không tìm thấy kết quả.</p>';
        return;
    }
    filtered.forEach(word => grid.appendChild(createCardElement(word, type === 'mastered')));
}

function createCardElement(word, isMasteredView = false) {
    const card = document.createElement('div');
    card.className = 'flashcard';
    
    const exampleHtml = (word.example_zh || word.example_en) ? `
        <div style="margin-top: 12px; padding-top: 8px; border-top: 1px dashed #ccc; font-size: 13.5px; text-align: left;">
            <div style="color: #2b3a55; font-weight: bold; margin-bottom: 4px;">${word.example_zh || ''}</div>
            <div style="color: #6c757d; font-style: italic;">${word.example_en || ''}</div>
        </div>
    ` : '';

    // Khởi tạo cụm nút action theo trạng thái tab
    const actionButtons = isMasteredView ? `
        <button class="action-icon" onclick="restoreWord(${word.id})" title="Khôi phục"><i class="fas fa-undo"></i></button>
        <button class="action-icon delete" onclick="deleteWord(${word.id}, 'mastered')" title="Xóa vĩnh viễn"><i class="fas fa-trash"></i></button>
    ` : `
        <button class="action-icon edit" onclick="openEditModal(${word.id})" title="Sửa"><i class="fas fa-edit"></i></button>
        <button class="action-icon delete" onclick="deleteWord(${word.id}, 'list')" title="Xóa"><i class="fas fa-trash"></i></button>
    `;

    card.innerHTML = `
        <div class="flashcard-header" style="align-items: flex-start; padding-right: 85px;">
            <div style="display: flex; flex-direction: column; gap: 6px;">
                <span class="hanzi-text" style="line-height: 1.2;">${word.hanzi}</span>
                <span class="word-type" style="background:#f1f3f5; padding:4px 8px; border-radius:6px; font-size:12px; color:#6c757d; display:inline-block; word-wrap: break-word; line-height: 1.3; width: fit-content;">${word.type || 'Noun'}</span>
            </div>
        </div>
        
        <!-- Gom tất cả nút bấm vào chung một cụm để chống đè chéo -->
        <div style="position:absolute; top:15px; right:15px; display: flex; gap: 8px; align-items: center; background: white; padding-left: 5px;">
            <button class="btn-audio" onclick="playAudio('${word.hanzi}')" style="width: 32px; height: 32px; margin-right: 5px;"><i class="fas fa-volume-up"></i></button>
            ${actionButtons}
        </div>

        <div class="pinyin-text" style="margin-top: 5px;">Pinyin: ${word.pinyin}</div>
        <div class="definition vi">VI: ${word.viDef}</div>
        ${exampleHtml}
    `;
    
    return card;
}

// ==========================================
// 3. THÊM TỪ TỰ ĐỘNG & GỌI API
//    Tatoeba v1 -> proxy v1 -> proxy v0 -> dịch câu bằng MyMemory
// ==========================================

// Fetch có timeout để API lỗi/chậm không làm treo app.
async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 5000, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(resource, {
            ...fetchOptions,
            signal: controller.signal,
            headers: {
                Accept: 'application/json',
                ...(fetchOptions.headers || {})
            }
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.warn('API request failed:', resource, error?.name || error);
        return null;
    } finally {
        clearTimeout(id);
    }
}

// Một số phiên bản Tatoeba trả translations dạng mảng phẳng,
// một số response cũ trả mảng lồng. Hàm này xử lý cả hai.
function flattenTranslations(translations) {
    if (!Array.isArray(translations)) return [];
    return translations.flat(Infinity).filter(item => item && typeof item === 'object');
}

function pickEnglishTranslation(sentence) {
    const translations = flattenTranslations(sentence?.translations);

    const english = translations.find(t =>
        ['eng', 'en'].includes(String(t.lang || t.language || '').toLowerCase()) && t.text
    );

    return english?.text || translations.find(t => t.text)?.text || '';
}

// Chuẩn hóa kết quả Tatoeba v1/v0 để không phụ thuộc duy nhất một schema.
function extractTatoebaExample(payload) {
    if (!payload) return null;

    const candidates =
        (Array.isArray(payload.data) && payload.data) ||
        (Array.isArray(payload.results) && payload.results) ||
        (Array.isArray(payload.sentences) && payload.sentences) ||
        [];

    for (const item of candidates) {
        const zh = item?.text || item?.sentence || '';
        if (!zh) continue;

        const en = pickEnglishTranslation(item);
        return { zh, en };
    }

    return null;
}

async function getTatoebaExample(hanzi) {
    const q = encodeURIComponent(hanzi);

    // API v1 chính thức. sort=relevance ưu tiên câu khớp chính xác cụm từ trước
    // (thay vì sort=words chỉ ưu tiên câu ngắn, có thể bỏ sót câu khớp tốt nhất).
    const v1Url = `https://api.tatoeba.org/v1/sentences?lang=cmn&q=${q}&trans%3Alang=eng&showtrans%3Alang=eng&sort=relevance&limit=10`;

    // API v0 giữ lại như fallback cuối vì code cũ đang dựa vào endpoint này.
    const v0Url = `https://tatoeba.org/en/api_v0/search?from=cmn&to=eng&trans_filter=limit&trans_to=eng&query=${q}&sort=words`;

    // Dùng 2 cổng vượt CORS khác nhau: nếu 1 cổng bị quá tải/chặn thì vẫn còn cổng kia.
    const proxies = [
        'https://api.allorigins.win/raw?url=',
        'https://api.codetabs.com/v1/proxy?quest='
    ];

    // 1) Gọi thẳng Tatoeba v1: nhanh nhất, không phụ thuộc proxy.
    let payload = await fetchWithTimeout(v1Url, { timeout: 5500 });
    let example = extractTatoebaExample(payload);
    if (example?.zh) { console.info('[Tatoeba] Tìm thấy ví dụ (gọi thẳng v1):', example.zh); return example; }
    console.warn('[Tatoeba] Gọi thẳng v1 không có kết quả cho:', hanzi, '- thử qua proxy...');

    // 2) Nếu trình duyệt/network chặn CORS, thử v1 qua từng proxy.
    for (const proxy of proxies) {
        payload = await fetchWithTimeout(proxy + encodeURIComponent(v1Url), { timeout: 6500 });
        example = extractTatoebaExample(payload);
        if (example?.zh) { console.info(`[Tatoeba] Tìm thấy ví dụ (v1 qua ${proxy}):`, example.zh); return example; }
    }
    console.warn('[Tatoeba] v1 qua proxy cũng không có kết quả cho:', hanzi, '- thử API v0 cũ...');

    // 3) Fallback tương thích API v0 cũ (đã deprecated nhưng đôi khi vẫn còn hoạt động).
    payload = await fetchWithTimeout(proxies[0] + encodeURIComponent(v0Url), { timeout: 6500 });
    example = extractTatoebaExample(payload);
    if (example?.zh) { console.info('[Tatoeba] Tìm thấy ví dụ (v0 qua proxy):', example.zh); return example; }

    console.warn('[Tatoeba] Không tìm được ví dụ nào từ Tatoeba cho:', hanzi);
    return null;
}

async function translateText(text, targetLang) {
    const data = await fetchMyMemoryData(text, targetLang);
    return data?.responseData?.translatedText || '';
}

async function fetchMyMemoryData(text, targetLang) {
    if (!text) return null;

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=zh-CN|${targetLang}`;
    return await fetchWithTimeout(url, { timeout: 5000 });
}

// Dự phòng cuối cùng khi Tatoeba (cả v1 lẫn v0, cả gọi thẳng lẫn qua proxy) đều không có kết quả:
// tận dụng luôn dữ liệu "matches" mà MyMemory trả về lúc dịch nghĩa tiếng Anh (không tốn thêm request).
// MyMemory tổng hợp nhiều kho ngữ liệu song ngữ (bao gồm cả Tatoeba), nên "matches" thường
// có sẵn vài câu ví dụ đầy đủ chứa từ/cụm từ vừa tra.
function pickExampleFromMyMemoryMatches(hanziInput, myMemoryData) {
    const matches = myMemoryData?.matches;
    if (!Array.isArray(matches)) return null;

    const candidates = matches.filter(m =>
        m.segment && m.translation &&
        m.segment.includes(hanziInput) &&
        m.segment.trim().length > hanziInput.length && // dài hơn từ gốc -> nhiều khả năng là cả câu
        m.segment.trim().length <= 80 // tránh câu quá dài khi hiển thị trên thẻ từ vựng
    );
    if (candidates.length === 0) return null;

    // Ưu tiên kết quả có điểm chất lượng (quality) cao nhất
    candidates.sort((a, b) => (parseInt(b.quality) || 0) - (parseInt(a.quality) || 0));
    return { zh: candidates[0].segment.trim(), en: candidates[0].translation.trim() };
}

// Hàm ép kiểu: Tẩy rửa câu ví dụ, biến mọi chữ Phồn thể thành Giản thể
async function forceSimplified(text) {
    if (!text) return text;
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`;
        const response = await fetchWithTimeout(url, { timeout: 3000 });
        // Cấu trúc trả về của Google: [[[ "离开草坪！", "離開草坪!", ...]]]
        if (response && response[0]) {
            return response[0].map(s => s[0]).join('');
        }
    } catch (e) {
        console.warn("Lỗi ép giản thể, dùng text gốc:", e);
    }
    return text;
}


async function autoFill() {
    const hanziInput = document.getElementById('input-hanzi').value.trim();
    if (!hanziInput) {
        alert('Vui lòng nhập Chữ Hán trước!');
        return;
    }

    const btn = document.querySelector('button[onclick="autoFill()"]');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tìm...';
    btn.disabled = true;

    // Xóa ví dụ cũ để tránh giữ nhầm dữ liệu của từ trước.
    document.getElementById('input-example-zh').value = '';
    document.getElementById('input-example-en').value = '';

    try {
        // Pinyin chạy local, không phụ thuộc API.
        if (window.pinyinPro?.pinyin) {
            document.getElementById('input-pinyin').value = window.pinyinPro.pinyin(hanziInput);
        }

        // Dịch nghĩa + tìm ví dụ chạy song song. allSettled giúp một luồng lỗi
        // không làm hỏng những luồng còn lại.
        const [viResult, enDataResult, exampleResult] = await Promise.allSettled([
            translateText(hanziInput, 'vi'),
            fetchMyMemoryData(hanziInput, 'en'),
            getTatoebaExample(hanziInput)
        ]);

        const viText = viResult.status === 'fulfilled' ? viResult.value : '';
        const enData = enDataResult.status === 'fulfilled' ? enDataResult.value : null;
        const enText = enData?.responseData?.translatedText || '';
        let example = exampleResult.status === 'fulfilled' ? exampleResult.value : null;

        if (viText) document.getElementById('input-vi').value = viText;

                if (enText && enText !== hanziInput) {
            // Regex chặn nhiễu: Nếu có chữ Hán trong kết quả dịch EN -> Bỏ qua
            const hasChinese = /[\u4e00-\u9fa5]/.test(enText);
            if (!hasChinese) {
                document.getElementById('input-en').value = enText;

                let detectedType = 'Noun (Danh từ)';
                const lower = enText.toLowerCase().trim();
                if (lower.startsWith('to ')) detectedType = 'Verb (Động từ)';
                else if (lower.endsWith('ly')) detectedType = 'Adv (Trạng từ)';
                document.getElementById('input-type').value = detectedType;
            }
        }

        // ... (Giữ nguyên logic tìm example dự phòng từ MyMemory)

        if (example?.zh) {
            // Ép toàn bộ câu tiếng Trung sang Giản thể chuẩn trước khi hiển thị
            const simplifiedZh = await forceSimplified(example.zh);
            document.getElementById('input-example-zh').value = simplifiedZh;

            // Nếu ví dụ tìm được thiếu bản dịch EN, dịch chính câu đó bằng MyMemory.
            let exampleEn = example.en || '';
            if (!exampleEn) {
                exampleEn = await translateText(simplifiedZh, 'en'); 
            }
            document.getElementById('input-example-en').value = exampleEn;
        } else {
            console.warn('Không tìm thấy câu ví dụ nào cho:', hanziInput);
        }


    } catch (error) {
        console.error('AutoFill error:', error);
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
        type: document.getElementById('input-type').value.trim() || 'Noun',
        enDef: document.getElementById('input-en').value.trim(),
        viDef: document.getElementById('input-vi').value.trim(),
        example_zh: document.getElementById('input-example-zh').value.trim(),
        example_en: document.getElementById('input-example-en').value.trim(),
        isMastered: false, 
        nextReview: Date.now() 
    };
    
    vocabList.unshift(newWord); 
    this.reset(); 
    
    playAudio(newWord.hanzi);
    alert('Thêm từ thành công!');

    const { error } = await supabaseClient.from('vocab').insert([newWord]);
    if (error) console.error("Lỗi:", error);
});

function openEditModal(id) {
    const word = vocabList.find(w => w.id === id);
    if(!word) return;
    document.getElementById('edit-id').value = word.id;
    document.getElementById('edit-hanzi').value = word.hanzi;
    document.getElementById('edit-pinyin').value = word.pinyin;
    document.getElementById('edit-type').value = word.type || "";
    document.getElementById('edit-en').value = word.enDef || "";
    document.getElementById('edit-vi').value = word.viDef || "";
    document.getElementById('edit-example-zh').value = word.example_zh || "";
    document.getElementById('edit-example-en').value = word.example_en || "";
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
    vocabList[index].type = document.getElementById('edit-type').value.trim();
    vocabList[index].enDef = document.getElementById('edit-en').value.trim();
    vocabList[index].viDef = document.getElementById('edit-vi').value.trim();
    vocabList[index].example_zh = document.getElementById('edit-example-zh').value.trim();
    vocabList[index].example_en = document.getElementById('edit-example-en').value.trim();

    closeEditModal();
    filterList('list'); 

    await supabaseClient.from('vocab').update({ 
        hanzi: vocabList[index].hanzi,
        pinyin: vocabList[index].pinyin,
        type: vocabList[index].type,
        "enDef": vocabList[index].enDef,
        "viDef": vocabList[index].viDef,
        example_zh: vocabList[index].example_zh,
        example_en: vocabList[index].example_en
    }).eq('id', id);
}

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
// 4. LOGIC ÔN TẬP (SRS & CHẶN HINT & HIỂN THỊ VÍ DỤ TÁCH BIỆT)
// ==========================================
let currentQuizWord = null;
let hintRevealed = 0; 

function startReview() {
    const now = Date.now();
    let dueWords = vocabList.filter(w => !w.isMastered && (!w.nextReview || w.nextReview <= now));

    document.getElementById('srs-controls').style.display = 'none';
    const reviewContainer = document.getElementById('review-container');

    if (dueWords.length === 0) {
        reviewContainer.innerHTML = `<h3 style="color:#34a853; text-align:center; background:white; padding:20px; border-radius:12px;">Tuyệt vời! Bạn đã hoàn thành các từ cần ôn lúc này.</h3>`;
        document.getElementById('default-controls').style.display = 'none';
        return;
    }

    document.getElementById('default-controls').style.display = 'block';
    const randomIndex = Math.floor(Math.random() * dueWords.length);
    currentQuizWord = dueWords[randomIndex];
    hintRevealed = 0; 
    
    let displayQuestion = currentQuizWord.enDef ? currentQuizWord.enDef : "<i>(Chưa có nghĩa tiếng Anh)</i>";
    let displayType = currentQuizWord.type ? `<span style="display: block; font-size: 14px; color: #6c757d; background: #f1f3f5; padding: 4px 12px; border-radius: 8px; width: fit-content; margin: 10px auto 0 auto; line-height: 1.4; font-weight: 500;">${currentQuizWord.type}</span>` : '';

    reviewContainer.innerHTML = `
        <div style="text-align: right; color: #868e96; font-size: 15px; font-weight: bold; margin-bottom: 10px; background: #f8f9fa; padding: 5px 10px; border-radius: 8px; display: inline-block; float: right;">
            <i class="fas fa-layer-group"></i> Còn lại: <span style="color: #ea4335; font-size: 18px;">${dueWords.length}</span> từ
        </div>
        <div style="clear: both;"></div>

        <h3 id="quiz-title" style="margin-bottom: 20px;">
            <span style="display: block; color: #868e96; font-size: 16px; margin-bottom: 5px; font-weight: normal;">English Definition:</span>
            <span style="color: #4285f4; font-size: 28px;">${displayQuestion}</span>
            ${displayType}
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
    if (document.getElementById('action-buttons').style.display === 'none') return;
    
    hintRevealed++;
    const pinyin = currentQuizWord.pinyin; 
    if (hintRevealed > pinyin.length) hintRevealed = pinyin.length;
    
    const revealedText = pinyin.substring(0, hintRevealed);
    const hiddenText = '*'.repeat(pinyin.length - hintRevealed);
    
    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; gap: 10px; color: #f29900;">
            <span>Gợi ý Pinyin: <strong style="letter-spacing: 3px;">${revealedText}${hiddenText}</strong></span>
            <button type="button" onclick="playAudio('${currentQuizWord.hanzi}')" tabindex="-1" style="background: #e9ecef; border: none; border-radius: 50%; width: 28px; height: 28px; cursor: pointer; color: #495057; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
                <i class="fas fa-volume-up" style="font-size: 12px;"></i>
            </button>
        </div>
    `;
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
    
    // Khối Ví dụ Mới ở tab Ôn tập
    const exampleBox = (currentQuizWord.example_zh || currentQuizWord.example_en) ? `
        <div style="margin-top: 10px; padding: 12px; background: #e3f2fd; border-radius: 8px; font-size: 14.5px; text-align: left; line-height: 1.5; border-left: 4px solid #4285f4;">
            <div style="color: #0d47a1; font-weight: bold; margin-bottom: 5px;">📖 ${currentQuizWord.example_zh || ''}</div>
            <div style="color: #495057; font-style: italic;">${currentQuizWord.example_en || ''}</div>
        </div>
    ` : '';

    return `
        ${title} <strong style="font-size: 20px;">${currentQuizWord.hanzi}</strong> (${currentQuizWord.pinyin})<br>
        <div style="margin-top: 10px; background: #f8f9fa; padding: 10px; border-radius: 8px;">
            <span style="color: #2b3a55; font-size: 16px; font-weight: 600;">🇻🇳 Nghĩa VN: ${currentQuizWord.viDef}</span>
        </div>
        ${exampleBox}
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
    
    const getRandomTime = (minDays, maxDays) => {
        const minMs = minDays * 24 * 60 * 60 * 1000;
        const maxMs = maxDays * 24 * 60 * 60 * 1000;
        return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    };
    
    if (level === 1) currentQuizWord.nextReview = now + 30 * 60 * 1000; 
    else if (level === 2) currentQuizWord.nextReview = now + getRandomTime(1, 2); 
    else if (level === 3) currentQuizWord.nextReview = now + getRandomTime(3, 5); 
    else if (level === 4) currentQuizWord.nextReview = now + getRandomTime(5, 7); 
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