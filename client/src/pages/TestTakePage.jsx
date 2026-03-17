import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

export default function TestTakePage() {
  const { testId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [test, setTest] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);

  useEffect(() => {
    api.get(`/admin/tests/${testId}`, token).then(data => {
      setTest(data);
      // Hide correct answers for non-admin
      data.questions.forEach(q => delete q.correct_answer);
    }).catch(() => navigate('/profile'));
  }, [testId, token]);

  const submitTest = async () => {
    const answersArray = [];
    for (let i = 0; i < test.questions.length; i++) {
      answersArray.push(answers[i] !== undefined ? answers[i] : -1);
    }
    const res = await api.post(`/admin/tests/${testId}/submit`, { answers: answersArray }, token);
    setResult(res);
    setSubmitted(true);
  };

  if (!test) return <div className="loading-text">Загрузка теста...</div>;

  if (submitted && result) {
    return (
      <div className="test-page">
        <div className="test-result">
          <h2>Результат теста</h2>
          <h3>{test.title}</h3>
          <div className={`test-score ${result.score >= 70 ? 'pass' : 'fail'}`}>
            <div className="test-score-number">{result.score}%</div>
            <div className="test-score-detail">Правильно: {result.correct} из {result.total}</div>
            <div className="test-score-label">{result.score >= 70 ? 'Тест пройден!' : 'Тест не пройден'}</div>
          </div>
          <button className="btn primary" onClick={() => navigate('/profile')}>К профилю</button>
        </div>
      </div>
    );
  }

  const question = test.questions[currentQ];

  return (
    <div className="test-page">
      <div className="test-container">
        <h2>{test.title}</h2>
        {test.description && <p className="test-description">{test.description}</p>}
        <div className="test-progress">
          Вопрос {currentQ + 1} из {test.questions.length}
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((currentQ + 1) / test.questions.length) * 100}%` }} />
          </div>
        </div>

        <div className="test-question">
          <h3>{question.question}</h3>
          <div className="test-options">
            {question.options.map((opt, i) => (
              <label key={i} className={`test-option ${answers[currentQ] === i ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="answer"
                  checked={answers[currentQ] === i}
                  onChange={() => setAnswers({ ...answers, [currentQ]: i })}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="test-nav">
          {currentQ > 0 && <button className="btn secondary" onClick={() => setCurrentQ(currentQ - 1)}>← Назад</button>}
          {currentQ < test.questions.length - 1 ? (
            <button className="btn primary" onClick={() => setCurrentQ(currentQ + 1)}>Далее →</button>
          ) : (
            <button className="btn primary" onClick={submitTest}>Завершить тест</button>
          )}
        </div>
      </div>
    </div>
  );
}
