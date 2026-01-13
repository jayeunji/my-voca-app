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
  
  // 틀린 단어 관리
  const [sessionWrongWords, setSessionWrongWords] = useState([]);

  // --- 저장 (Effect) ---
  useEffect(() => {
    localStorage.setItem('myVocaChapters', JSON.stringify(chapters));
  }, [chapters]);


  // --- 단어 상태 업데이트 로직 ---
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

          // 오늘 이미 학습한 단어 처리
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

  const startChapterStudy = (name) => {
    startSession(name, chapters[name]);
  };

  const startSession = (title, list) => {
    setCurrentChapterName(title);
    setStudyList(shuffleArray(list));
    setCurrentIndex(0);
    setSessionWrongWords([]);
    setIsFlipped(false);
    setIsFinished(false);
    setView('study');
  };

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

  // --- 기능: 파일 업로드 (수정됨: 숫자만 입력받음) ---
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
        // ★ 수정 1: 숫자만 입력받기
        const numInput = prompt("챕터 번호를 입력하세요 (예: 1):", Object.keys(chapters).length + 1);
        
        if (numInput && numInput.trim()) {
          // 입력받은 숫자에 'Chapter '를 붙여서 저장
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

    // ★ 수정 2: 챕터 목록 정렬하기 (숫자 기준 오름차순)
    // 1. 키들을 배열로 가져옴
    // 2. 숫자만 추출해서 비교 (Chapter 1, Chapter 2, Chapter 10 순서)
    const sortedChapterNames = Object.keys(chapters).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0; // 숫자 아닌 문자 제거 후 정수 변환
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB; // 오름차순 정렬
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
            // 정렬된 이름 목록으로 렌더링
            sortedChapterNames.map(name => (
              <div key={name} className="chapter-item" onClick={() => startChapterStudy(name)}>
                <span className="chapter-name">{name}</span>
                <span className="chapter-count">({chapters[name].length})</span>
                <button className="delete-btn" onClick={(e) => deleteChapter(e, name)}>🗑️</button>
              </div>
            ))
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

  const currentWord = studyList[currentIndex];
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
      
      <p style={{ color: '#888', marginBottom: '30px', fontSize: '0.9rem' }}>터치하여 뒤집기</p>

      <div className="buttons">
        <button className="btn btn-x" onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}>X</button>
        <button className="btn btn-o" onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}>O</button>
      </div>
    </div>
  );
}

export default App;