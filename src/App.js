import React, { useState, useEffect } from 'react';
import './App.css';

// 유틸리티: 배열 섞기
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
  
  // 1. 전체 챕터 데이터 (Map 구조: { "챕터1": [단어들], "챕터2": [단어들] })
  const [chapters, setChapters] = useState(() => {
    // 앱 켜질 때 저장된 거 불러오기 (Java의 File Input Stream 역할)
    const saved = localStorage.getItem('myVocaChapters');
    return saved ? JSON.parse(saved) : {};
  });

  // 2. 화면 상태 ('home' | 'study')
  const [view, setView] = useState('home');

  // 3. 현재 학습 중인 데이터
  const [currentChapterName, setCurrentChapterName] = useState('');
  const [originalList, setOriginalList] = useState([]); // 순서 섞기 전 원본 (재학습용)
  const [studyList, setStudyList] = useState([]);       // 섞인 학습용
  
  // 4. 학습 진행 상태
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [wrongWords, setWrongWords] = useState([]);
  const [isFinished, setIsFinished] = useState(false);

  // --- 데이터 저장 (Effect) ---
  // chapters 상태가 바뀔 때마다 로컬 스토리지에 자동 저장
  useEffect(() => {
    localStorage.setItem('myVocaChapters', JSON.stringify(chapters));
  }, [chapters]);


  // --- 기능: 챕터 추가 (파일 업로드) ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const lines = text.split('\n');
      const newWords = [];
      
      lines.forEach((line, index) => {
        if (!line.trim() || !line.includes('|')) return;
        const parts = line.split('|');
        newWords.push({
          id: Date.now() + index,
          en: parts[0].trim(),
          ko: parts.slice(1).join('|').trim()
        });
      });

      if (newWords.length > 0) {
        // 챕터 이름 입력 받기
        const name = prompt("이 챕터의 이름을 입력하세요 (예: Day 1)", `Chapter ${Object.keys(chapters).length + 1}`);
        if (name) {
          // 기존 chapters 맵에 새로운 챕터 추가 (불변성 유지)
          setChapters(prev => ({
            ...prev,
            [name]: newWords
          }));
          alert(`[${name}] 챕터가 저장되었습니다!`);
        }
      } else {
        alert('형식이 올바르지 않습니다.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // 같은 파일 다시 업로드 가능하게 초기화
  };

  // --- 기능: 챕터 삭제 ---
  const deleteChapter = (e, name) => {
    e.stopPropagation(); // 부모 클릭 방지
    if (window.confirm(`[${name}] 챕터를 삭제하시겠습니까?`)) {
      setChapters(prev => {
        const newChapters = { ...prev };
        delete newChapters[name]; // Map에서 key 삭제
        return newChapters;
      });
    }
  };

  // --- 기능: 학습 시작 ---
  const startStudy = (name) => {
    const list = chapters[name];
    setCurrentChapterName(name);
    setOriginalList(list);          // 원본 기억
    setStudyList(shuffleArray(list)); // 랜덤 섞어서 시작
    setCurrentIndex(0);
    setWrongWords([]);
    setIsFlipped(false);
    setIsFinished(false);
    setView('study'); // 화면 전환
  };

  // --- 기능: 학습 도중 홈으로 ---
  const goHome = () => {
    if (window.confirm("학습을 종료하고 목록으로 돌아갈까요?")) {
      setView('home');
    }
  };

  // --- 기존 학습 로직 ---
  const handleCardClick = () => setIsFlipped(!isFlipped);

  const handleAnswer = (isKnown) => {
    const currentWord = studyList[currentIndex];
    if (!isKnown) setWrongWords(prev => [...prev, currentWord]);

    if (currentIndex + 1 < studyList.length) {
      setIsFlipped(false);
      setTimeout(() => setCurrentIndex(currentIndex + 1), 150);
    } else {
      setIsFinished(true);
    }
  };

  const restart = (mode) => {
    if (mode === 'all') setStudyList(shuffleArray(originalList));
    else if (mode === 'wrong') setStudyList(shuffleArray(wrongWords));
    
    setWrongWords([]);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
  };

  // ================= 렌더링 =================

  // [화면 1] 메인 홈 (챕터 목록)
  if (view === 'home') {
    return (
      <div className="container">
        <h1 style={{marginBottom: '30px', color: '#333'}}>내 단어장 📚</h1>
        
        {/* 파일 업로드 버튼 */}
        <div className="file-controls">
          <label className="file-btn" style={{
            width: '90%',
            maxWidth: '370px',
            justifyContent: 'center', 
            padding: '15px',
            margin: '0 auto'
          }}>
            <span>➕</span> 새 챕터 추가하기 (txt 파일)
            <input type="file" accept=".txt" onChange={handleFileUpload} className="hidden-input" />
          </label>
        </div>

        {/* 챕터 리스트 */}
        <div className="chapter-list">
          {Object.keys(chapters).length === 0 ? (
            <p style={{color: '#999'}}>저장된 챕터가 없습니다.</p>
          ) : (
            Object.keys(chapters).map(name => (
              <div key={name} className="chapter-item" onClick={() => startStudy(name)}>
                <span className="chapter-name">{name}</span>
                <span className="chapter-count">({chapters[name].length}단어)</span>
                <button className="delete-btn" onClick={(e) => deleteChapter(e, name)}>🗑️</button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // [화면 2] 학습 결과 화면
  if (isFinished) {
    return (
      <div className="container">
        <div className="result-area">
          <h2>[{currentChapterName}] 완료! 🎉</h2>
          <p>{studyList.length}개 중 {wrongWords.length}개 미암기</p>
          
          <button className="action-btn" onClick={() => restart('all')}>전체 다시 (랜덤)</button>
          {wrongWords.length > 0 && (
            <button className="action-btn" onClick={() => restart('wrong')}>틀린 것만 다시 ({wrongWords.length}개)</button>
          )}
          <div style={{marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '20px'}}>
             <button className="action-btn" style={{backgroundColor: '#666'}} onClick={() => setView('home')}>목록으로 나가기</button>
          </div>
        </div>
      </div>
    );
  }

  // [화면 3] 학습 진행 화면
  const currentWord = studyList[currentIndex];
  return (
    <div className="container">
      {/* --- 상단 헤더 영역 (수정됨) --- */}
      <div className="study-header">
        
        {/* 1열: 홈 버튼과 챕터 제목 */}
        <div className="header-top-row">
          <button onClick={goHome} className="home-icon-btn">🏠</button>
          <span className="chapter-title">{currentChapterName}</span>
          {/* 제목 중앙 정렬을 위한 빈 공간 (홈버튼 크기만큼) */}
          <div style={{width: '30px'}}></div> 
        </div>

        {/* 2열: 진행도 표시 (제목과 카드 사이) */}
        <div className="header-progress">
          {currentIndex + 1} / {studyList.length}
        </div>
      </div>
      {/* -------------------------------- */}

      <div className="card-area" onClick={handleCardClick}>
        <div className={`card ${isFlipped ? 'flipped' : ''}`}>
          <div className="card-front">{currentWord.en}</div>
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