import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, BUCKET } from './supabase'

const MAX_FILE_MB = 50

function fileIcon(name = '') {
  const ext = name.split('.').pop().toLowerCase()
  if (['pdf'].includes(ext)) return '📕'
  if (['hwp', 'hwpx'].includes(ext)) return '📘'
  if (['doc', 'docx'].includes(ext)) return '📄'
  if (['ppt', 'pptx'].includes(ext)) return '📙'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return '📗'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext)) return '🖼️'
  if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) return '🎬'
  if (['mp3', 'wav', 'm4a'].includes(ext)) return '🎵'
  if (['zip', '7z', 'rar'].includes(ext)) return '🗜️'
  return '📎'
}

function formatDate(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}

function publicUrl(path) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

/* ---------- 자료 올리기 ---------- */
function UploadModal({ classes, initialClass, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [className, setClassName] = useState(initialClass || classes[0] || '')
  const [newClass, setNewClass] = useState('')
  const [isNew, setIsNew] = useState(classes.length === 0)
  const [author, setAuthor] = useState('')
  const [description, setDescription] = useState('')
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    const cls = (isNew ? newClass : className).trim()
    if (!title.trim()) return setError('제목을 입력해 주세요.')
    if (!cls) return setError('수업 이름을 입력해 주세요.')
    if (mode === 'file' && !file) return setError('파일을 선택해 주세요.')
    if (mode === 'link' && !linkUrl.trim()) return setError('링크 주소를 입력해 주세요.')
    if (file && file.size > MAX_FILE_MB * 1024 * 1024)
      return setError(`파일이 너무 커요 (최대 ${MAX_FILE_MB}MB). 영상은 유튜브에 올린 뒤 링크로 공유해 주세요.`)

    setBusy(true)
    try {
      let file_path = null
      let file_name = null
      if (mode === 'file' && file) {
        const safeName = file.name.replace(/[^\w.가-힣-]/g, '_')
        file_path = `${Date.now()}_${safeName}`
        file_name = file.name
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(file_path, file)
        if (upErr) throw upErr
      }
      const { error: insErr } = await supabase.from('posts').insert({
        title: title.trim(),
        category: cls,
        author: author.trim() || null,
        description: description.trim() || null,
        link_url: mode === 'link' ? linkUrl.trim() : null,
        file_path,
        file_name,
      })
      if (insErr) throw insErr
      onDone()
    } catch (e) {
      console.error(e)
      setError('올리는 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>자료 올리기</h2>

        <label>제목 <span className="req">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 3주차 수업 프린트" autoFocus />

        <label>수업 <span className="req">*</span></label>
        <div className="chip-row">
          {classes.map((c) => (
            <button key={c} className={`chip ${!isNew && className === c ? 'on' : ''}`}
              onClick={() => { setIsNew(false); setClassName(c) }}>{c}</button>
          ))}
          <button className={`chip ${isNew ? 'on' : ''}`} onClick={() => setIsNew(true)}>＋ 새 수업</button>
        </div>
        {isNew && (
          <input value={newClass} onChange={(e) => setNewClass(e.target.value)} placeholder="새 수업 이름 (예: 3학년 국어)" />
        )}

        <label>올리는 사람</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="이름 (선택)" />

        <label>설명</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="간단한 안내 (선택)" />

        <div className="mode-toggle">
          <button className={mode === 'file' ? 'on' : ''} onClick={() => setMode('file')}>📎 파일 올리기</button>
          <button className={mode === 'link' ? 'on' : ''} onClick={() => setMode('link')}>🔗 링크 붙이기</button>
        </div>

        {mode === 'file' ? (
          <label className="file-drop">
            <input type="file" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
            {file ? (
              <span>{fileIcon(file.name)} {file.name}</span>
            ) : (
              <span className="muted">여기를 눌러 파일 선택 (최대 {MAX_FILE_MB}MB)</span>
            )}
          </label>
        ) : (
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https:// 로 시작하는 주소" />
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? '올리는 중…' : '올리기'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- 자료 타일 ---------- */
function PostCard({ post, onDelete }) {
  const isLink = !!post.link_url
  const href = isLink ? post.link_url : post.file_path ? publicUrl(post.file_path) : null

  return (
    <article className="card">
      <div className="card-head">
        <div className="card-icon">{isLink ? '🔗' : fileIcon(post.file_name)}</div>
        <span className="cat">{post.category}</span>
      </div>
      <h3>{post.title}</h3>
      {post.description && <p className="desc">{post.description}</p>}
      <div className="card-meta">{formatDate(post.created_at)}{post.author ? ` · ${post.author}` : ''}</div>
      <div className="card-actions">
        {href && (
          <a className="btn-primary" href={href} target="_blank" rel="noreferrer" download={!isLink ? post.file_name : undefined}>
            {isLink ? '열기' : '내려받기'}
          </a>
        )}
        <button className="btn-del" title="삭제" onClick={() => onDelete(post)}>삭제</button>
      </div>
    </article>
  )
}

/* ---------- 게시판 ---------- */
export default function App() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [showUpload, setShowUpload] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setPosts(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const classes = useMemo(
    () => [...new Set(posts.map((p) => p.category).filter(Boolean))],
    [posts]
  )

  const handleDelete = async (post) => {
    if (!confirm(`'${post.title}' 자료를 삭제할까요?`)) return
    if (post.file_path) await supabase.storage.from(BUCKET).remove([post.file_path])
    await supabase.from('posts').delete().eq('id', post.id)
    load()
  }

  const tabs = ['전체', ...classes]
  const shown = filter === '전체' ? posts : posts.filter((p) => p.category === filter)

  return (
    <div className="board">
      <header>
        <div className="header-inner">
          <div>
            <p className="eyebrow">CLASS MATERIALS</p>
            <h1>수업자료실</h1>
            <p className="sub">필요한 자료를 내려받고, 새 자료를 올려 주세요</p>
          </div>
          <button className="btn-primary big" onClick={() => setShowUpload(true)}>＋ 자료 올리기</button>
        </div>
      </header>

      <nav className="tabs" aria-label="수업">
        {tabs.map((t) => (
          <button key={t} className={`tab ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>
            {t}
            <span className="count">{t === '전체' ? posts.length : posts.filter((p) => p.category === t).length}</span>
          </button>
        ))}
      </nav>

      <main>
        {loading ? (
          <p className="empty">불러오는 중…</p>
        ) : shown.length === 0 ? (
          <div className="empty">
            <p>아직 자료가 없어요.</p>
            <button className="btn-primary" onClick={() => setShowUpload(true)}>첫 자료 올리기</button>
          </div>
        ) : (
          <div className="grid">
            {shown.map((p) => <PostCard key={p.id} post={p} onDelete={handleDelete} />)}
          </div>
        )}
      </main>

      {showUpload && (
        <UploadModal
          classes={classes}
          initialClass={filter !== '전체' ? filter : undefined}
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); load() }}
        />
      )}
    </div>
  )
}
