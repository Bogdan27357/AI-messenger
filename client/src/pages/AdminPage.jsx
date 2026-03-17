import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, uploadFile } from '../utils/api';
import { formatDate } from '../utils/format';
import UserAvatar from '../components/UserAvatar';

export default function AdminPage() {
  const { user, token } = useAuth();
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [tests, setTests] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [showCreateUser, setShowCreateUser] = useState(false);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [showCreateTraining, setShowCreateTraining] = useState(false);
  const [showAssignMentor, setShowAssignMentor] = useState(false);
  const [showAssignTest, setShowAssignTest] = useState(null);
  const [showAssignTraining, setShowAssignTraining] = useState(null);
  const [showUploadDoc, setShowUploadDoc] = useState(false);

  const [newUser, setNewUser] = useState({ username: '', password: '', full_name: '', position: '', role: 'employee' });
  const [mentorForm, setMentorForm] = useState({ userId: '', mentorId: '' });
  const [testForm, setTestForm] = useState({ title: '', description: '', time_limit: 30, questions: [] });
  const [trainingForm, setTrainingForm] = useState({ title: '', description: '', start_date: '', end_date: '', location: '' });
  const [assignUserIds, setAssignUserIds] = useState([]);
  const [docTitle, setDocTitle] = useState('');
  const [aiStatus, setAiStatus] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genDocId, setGenDocId] = useState('');
  const [genCount, setGenCount] = useState(5);
  const [genTitle, setGenTitle] = useState('');

  useEffect(() => {
    if (user.role !== 'admin') return;
    loadData();
    api.get('/ai/status', token).then(setAiStatus).catch(() => {});
  }, [token, user.role]);

  const loadData = () => {
    api.get('/users', token).then(setUsers).catch(() => {});
    api.get('/admin/tests', token).then(setTests).catch(() => {});
    api.get('/admin/trainings', token).then(setTrainings).catch(() => {});
    api.get('/admin/documents', token).then(setDocuments).catch(() => {});
  };

  const createUser = async () => {
    await api.post('/admin/users', newUser, token);
    setShowCreateUser(false);
    setNewUser({ username: '', password: '', full_name: '', position: '', role: 'employee' });
    loadData();
  };

  const deleteUser = async (id) => {
    if (!confirm('Удалить пользователя?')) return;
    await api.delete(`/admin/users/${id}`, token);
    loadData();
  };

  const assignMentor = async () => {
    await api.post('/admin/mentors/assign', mentorForm, token);
    setShowAssignMentor(false);
    setMentorForm({ userId: '', mentorId: '' });
    loadData();
  };

  const uploadDocument = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const uploaded = await uploadFile(file, token);
    await api.post('/admin/documents', { title: docTitle || file.name, file_url: uploaded.url, file_name: file.name }, token);
    setShowUploadDoc(false);
    setDocTitle('');
    loadData();
  };

  const addQuestion = () => {
    setTestForm({
      ...testForm,
      questions: [...testForm.questions, { question: '', options: ['', '', '', ''], correct_answer: 0 }]
    });
  };

  const updateQuestion = (idx, field, value) => {
    const questions = [...testForm.questions];
    questions[idx] = { ...questions[idx], [field]: value };
    setTestForm({ ...testForm, questions });
  };

  const updateOption = (qIdx, oIdx, value) => {
    const questions = [...testForm.questions];
    const options = [...questions[qIdx].options];
    options[oIdx] = value;
    questions[qIdx] = { ...questions[qIdx], options };
    setTestForm({ ...testForm, questions });
  };

  const removeQuestion = (idx) => {
    setTestForm({ ...testForm, questions: testForm.questions.filter((_, i) => i !== idx) });
  };

  const createTest = async () => {
    if (!testForm.title || testForm.questions.length === 0) return alert('Заполните название и добавьте вопросы');
    await api.post('/admin/tests', testForm, token);
    setShowCreateTest(false);
    setTestForm({ title: '', description: '', time_limit: 30, questions: [] });
    loadData();
  };

  const createTraining = async () => {
    if (!trainingForm.title) return;
    await api.post('/admin/trainings', trainingForm, token);
    setShowCreateTraining(false);
    setTrainingForm({ title: '', description: '', start_date: '', end_date: '', location: '' });
    loadData();
  };

  const assignTest = async (testId) => {
    if (assignUserIds.length === 0) return;
    await api.post(`/admin/tests/${testId}/assign`, { userIds: assignUserIds }, token);
    setShowAssignTest(null);
    setAssignUserIds([]);
    loadData();
  };

  const assignTraining = async (trainingId) => {
    if (assignUserIds.length === 0) return;
    await api.post(`/admin/trainings/${trainingId}/assign`, { userIds: assignUserIds }, token);
    setShowAssignTraining(null);
    setAssignUserIds([]);
    loadData();
  };

  const generateTestAI = async () => {
    if (!genDocId) return alert('Выберите документ');
    setGenerating(true);
    try {
      const result = await api.post('/ai/generate-test', {
        documentId: parseInt(genDocId),
        questionsCount: genCount,
        title: genTitle
      }, token);
      alert(`Тест создан! Сгенерировано вопросов: ${result.questionsGenerated}`);
      setGenDocId('');
      setGenTitle('');
      loadData();
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
    setGenerating(false);
  };

  const indexDocument = async (docId) => {
    try {
      const result = await api.post('/ai/index-document', { documentId: docId }, token);
      alert(`Документ проиндексирован: ${result.indexed} из ${result.totalChunks} частей`);
    } catch (err) {
      alert('Ошибка индексации: ' + err.message);
    }
  };

  const employees = users.filter(u => u.role !== 'admin' || u.id !== user.id);

  if (user.role !== 'admin') {
    return <div className="admin-page"><p>Доступ запрещен. Требуются права администратора.</p></div>;
  }

  return (
    <div className="admin-page">
      <h2>Панель администратора</h2>
      <div className="admin-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>Сотрудники</button>
        <button className={tab === 'mentors' ? 'active' : ''} onClick={() => setTab('mentors')}>Наставники</button>
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}>Документы</button>
        <button className={tab === 'tests' ? 'active' : ''} onClick={() => setTab('tests')}>Тесты</button>
        <button className={tab === 'trainings' ? 'active' : ''} onClick={() => setTab('trainings')}>Обучения</button>
      </div>

      {tab === 'users' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Сотрудники ({users.length})</h3>
            <button className="btn primary" onClick={() => setShowCreateUser(true)}>+ Добавить</button>
          </div>
          <div className="admin-table">
            {users.map(u => (
              <div key={u.id} className="admin-user-row">
                <UserAvatar user={u} size={40} />
                <div className="admin-user-info">
                  <div className="admin-user-name">{u.full_name}</div>
                  <div className="admin-user-details">@{u.username} · {u.position} · {u.role === 'admin' ? 'Админ' : 'Сотрудник'}</div>
                </div>
                <span className={`status-dot ${u.status}`} />
                {u.id !== user.id && (
                  <button className="icon-btn small" onClick={() => deleteUser(u.id)}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {showCreateUser && (
            <div className="modal-overlay" onClick={() => setShowCreateUser(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Новый сотрудник</h3>
                <input placeholder="Логин" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} />
                <input placeholder="Пароль" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
                <input placeholder="ФИО" value={newUser.full_name} onChange={e => setNewUser({ ...newUser, full_name: e.target.value })} />
                <input placeholder="Должность" value={newUser.position} onChange={e => setNewUser({ ...newUser, position: e.target.value })} />
                <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                  <option value="employee">Сотрудник</option>
                  <option value="admin">Администратор</option>
                </select>
                <div className="modal-actions">
                  <button className="btn primary" onClick={createUser}>Создать</button>
                  <button className="btn secondary" onClick={() => setShowCreateUser(false)}>Отмена</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'mentors' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Назначение наставников</h3>
            <button className="btn primary" onClick={() => setShowAssignMentor(true)}>Назначить</button>
          </div>
          <div className="admin-table">
            {users.filter(u => u.mentor_id).map(u => {
              const mentor = users.find(m => m.id === u.mentor_id);
              return (
                <div key={u.id} className="mentor-row">
                  <div className="mentor-pair">
                    <span>{u.full_name}</span>
                    <span className="mentor-arrow">{'\u2192'}</span>
                    <span>{mentor?.full_name || 'Не найден'}</span>
                  </div>
                </div>
              );
            })}
            {!users.some(u => u.mentor_id) && <p className="empty-text">Нет назначенных наставников</p>}
          </div>

          {showAssignMentor && (
            <div className="modal-overlay" onClick={() => setShowAssignMentor(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Назначить наставника</h3>
                <label>Сотрудник:</label>
                <select value={mentorForm.userId} onChange={e => setMentorForm({ ...mentorForm, userId: parseInt(e.target.value) })}>
                  <option value="">Выберите сотрудника</option>
                  {employees.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
                <label>Наставник:</label>
                <select value={mentorForm.mentorId} onChange={e => setMentorForm({ ...mentorForm, mentorId: parseInt(e.target.value) })}>
                  <option value="">Выберите наставника</option>
                  {users.filter(u => u.id !== mentorForm.userId).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
                <div className="modal-actions">
                  <button className="btn primary" onClick={assignMentor}>Назначить</button>
                  <button className="btn secondary" onClick={() => setShowAssignMentor(false)}>Отмена</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Рабочие документы</h3>
            <button className="btn primary" onClick={() => setShowUploadDoc(true)}>+ Загрузить</button>
          </div>
          <div className="admin-table">
            {documents.map(d => (
              <div key={d.id} className="doc-row">
                <span className="doc-icon">{'\u{1F4C4}'}</span>
                <div className="doc-info">
                  <div className="doc-title">{d.title}</div>
                  <div className="doc-meta">{d.file_name} · Загрузил: {d.uploader_name} · {formatDate(d.created_at)}</div>
                </div>
                <a href={d.file_url} download className="btn secondary small">Скачать</a>
                <button className="btn ai small" onClick={() => indexDocument(d.id)} title="Индексировать для ИИ-поиска">{'\u{1F916}'}</button>
              </div>
            ))}
            {documents.length === 0 && <p className="empty-text">Нет загруженных документов</p>}
          </div>

          {showUploadDoc && (
            <div className="modal-overlay" onClick={() => setShowUploadDoc(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Загрузить документ</h3>
                <input placeholder="Название документа" value={docTitle} onChange={e => setDocTitle(e.target.value)} />
                <input type="file" onChange={uploadDocument} />
                <button className="btn secondary" onClick={() => setShowUploadDoc(false)}>Отмена</button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'tests' && (
        <div className="admin-section">
          <div className="ai-generate-section">
            <h4>{'\u{1F916}'} Генерация теста с помощью ИИ (Ollama)</h4>
            {aiStatus && (
              <div className="ai-status">
                <span className={`ai-status-dot ${aiStatus.ollama?.status}`} />
                <span>Ollama: {aiStatus.ollama?.status === 'ok' ? 'Подключена' : 'Недоступна'}</span>
                <span className={`ai-status-dot ${aiStatus.qdrant?.status}`} />
                <span>Qdrant: {aiStatus.qdrant?.status === 'ok' ? 'Подключена' : 'Недоступна'}</span>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <select value={genDocId} onChange={e => setGenDocId(e.target.value)}>
                <option value="">Выберите документ</option>
                {documents.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
              </select>
              <input placeholder="Название теста (опционально)" value={genTitle} onChange={e => setGenTitle(e.target.value)} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <label style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Кол-во вопросов:</label>
                <input type="number" min="1" max="20" value={genCount} onChange={e => setGenCount(parseInt(e.target.value) || 5)} style={{ width: 80 }} />
                <button className="btn ai" onClick={generateTestAI} disabled={generating}>
                  {generating ? 'Генерация...' : '\u{1F916} Сгенерировать тест'}
                </button>
              </div>
            </div>
          </div>

          <div className="admin-section-header">
            <h3>Тесты</h3>
            <button className="btn primary" onClick={() => setShowCreateTest(true)}>+ Создать вручную</button>
          </div>
          <div className="admin-table">
            {tests.map(t => (
              <div key={t.id} className="test-row">
                <div className="test-info">
                  <div className="test-title">{t.title}</div>
                  <div className="test-meta">Вопросов: {t.questions_count} · Назначен: {t.assigned_count} сотр.</div>
                </div>
                <button className="btn primary small" onClick={() => { setShowAssignTest(t.id); setAssignUserIds([]); }}>Назначить</button>
              </div>
            ))}
            {tests.length === 0 && <p className="empty-text">Нет тестов</p>}
          </div>

          {showCreateTest && (
            <div className="modal-overlay" onClick={() => setShowCreateTest(false)}>
              <div className="modal large" onClick={e => e.stopPropagation()}>
                <h3>Создать тест</h3>
                <input placeholder="Название теста" value={testForm.title} onChange={e => setTestForm({ ...testForm, title: e.target.value })} />
                <textarea placeholder="Описание" value={testForm.description} onChange={e => setTestForm({ ...testForm, description: e.target.value })} rows={2} />
                <input type="number" placeholder="Время (мин)" value={testForm.time_limit} onChange={e => setTestForm({ ...testForm, time_limit: parseInt(e.target.value) || 0 })} />

                <h4>Вопросы ({testForm.questions.length})</h4>
                {testForm.questions.map((q, qi) => (
                  <div key={qi} className="question-form">
                    <div className="question-header">
                      <span>Вопрос {qi + 1}</span>
                      <button className="icon-btn small" onClick={() => removeQuestion(qi)}>{'\u2715'}</button>
                    </div>
                    <input placeholder="Текст вопроса" value={q.question} onChange={e => updateQuestion(qi, 'question', e.target.value)} />
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="option-row">
                        <input
                          type="radio"
                          name={`correct-${qi}`}
                          checked={q.correct_answer === oi}
                          onChange={() => updateQuestion(qi, 'correct_answer', oi)}
                        />
                        <input placeholder={`Вариант ${oi + 1}`} value={opt} onChange={e => updateOption(qi, oi, e.target.value)} />
                      </div>
                    ))}
                  </div>
                ))}
                <button className="btn secondary" onClick={addQuestion}>+ Добавить вопрос</button>
                <div className="modal-actions">
                  <button className="btn primary" onClick={createTest}>Создать тест</button>
                  <button className="btn secondary" onClick={() => setShowCreateTest(false)}>Отмена</button>
                </div>
              </div>
            </div>
          )}

          {showAssignTest && (
            <div className="modal-overlay" onClick={() => setShowAssignTest(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Назначить тест сотрудникам</h3>
                <div className="user-list">
                  {employees.map(u => (
                    <label key={u.id} className="user-list-item checkbox">
                      <input
                        type="checkbox"
                        checked={assignUserIds.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setAssignUserIds([...assignUserIds, u.id]);
                          else setAssignUserIds(assignUserIds.filter(id => id !== u.id));
                        }}
                      />
                      <span>{u.full_name}</span>
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="btn primary" onClick={() => assignTest(showAssignTest)}>Назначить</button>
                  <button className="btn secondary" onClick={() => setShowAssignTest(null)}>Отмена</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'trainings' && (
        <div className="admin-section">
          <div className="admin-section-header">
            <h3>Обучения</h3>
            <button className="btn primary" onClick={() => setShowCreateTraining(true)}>+ Создать обучение</button>
          </div>
          <div className="admin-table">
            {trainings.map(t => (
              <div key={t.id} className="training-row">
                <div className="training-info">
                  <div className="training-title">{t.title}</div>
                  <div className="training-meta">
                    {t.start_date && `\u{1F4C5} ${formatDate(t.start_date)}`} {t.location && `\u{1F4CD} ${t.location}`} · Назначено: {t.assigned_count}
                  </div>
                </div>
                <button className="btn primary small" onClick={() => { setShowAssignTraining(t.id); setAssignUserIds([]); }}>Назначить</button>
              </div>
            ))}
            {trainings.length === 0 && <p className="empty-text">Нет обучений</p>}
          </div>

          {showCreateTraining && (
            <div className="modal-overlay" onClick={() => setShowCreateTraining(false)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Создать обучение</h3>
                <input placeholder="Название" value={trainingForm.title} onChange={e => setTrainingForm({ ...trainingForm, title: e.target.value })} />
                <textarea placeholder="Описание" value={trainingForm.description} onChange={e => setTrainingForm({ ...trainingForm, description: e.target.value })} rows={3} />
                <label>Дата начала:</label>
                <input type="datetime-local" value={trainingForm.start_date} onChange={e => setTrainingForm({ ...trainingForm, start_date: e.target.value })} />
                <label>Дата окончания:</label>
                <input type="datetime-local" value={trainingForm.end_date} onChange={e => setTrainingForm({ ...trainingForm, end_date: e.target.value })} />
                <input placeholder="Место проведения" value={trainingForm.location} onChange={e => setTrainingForm({ ...trainingForm, location: e.target.value })} />
                <div className="modal-actions">
                  <button className="btn primary" onClick={createTraining}>Создать</button>
                  <button className="btn secondary" onClick={() => setShowCreateTraining(false)}>Отмена</button>
                </div>
              </div>
            </div>
          )}

          {showAssignTraining && (
            <div className="modal-overlay" onClick={() => setShowAssignTraining(null)}>
              <div className="modal" onClick={e => e.stopPropagation()}>
                <h3>Назначить обучение сотрудникам</h3>
                <div className="user-list">
                  {employees.map(u => (
                    <label key={u.id} className="user-list-item checkbox">
                      <input
                        type="checkbox"
                        checked={assignUserIds.includes(u.id)}
                        onChange={e => {
                          if (e.target.checked) setAssignUserIds([...assignUserIds, u.id]);
                          else setAssignUserIds(assignUserIds.filter(id => id !== u.id));
                        }}
                      />
                      <span>{u.full_name}</span>
                    </label>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="btn primary" onClick={() => assignTraining(showAssignTraining)}>Назначить</button>
                  <button className="btn secondary" onClick={() => setShowAssignTraining(null)}>Отмена</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
