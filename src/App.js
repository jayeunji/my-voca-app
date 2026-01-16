import React, { useState, useEffect } from 'react';
import './App.css';

// --- [유틸리티] 날짜 계산 함수 ---
const getNextDate = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date.getTime();
};

const getToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.getTime();
};

const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

function App() {
  // --- State 관리 ---
  const [chapters, setChapters] = useState(() => {
    const saved = localStorage.getItem('myVocaChapters');
    return saved ? JSON.parse(saved) : {};
  });

  const [view, setView] = useState('home'); // home | study
  const [currentChapterName, setCurrentChapterName] = useState('');
  
  // 학습용 데이터
  const [studyList, setStudyList] = useState([]);       
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  
  // 틀린 단어 관리 (재도전용)
  const [sessionWrongWords, setSessionWrongWords] = useState([]);

  // --- 저장 (Effect) ---
  useEffect(() => {
    localStorage.setItem('myVocaChapters', JSON.stringify(chapters));
  }, [chapters]);


  // --- [핵심] 단어 상태 업데이트 로직 ---
  const updateWordStats = (wordId, isCorrect) => {
    setChapters(prevChapters => {
      const newChapters = { ...prevChapters };
      const today = getToday();

      for (const chapterName in newChapters) {
        const words = newChapters[chapterName];
        const wordIndex = words.findIndex(w => w.id === wordId);
        
        if (wordIndex !== -1) {
          const word = words[wordIndex];
          const currentLevel = word.level || 0;
          const lastReviewed = word.lastReviewed || 0;

          // 오늘 이미 학습한 단어 처리 (중복 레벨업 방지)
          if (lastReviewed === today) {
            if (isCorrect) break;
          }

          let nextLevel = 0;
          let nextDate = 0;

          if (isCorrect) {
            nextLevel = currentLevel + 1;
            const intervals = [1, 3, 7, 14, 30, 60];
            const daysToAdd = intervals[currentLevel] || 60; 
            nextDate = getNextDate(daysToAdd);
          } else {
            nextLevel = 0;
            nextDate = getNextDate(1);
          }

          newChapters[chapterName][wordIndex] = {
            ...word,
            level: nextLevel,
            nextReviewDate: nextDate,
            lastReviewed: today
          };
          break; 
        }
      }
      return newChapters;
    });
  };

  // --- 기능: 상태 원상 복구 (Undo용) ---
  const restoreWord = (originalWord) => {
    setChapters(prev => {
      const newChapters = { ...prev };
      for (const name in newChapters) {
        const idx = newChapters[name].findIndex(w => w.id === originalWord.id);
        if (idx !== -1) {
          newChapters[name][idx] = { ...originalWord };
          break;
        }
      }
      return newChapters;
    });
  };

  // --- 기능: 뒤로가기 (Undo) 핸들러 ---
  const handleUndo = (e) => {
    e.stopPropagation(); 
    if (currentIndex === 0) return; 

    const prevIndex = currentIndex - 1;
    const prevWord = studyList[prevIndex];

    restoreWord(prevWord);
    setSessionWrongWords(prev => prev.filter(w => w.id !== prevWord.id));

    setCurrentIndex(prevIndex);
    setIsFlipped(false);
    setIsFinished(false); 
  };

  // --- 오늘의 복습 단어 모으기 ---
  const getTodayReviewWords = () => {
    const today = getToday();
    let allReviewWords = [];
    Object.values(chapters).forEach(chapterWords => {
      const dueWords = chapterWords.filter(word => {
        if (!word.nextReviewDate) return false;
        return word.nextReviewDate <= today;
      });
      allReviewWords = [...allReviewWords, ...dueWords];
    });
    return allReviewWords;
  };

  const startTodayReview = () => {
    const reviewList = getTodayReviewWords();
    if (reviewList.length === 0) {
      alert("오늘 복습할 단어가 없습니다! 🎉");
      return;
    }
    startSession(`오늘의 복습 (${reviewList.length}단어)`, reviewList);
  };

  // --- [NEW] 미암기 단어 학습 (챕터별 최고 레벨 기준) ---
  const startWeakStudy = (e, name) => {
    e.stopPropagation();
    
    const chapterWords = chapters[name];
    if (!chapterWords || chapterWords.length === 0) return;

    const maxLevel = Math.max(...chapterWords.map(w => w.level || 0), 0);
    const threshold = maxLevel === 0 ? 1 : maxLevel;
    const weakWords = chapterWords.filter(w => (w.level || 0) < threshold);
    
    if (weakWords.length === 0) {
      alert(`🎉 대단해요! 모든 단어가 현재 최고 레벨(Lv.${maxLevel})에 도달했습니다.`);
      return;
    }
    
    startSession(`${name} (약점 보완)`, weakWords);
  };

  const startChapterStudy = (name) => {
    startSession(name, chapters[name]);
  };

  // 학습 세션 시작 공통 함수
  const startSession = (title, list) => {
    setCurrentChapterName(title);
    setStudyList(shuffleArray(list));
    setCurrentIndex(0);
    setSessionWrongWords([]); 
    setIsFlipped(false);
    setIsFinished(false);
    setView('study');
  };

  // 틀린 단어 재학습
  const retryWrongWords = () => {
    if (!currentChapterName.includes('(재도전)')) {
      setCurrentChapterName(`${currentChapterName} (재도전)`);
    }
    
    setStudyList(shuffleArray(sessionWrongWords));
    setCurrentIndex(0);
    setSessionWrongWords([]); 
    setIsFlipped(false);
    setIsFinished(false);
  };

  // --- 기능: 파일 업로드 (발음 기호 파싱 포함) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const lines = event.target.result.split('\n');
      const newWords = [];
      lines.forEach((line, index) => {
        if (!line.trim() || !line.includes('|')) return;
        const parts = line.split('|');
        
        let rawEnglish = parts[0].trim();
        let englishWord = rawEnglish;
        let pronunciation = '';

        const match = rawEnglish.match(/^(.+?)(\[.*\])$/);
        if (match) {
          englishWord = match[1].trim(); 
          pronunciation = match[2].trim(); 
        }

        newWords.push({
          id: Date.now() + index,
          en: englishWord,
          pronunciation: pronunciation,
          ko: parts.slice(1).join('|').trim(),
          level: 0,
          nextReviewDate: 0 
        });
      });

      if (newWords.length > 0) {
        const numInput = prompt("챕터 번호를 입력하세요 (예: 1):", Object.keys(chapters).length + 1);
        
        if (numInput && numInput.trim()) {
          const name = `Chapter ${numInput.trim()}`;
          setChapters(prev => ({ ...prev, [name]: newWords }));
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const deleteChapter = (e, name) => {
    e.stopPropagation();
    if (window.confirm("삭제하시겠습니까?")) {
      setChapters(prev => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const handleCardClick = () => setIsFlipped(!isFlipped);

  const handleAnswer = (isKnown) => {
    const currentWord = studyList[currentIndex];
    if (!isKnown) {
      setSessionWrongWords(prev => {
        if (prev.find(w => w.id === currentWord.id)) {
          return prev;
        }
        return [...prev, currentWord];
      });
    }
    updateWordStats(currentWord.id, isKnown);

    if (currentIndex + 1 < studyList.length) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex + 1), 150);
    } else {
      setIsFinished(true);
    }
  };

  // --- 렌더링 ---
  if (view === 'home') {
    const todayCount = getTodayReviewWords().length;

    const sortedChapterNames = Object.keys(chapters).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });

    return (
      <div className="container">
        <h1 style={{marginBottom: '20px', color: '#333'}}>내 단어장 📚</h1>
        
        <div className="review-btn-wrapper">
          <button 
            onClick={startTodayReview}
            className={`review-btn ${todayCount > 0 ? 'pulse-animation' : ''}`}
            style={{
              backgroundColor: todayCount > 0 ? '#ff6b6b' : '#4dabf7',
            }}
          >
            🔥 오늘의 복습 ({todayCount}개)
          </button>
          {todayCount === 0 && <p className="review-msg">완벽해요! 오늘 할 복습을 끝냈습니다.</p>}
        </div>

        <div className="file-controls">
          <label className="file-btn">
            <span>➕</span> 새 챕터 추가하기 (txt 파일)
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden-input" />
          </label>
        </div>

        <div className="chapter-list">
          {sortedChapterNames.length === 0 ? (
            <p style={{color: '#999', textAlign:'center'}}>저장된 챕터가 없습니다.<br/>위 버튼을 눌러 파일을 추가해주세요.</p>
          ) : (
            sortedChapterNames.map(name => {
              const chapterWords = chapters[name];
              const maxLevel = Math.max(...chapterWords.map(w => w.level || 0), 0);
              const threshold = maxLevel === 0 ? 1 : maxLevel;
              const weakCount = chapterWords.filter(w => (w.level || 0) < threshold).length;
              
              return (
                <div key={name} className="chapter-item" onClick={() => startChapterStudy(name)}>
                  <span className="chapter-name">{name}</span>
                  <span className="chapter-count">({chapters[name].length})</span>
                  
                  <div className="chapter-actions">
                    <button 
                      onClick={(e) => startWeakStudy(e, name)}
                      className="weak-study-btn"
                      title={`현재 최고 레벨(Lv.${maxLevel}) 미만인 단어만 학습`}
                      disabled={weakCount === 0}
                    >
                      미암기({weakCount})
                    </button>

                    <button className="delete-btn" onClick={(e) => deleteChapter(e, name)}>🗑️</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (isFinished) {
    return (
      <div className="container">
        <div className="result-area">
          <h2>학습 완료! 🎉</h2>
          
          {sessionWrongWords.length > 0 ? (
            <>
              <p className="result-text">
                앗, <span className="result-count">{sessionWrongWords.length}개</span>를 틀렸네요.
              </p>
              <button className="action-btn" style={{backgroundColor: '#ff6b6b'}} onClick={retryWrongWords}>
                💪 틀린 단어 다시 학습하기
              </button>
            </>
          ) : (
            <p className="result-perfect">
              완벽합니다! 모든 단어를 맞췄어요. 💯
            </p>
          )}

          <div className="result-actions">
             <button className="action-btn" onClick={() => setView('home')}>목록으로 나가기</button>
          </div>
        </div>
      </div>
    );
  }

  // --- 학습 화면 렌더링 ---
  const currentStudyItem = studyList[currentIndex];
  let currentWord = currentStudyItem;
  if (currentStudyItem) {
    for (const name in chapters) {
      const found = chapters[name].find(w => w.id === currentStudyItem.id);
      if (found) {
        currentWord = found; 
        break;
      }
    }
  }

  if (!currentWord) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <div className="study-header">
        <div className="header-top-row">
          <button onClick={() => setView('home')} className="home-icon-btn">🏠</button>
          <span className="chapter-title">{currentChapterName}</span>
          <div style={{width: '30px'}}></div> 
        </div>
        <div className="header-progress">
          {currentIndex + 1} / {studyList.length}
        </div>
      </div>

      <div className="card-area" onClick={handleCardClick}>
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
          <div className="card-front">
            {/* 단어 */}
            <div className="card-word">{currentWord.en}</div>
            
            {/* 발음 표기 (있을 경우에만) */}
            {currentWord.pronunciation && (
              <div className="card-pronunciation">
                {currentWord.pronunciation}
              </div>
            )}

            {/* 현재 레벨 */}
            <div className="card-level">
              Lv.{currentWord.level || 0}
            </div>
          </div>
          <div className="card-back">{currentWord.ko}</div>
        </div>
      </div>
      
      <div className="undo-wrapper">
        <button 
          onClick={handleUndo} 
          className="undo-btn"
          disabled={currentIndex === 0}
        >
          ↩️ 잘못 눌렀어요 (뒤로가기)
        </button>
      </div>

      <div className="buttons">
        <button className="btn btn-x" onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}>X</button>
        <button className="btn btn-o" onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}>O</button>
      </div>
    </div>
  );
}

export default App;