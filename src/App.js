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
            // 틀렸으면(X)? -> 아까 맞췄든 말든 가차 없이 레벨 0으로 초기화
          }

          let nextLevel = 0;
          let nextDate = 0;

          if (isCorrect) {
            // 정답 & 오늘 첫 시도: 레벨 업
            nextLevel = currentLevel + 1;
            const intervals = [1, 3, 7, 14, 30, 60];
            const daysToAdd = intervals[currentLevel] || 60; 
            nextDate = getNextDate(daysToAdd);
          } else {
            // 오답: 레벨 초기화 & 내일 다시
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
          // 학습 전 상태(originalWord)로 데이터를 덮어씌움
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
    const prevWord = studyList[prevIndex]; // 학습 전 상태가 담긴 스냅샷

    // 1. DB 상태 복구 (레벨, 날짜 등)
    restoreWord(prevWord);

    // 2. 이번 세션 오답 노트에서 제거 (만약 아까 틀렸다고 했었다면)
    setSessionWrongWords(prev => prev.filter(w => w.id !== prevWord.id));

    // 3. 인덱스 되돌리기 & 카드 앞면으로
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

    // 1. 이 챕터의 최고 레벨 구하기
    const maxLevel = Math.max(...chapterWords.map(w => w.level || 0), 0);
    
    // 2. 필터 기준 설정
    // - 최고 레벨이 0(모두 새 단어)이면 기준을 1로 잡아서 다 나오게 함
    // - 그 외엔 최고 레벨보다 낮은 단어(뒤처진 단어)만 필터링
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
    setSessionWrongWords([]); // 새 세션 시작 시 오답 초기화
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

  // --- 기능: 파일 업로드 (숫자만 입력) ---
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
        newWords.push({
          id: Date.now() + index,
          en: parts[0].trim(),
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
    // 오답 노트 추가 (중복 방지)
    if (!isKnown) {
      setSessionWrongWords(prev => {
        if (prev.find(w => w.id === currentWord.id)) {
          return prev;
        }
        return [...prev, currentWord];
      });
    }
    // DB 업데이트
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

    // 챕터 목록 정렬 (숫자 기준 오름차순)
    const sortedChapterNames = Object.keys(chapters).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });

    return (
      <div className="container">
        <h1 style={{marginBottom: '20px', color: '#333'}}>내 단어장 📚</h1>
        
        <div style={{width: '100%', maxWidth: '400px', marginBottom: '20px'}}>
          <button 
            onClick={startTodayReview}
            className="review-btn"
            style={{
              width: '100%', 
              padding: '15px', 
              borderRadius: '12px',
              border: 'none',
              backgroundColor: todayCount > 0 ? '#ff6b6b' : '#4dabf7',
              color: 'white',
              fontSize: '1.1rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              animation: todayCount > 0 ? 'pulse 2s infinite' : 'none'
            }}
          >
            🔥 오늘의 복습 ({todayCount}개)
          </button>
          {todayCount === 0 && <p style={{textAlign:'center', fontSize:'0.8rem', color:'#888', marginTop:'5px'}}>완벽해요! 오늘 할 복습을 끝냈습니다.</p>}
        </div>

        <div className="file-controls">
          <label className="file-btn" style={{width: '90%', maxWidth: '350px', justifyContent: 'center', padding: '15px', margin: '0 auto'}}>
            <span>➕</span> 새 챕터 추가하기 (txt 파일)
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden-input" />
          </label>
        </div>

        <div className="chapter-list">
          {sortedChapterNames.length === 0 ? (
            <p style={{color: '#999', textAlign:'center'}}>저장된 챕터가 없습니다.<br/>위 버튼을 눌러 파일을 추가해주세요.</p>
          ) : (
            sortedChapterNames.map(name => {
              // [UI Logic] 버튼에 표시할 숫자 계산 (함수 내부 로직과 동일하게)
              const chapterWords = chapters[name];
              const maxLevel = Math.max(...chapterWords.map(w => w.level || 0), 0);
              const threshold = maxLevel === 0 ? 1 : maxLevel;
              const weakCount = chapterWords.filter(w => (w.level || 0) < threshold).length;
              
              return (
                <div key={name} className="chapter-item" onClick={() => startChapterStudy(name)}>
                  <span className="chapter-name">{name}</span>
                  <span className="chapter-count">({chapters[name].length})</span>
                  
                  <div style={{marginLeft: 'auto', display: 'flex', gap: '8px'}}>
                    {/* [NEW] 미암기 학습 버튼 */}
                    <button 
                      onClick={(e) => startWeakStudy(e, name)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: '#ff9800', 
                        color: 'white',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        opacity: weakCount === 0 ? 0.5 : 1 // 할 게 없으면 흐리게 표시
                      }}
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
              <p style={{fontSize: '1.1rem', margin: '20px 0'}}>
                앗, <span style={{color:'red', fontWeight:'bold'}}>{sessionWrongWords.length}개</span>를 틀렸네요.
              </p>
              <button className="action-btn" style={{backgroundColor: '#ff6b6b'}} onClick={retryWrongWords}>
                💪 틀린 단어 다시 학습하기
              </button>
            </>
          ) : (
            <p style={{fontSize: '1.1rem', margin: '20px 0', color: '#4caf50', fontWeight: 'bold'}}>
              완벽합니다! 모든 단어를 맞췄어요. 💯
            </p>
          )}

          <div style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
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
          <span className="chapter-title" style={{fontSize: '1rem'}}>{currentChapterName}</span>
          <div style={{width: '30px'}}></div> 
        </div>
        <div className="header-progress">
          {currentIndex + 1} / {studyList.length}
        </div>
      </div>

      <div className="card-area" onClick={handleCardClick}>
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
          <div className="card-front">
            {currentWord.en}
            <div style={{position:'absolute', bottom:'10px', fontSize:'0.8rem', color:'#ccc'}}>
              Lv.{currentWord.level || 0}
            </div>
          </div>
          <div className="card-back">{currentWord.ko}</div>
        </div>
      </div>
      
      <div style={{width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '10px'}}>
        <button 
          onClick={handleUndo} 
          style={{
            background: 'none', 
            border: 'none', 
            color: currentIndex > 0 ? '#666' : '#ccc', 
            cursor: currentIndex > 0 ? 'pointer' : 'default',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}
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