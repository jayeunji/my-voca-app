import React, { useState, useEffect } from 'react';
import './App.css';

// --- [유틸리티] ---
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

  const [view, setView] = useState('home');
  const [activeTab, setActiveTab] = useState('home');
  const [currentChapterName, setCurrentChapterName] = useState('');

  const [studyList, setStudyList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [sessionWrongWords, setSessionWrongWords] = useState([]);

  useEffect(() => {
    localStorage.setItem('myVocaChapters', JSON.stringify(chapters));
  }, [chapters]);

  // --- [기능] 북마크 토글 ---
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

          if (lastReviewed === today && isCorrect) {
            break;
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

  // --- [NEW] 북마크 전체 학습 기능 ---
  const startBookmarkStudy = () => {
    // 모든 챕터를 뒤져서 북마크된 단어만 모음
    const bookmarkedWords = Object.values(chapters).flat().filter(w => w.isBookmarked);

    if (bookmarkedWords.length === 0) {
      alert("북마크한 단어가 없습니다! 단어 옆의 별표를 눌러 추가해주세요.");
      return;
    }

    startSession("내 단어장", bookmarkedWords);
  };

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

  const openChapterDetail = (e, name) => {
    e.stopPropagation();
    setCurrentChapterName(name);
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


  // --- 렌더링 ---

  if (view === 'study') {
    if (isFinished) {
      return (
        <div className="container">
          <div className="result-area">
            <h2>학습 완료! 🎉</h2>
            {sessionWrongWords.length > 0 ? (
              <>
                <p className="result-text">앗, <span className="result-count">{sessionWrongWords.length}개</span>를 틀렸네요.</p>
                <button className="action-btn" style={{ backgroundColor: '#ff6b6b' }} onClick={retryWrongWords}>💪 틀린 단어 다시 학습하기</button>
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
            <div style={{ width: '30px' }}></div>
          </div>
          <div className="header-progress">{currentIndex + 1} / {studyList.length}</div>
        </div>

        <div className="card-area" onClick={handleCardClick}>
          <div className={`card ${isFlipped ? 'flipped' : ''}`}>
            <div className="card-front">
              <button
                className={`card-bookmark-btn ${currentWord.isBookmarked ? 'active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(currentWord.id);
                }}
              >
                {currentWord.isBookmarked ? '★' : '☆'}
              </button>

              <div className="card-word">{currentWord.en}</div>
              {currentWord.pronunciation && <div className="card-pronunciation">{currentWord.pronunciation}</div>}
              <div className="card-level">Lv.{currentWord.level || 0}</div>
            </div>

            <div className="card-back">{currentWord.ko}</div>
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

  // 리스트 상세 보기
  if (view === 'chapter_detail') {
    const words = chapters[currentChapterName] || [];
    return (
      <div className="container with-tabbar">
        <div className="list-header">
          <button onClick={() => setView('home')} className="back-btn">←</button>
          <h2>{currentChapterName}</h2>
          <div style={{ width: '24px' }}></div>
        </div>
        <div className="word-list-container">
          {words.map(word => (
            <div key={word.id} className="word-list-item">
              <div className="word-info">
                <span className="word-en">{word.en}</span>
                {word.pronunciation && <span className="word-pro">{word.pronunciation}</span>}
                <span className="word-ko">{word.ko}</span>
              </div>
              <button
                className={`bookmark-btn ${word.isBookmarked ? 'active' : ''}`}
                onClick={() => toggleBookmark(word.id)}
              >
                {word.isBookmarked ? '★' : '☆'}
              </button>
            </div>
          ))}
        </div>
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} setView={setView} />
      </div>
    );
  }

  // 메인 (홈/북마크)
  return (
    <div className="container with-tabbar">
      {activeTab === 'bookmark' ? (
        <>
          <h1 className="main-title">내 단어장 ⭐</h1>

          {/* [NEW] 북마크 학습 버튼 영역 */}
          <div className="bookmark-controls">
            <button className="bookmark-play-btn" onClick={startBookmarkStudy}>
              ▶ 랜덤 학습하기
            </button>
          </div>

          <div className="word-list-container">
            {Object.values(chapters).flat().filter(w => w.isBookmarked).length === 0 ? (
              <p className="empty-msg">아직 북마크한 단어가 없어요.</p>
            ) : (
              Object.values(chapters).flat().filter(w => w.isBookmarked).map(word => (
                <div key={word.id} className="word-list-item">
                  <div className="word-info">
                    <span className="word-en">{word.en}</span>
                    {word.pronunciation && <span className="word-pro">{word.pronunciation}</span>}
                    <span className="word-ko">{word.ko}</span>
                  </div>
                  <button
                    className="bookmark-btn active"
                    onClick={() => toggleBookmark(word.id)}
                  >
                    ★
                  </button>
                </div>
              ))
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