import React, { useState, useEffect } from 'react';
import './App.css';

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

// --- [NEW] TTS(음성 합성) 함수 ---
const speak = (text) => {
  if (!window.speechSynthesis) {
    alert("이 브라우저는 음성 합성을 지원하지 않습니다.");
    return;
  }
  // 진행 중인 음성이 있다면 취소 (연타 방지)
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US'; // 영어 발음 설정
  utterance.rate = 0.9;     // 속도 (1이 기본, 0.9는 약간 또박또박)
  utterance.pitch = 1;      // 톤

  window.speechSynthesis.speak(utterance);
};

function App() {
  const [chapters, setChapters] = useState(() => {
    const saved = localStorage.getItem('myVocaChapters');
    return saved ? JSON.parse(saved) : {};
  });

  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('home');
  const [currentChapterName, setCurrentChapterName] = useState('');

  const [studyList, setStudyList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionWrongWords, setSessionWrongWords] = useState([]);

  // 뜻 가리기 관련 State
  const [isMeaningsHidden, setIsMeaningsHidden] = useState(false);
  const [revealedWordIds, setRevealedWordIds] = useState([]);

  useEffect(() => {
    localStorage.setItem('myVocaChapters', JSON.stringify(chapters));
  }, [chapters]);

  const toggleMeaningsMode = () => {
    if (!isMeaningsHidden) {
      setRevealedWordIds([]);
    }
    setIsMeaningsHidden(!isMeaningsHidden);
  };

  const revealWord = (id) => {
    if (isMeaningsHidden && !revealedWordIds.includes(id)) {
      setRevealedWordIds([...revealedWordIds, id]);
    }
  };

  const toggleBookmark = (wordId) => {
    setChapters(prev => {
      const newChapters = { ...prev };
      for (const name in newChapters) {
        const words = newChapters[name];
        const wordIndex = words.findIndex(w => w.id === wordId);
        if (wordIndex !== -1) {
          const newWords = [...words];
          newWords[wordIndex] = {
            ...newWords[wordIndex],
            isBookmarked: !newWords[wordIndex].isBookmarked
          };
          newChapters[name] = newWords;
          break;
        }
      }
      return newChapters;
    });
  };

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

          if (lastReviewed === today && isCorrect) break;

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

          const newWords = [...words];
          newWords[wordIndex] = {
            ...word,
            level: nextLevel,
            nextReviewDate: nextDate,
            lastReviewed: today
          };
          newChapters[chapterName] = newWords;
          break;
        }
      }
      return newChapters;
    });
  };

  const handleUndo = (e) => {
    e.stopPropagation();
    if (currentIndex === 0) return;
    const prevIndex = currentIndex - 1;
    setCurrentIndex(prevIndex);
    setIsFlipped(false);
    setIsFinished(false);
    setSessionWrongWords(prev => {
      const prevWord = studyList[prevIndex];
      return prev.filter(w => w.id !== prevWord.id);
    });
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

  const startBookmarkStudy = () => {
    const bookmarkedWords = Object.values(chapters).flat().filter(w => w.isBookmarked);
    if (bookmarkedWords.length === 0) {
      alert("북마크한 단어가 없습니다.");
      return;
    }
    startSession("내 단어장", bookmarkedWords);
  };

  const startChapterBookmarkStudy = () => {
    const chapterWords = chapters[currentChapterName] || [];
    const bookmarkedWords = chapterWords.filter(w => w.isBookmarked);

    if (bookmarkedWords.length === 0) {
      alert("이 챕터에는 북마크된 단어가 없습니다.\n단어 옆의 별표(☆)를 눌러 북마크해주세요!");
      return;
    }
    startSession(`${currentChapterName} (북마크)`, bookmarkedWords);
  };

  const startWeakStudy = (e, name) => {
    e.stopPropagation();
    const chapterWords = chapters[name];
    if (!chapterWords || chapterWords.length === 0) return;

    const maxLevel = Math.max(...chapterWords.map(w => w.level || 0), 0);
    const threshold = maxLevel === 0 ? 1 : maxLevel;
    const weakWords = chapterWords.filter(w => (w.level || 0) < threshold);

    if (weakWords.length === 0) {
      alert(`모든 단어가 현재 최고 레벨(Lv.${maxLevel})에 도달했습니다.`);
      return;
    }
    startSession(`${name} (약점 보완)`, weakWords);
  };

  const openChapterDetail = (e, name) => {
    e.stopPropagation();
    setCurrentChapterName(name);
    setIsMeaningsHidden(false); 
    setRevealedWordIds([]);
    setView('chapter_detail');
  };

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
          nextReviewDate: 0,
          isBookmarked: false
        });
      });

      if (newWords.length > 0) {
        const numInput = prompt("챕터 번호를 입력하세요:", Object.keys(chapters).length + 1);
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
        if (prev.find(w => w.id === currentWord.id)) return prev;
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

  const retryWrongWords = () => {
    startSession(`${currentChapterName}`, sessionWrongWords);
  };

  if (view === 'study') {
    if (isFinished) {
      return (
        <div className="container">
          <div className="result-area">
            <h2>학습 완료! 🎉</h2>
            {sessionWrongWords.length > 0 ? (
              <>
                <p className="result-text">앗, <span className="result-count">{sessionWrongWords.length}개</span>를 틀렸네요.</p>
                <button className="action-btn wrong-btn" onClick={retryWrongWords}>💪 틀린 단어 다시 학습하기</button>
              </>
            ) : (
              <p className="result-perfect">완벽합니다! 모든 단어를 맞췄어요. 💯</p>
            )}
            <div className="result-actions">
              <button className="action-btn" onClick={() => setView('home')}>목록으로 나가기</button>
            </div>
          </div>
        </div>
      );
    }

    const currentStudyItem = studyList[currentIndex];
    let currentWord = currentStudyItem;
    if (currentStudyItem) {
      for (const name in chapters) {
        const found = chapters[name].find(w => w.id === currentStudyItem.id);
        if (found) { currentWord = found; break; }
      }
    }
    if (!currentWord) return <div className="container">Loading...</div>;

    return (
      <div className="container">
        <div className="study-header">
          <div className="header-top-row">
            <button onClick={() => setView('home')} className="home-icon-btn">🏠</button>
            <span className="chapter-title">{currentChapterName}</span>
            <div className="spacer"></div>
          </div>
          <div className="header-progress">{currentIndex + 1} / {studyList.length}</div>
        </div>

        <div className="card-area" onClick={handleCardClick}>
          {/* 북마크 버튼 */}
          <button 
            className={`card-bookmark-btn ${currentWord.isBookmarked ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark(currentWord.id);
            }}
          >
            {currentWord.isBookmarked ? '★' : '☆'}
          </button>

          {/* [NEW] 스피커(듣기) 버튼 (카드 왼쪽 상단) */}
          <button 
            className="card-speak-btn"
            onClick={(e) => {
              e.stopPropagation();
              speak(currentWord.en);
            }}
          >
            🔊
          </button>

          <div className={`card ${isFlipped ? 'flipped' : ''}`}>
            <div className="card-front">
              <div className="card-word">{currentWord.en}</div>
              {currentWord.pronunciation && <div className="card-pronunciation">{currentWord.pronunciation}</div>}
              <div className="card-level">Lv.{currentWord.level || 0}</div>
            </div>
            <div className="card-back">
              {currentWord.ko}
            </div>
          </div>
        </div>

        <div className="undo-wrapper">
          <button onClick={handleUndo} className="undo-btn" disabled={currentIndex === 0}>↩️ 뒤로가기</button>
        </div>
        <div className="buttons">
          <button className="btn btn-x" onClick={(e) => { e.stopPropagation(); handleAnswer(false); }}>X</button>
          <button className="btn btn-o" onClick={(e) => { e.stopPropagation(); handleAnswer(true); }}>O</button>
        </div>
      </div>
    );
  }

  // --- [챕터 상세 보기 화면] ---
  if (view === 'chapter_detail') {
    const words = chapters[currentChapterName] || [];
    const bookmarkedCount = words.filter(w => w.isBookmarked).length;

    return (
      <div className="container with-tabbar">
        <div className="list-header">
          <button onClick={() => setView('home')} className="back-btn">←</button>
          <h2>{currentChapterName}</h2>
          <button 
            className={`toggle-hide-btn ${isMeaningsHidden ? 'active' : ''}`} 
            onClick={toggleMeaningsMode}
          >
            {isMeaningsHidden ? '뜻 보이기' : '뜻 가리기'}
          </button>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '10px 0' }}>
          <button 
            className="chapter-bookmark-study-btn" 
            onClick={startChapterBookmarkStudy}
          >
            ⭐ 북마크 단어만 외우기 ({bookmarkedCount})
          </button>
        </div>

        <div className="word-list-container">
          {words.map(word => {
            const isHidden = isMeaningsHidden && !revealedWordIds.includes(word.id);
            
            return (
              <div key={word.id} className="word-list-item">
                <div className="word-info">
                  {/* [NEW] 단어 옆에 스피커 버튼 추가 */}
                  <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                    <span className="word-en">{word.en}</span>
                    <button 
                      className="list-speak-btn" 
                      onClick={(e) => { e.stopPropagation(); speak(word.en); }}
                    >
                      🔊
                    </button>
                  </div>
                  
                  {word.pronunciation && <span className="word-pro">{word.pronunciation}</span>}
                  
                  <span 
                    className={`word-ko ${isHidden ? 'hidden' : ''}`}
                    onClick={() => revealWord(word.id)}
                  >
                    {word.ko}
                  </span>
                </div>
                <button
                  className={`bookmark-btn ${word.isBookmarked ? 'active' : ''}`}
                  onClick={() => toggleBookmark(word.id)}
                >
                  {word.isBookmarked ? '★' : '☆'}
                </button>
              </div>
            );
          })}
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} setView={setView} />
      </div>
    );
  }

  // --- [메인 (홈/북마크)] ---
  return (
    <div className="container with-tabbar">
      {activeTab === 'bookmark' ? (
        <>
          <h1 className="main-title">내 단어장 ⭐</h1>
          <div className="bookmark-controls">
            <button className="bookmark-play-btn" onClick={startBookmarkStudy}>
              ▶ 랜덤 학습하기
            </button>
            <button 
              className={`toggle-hide-btn ${isMeaningsHidden ? 'active' : ''}`} 
              onClick={toggleMeaningsMode}
              style={{ marginLeft: '10px' }}
            >
              {isMeaningsHidden ? '뜻 가리기 해제' : '뜻 가리기'}
            </button>
          </div>

          <div className="word-list-container">
            {Object.values(chapters).flat().filter(w => w.isBookmarked).length === 0 ? (
              <p className="empty-msg">아직 북마크한 단어가 없어요.</p>
            ) : (
              Object.values(chapters).flat().filter(w => w.isBookmarked).map(word => {
                const isHidden = isMeaningsHidden && !revealedWordIds.includes(word.id);
                
                return (
                  <div key={word.id} className="word-list-item">
                    <div className="word-info">
                       {/* [NEW] 북마크 리스트에도 스피커 버튼 */}
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <span className="word-en">{word.en}</span>
                        <button 
                          className="list-speak-btn" 
                          onClick={(e) => { e.stopPropagation(); speak(word.en); }}
                        >
                          🔊
                        </button>
                      </div>

                      {word.pronunciation && <span className="word-pro">{word.pronunciation}</span>}
                      
                      <span 
                        className={`word-ko ${isHidden ? 'hidden' : ''}`}
                        onClick={() => revealWord(word.id)}
                      >
                        {word.ko}
                      </span>
                    </div>
                    <button
                      className="bookmark-btn active"
                      onClick={() => toggleBookmark(word.id)}
                    >
                      ★
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <h1 className="main-title">단어장 목록 📚</h1>
          <div className="file-controls">
            <label className="file-btn">
              <span>➕</span> 새 챕터 추가
              <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden-input" />
            </label>
          </div>
          <div className="chapter-list">
            {Object.keys(chapters).sort((a, b) => {
              const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
              const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
              return numA - numB;
            }).map(name => {
              const chapterWords = chapters[name];
              const maxLevel = Math.max(...chapterWords.map(w => w.level || 0), 0);
              const threshold = maxLevel === 0 ? 1 : maxLevel;
              const weakCount = chapterWords.filter(w => (w.level || 0) < threshold).length;

              return (
                <div key={name} className="chapter-row">
                  <button className="chapter-list-icon-btn" onClick={(e) => openChapterDetail(e, name)}>
                    <span className="doc-icon">📄</span>
                    <span className="doc-text">리스트</span>
                  </button>
                  <div className="chapter-card" onClick={() => startSession(name, chapters[name])}>
                    <div className="chapter-info">
                      <span className="chapter-name">{name}</span>
                      <span className="chapter-count">({chapters[name].length})</span>
                    </div>
                    <div className="chapter-actions">
                      <button
                        onClick={(e) => startWeakStudy(e, name)}
                        className="weak-study-btn"
                        disabled={weakCount === 0}
                      >
                        미암기({weakCount})
                      </button>
                      <button className="delete-btn" onClick={(e) => deleteChapter(e, name)}>🗑️</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} setView={setView} />
    </div>
  );
}

const BottomNav = ({ activeTab, setActiveTab, setView }) => {
  return (
    <div className="bottom-nav">
      <button
        className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
        onClick={() => { setActiveTab('home'); setView('home'); }}
      >
        <span className="nav-icon">🏠</span>
        <span className="nav-label">홈</span>
      </button>
      <button
        className={`nav-item ${activeTab === 'bookmark' ? 'active' : ''}`}
        onClick={() => { setActiveTab('bookmark'); setView('home'); }}
      >
        <span className="nav-icon">🏷️</span>
        <span className="nav-label">내 단어장</span>
      </button>
    </div>
  );
};

export default App;