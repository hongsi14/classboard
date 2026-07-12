import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, BUCKET } from './supabase'

const MAX_FILE_MB = 50
const DEFAULT_BOARDS = ['공지사항', '1학년 과학', '2학년 과학', '3학년 과학', '기타 자료실', 'Q&A']

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

const fmtDate = (iso) => {
  const d = new Date(iso)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`
}
const fmtTime = (iso) => {
  const d = new Date(iso)
  return `${fmtDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const publicUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
const displayName = (a) => (a && a.trim()) || '익명'
const parseHash = () => {
  const m = window.location.hash.match(/^#\/post\/(.+)$/)
  return m ? { view: 'post', id: m[1] } : { view: 'list' }
}

/* ── 글쓰기 ── */
function ComposeModal({ classes, initialClass, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [className, setClassName] = useState(initialClass || classes[0] || '')
  const [newClass, setNewClass] = useState('')
  const [isNew, setIsNew] = useState(classes.length === 0)
  const [author, setAuthor] = useState('')
  const [attach, setAttach] = useState('none') // none | file | link
  const [file, setFile] = useState(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    setError('')
    const cls = (isNew ? newClass : className).trim()
    if (!title.trim()) return setError('제목을 입력해 주세요.')
    if (!cls) return setError('수업 이름을 입력해 주세요.')
    if (attach === 'file' && !file) return setError('파일을 선택해 주세요.')
    if (attach === 'link' && !linkUrl.trim()) return setError('링크 주소를 입력해 주세요.')
    if (file && file.size > MAX_FILE_MB * 1024 * 1024)
      return setError(`파일이 너무 커요 (최대 ${MAX_FILE_MB}MB). 영상은 유튜브에 올리고 링크로 첨부해 주세요.`)

    setBusy(true)
    try {
      let file_path = null
      let file_name = null
      if (attach === 'file' && file) {
        const safeName = file.name.replace(/[^\w.가-힣-]/g, '_')
        file_path = `${Date.now()}_${safeName}`
        file_name = file.name
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(file_path, file)
        if (upErr) throw upErr
      }
      if (isNew) {
        await supabase.from('boards').insert({ name: cls, position: 99 })
      }
      const { error: insErr } = await supabase.from('posts').insert({
        title: title.trim(),
        category: cls,
        author: author.trim() || null,
        content: content.trim() || null,
        link_url: attach === 'link' ? linkUrl.trim() : null,
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
        <div className="modal-title">새 글 쓰기</div>

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

        <label>제목 <span className="req">*</span></label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 3주차 프린트 올려요" autoFocus />

        <label>내용</label>
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="내용을 적어 주세요 (선택)" />

        <label>이름</label>
        <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="비워 두면 '익명'으로 올라가요" />

        <label>첨부</label>
        <div className="seg">
          <button className={attach === 'none' ? 'on' : ''} onClick={() => setAttach('none')}>없음</button>
          <button className={attach === 'file' ? 'on' : ''} onClick={() => setAttach('file')}>파일</button>
          <button className={attach === 'link' ? 'on' : ''} onClick={() => setAttach('link')}>링크</button>
        </div>
        {attach === 'file' && (
          <label className="file-drop">
            <input type="file" hidden onChange={(e) => setFile(e.target.files[0] || null)} />
            {file ? <span>{fileIcon(file.name)} {file.name}</span>
              : <span className="muted">여기를 눌러 파일 선택 (최대 {MAX_FILE_MB}MB)</span>}
          </label>
        )}
        {attach === 'link' && (
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https:// 로 시작하는 주소" />
        )}

        {error && <p className="error">{error}</p>}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>취소</button>
          <button className="btn-dark" onClick={submit} disabled={busy}>{busy ? '올리는 중…' : '올리기'}</button>
        </div>
      </div>
    </div>
  )
}

/* ── 게시글 카드 ── */
function PostCard({ post, onOpen }) {
  const count = post.comments?.[0]?.count ?? 0
  const isNotice = post.category === '공지사항'
  const isQnA = post.category === 'Q&A'
  return (
    <article className={`card ${isNotice ? 'notice' : ''} ${isQnA ? 'qna' : ''}`} onClick={() => onOpen(post.id)}>
      <div className="card-top">
        <span className="badge">{isNotice ? '📢 공지사항' : post.category}</span>
        {(post.file_path || post.link_url) && (
          <span className="attach-dot">{post.link_url ? '🔗' : fileIcon(post.file_name)}</span>
        )}
      </div>
      <h3>{isQnA && <span className="q-mark">Q.</span>}{post.title}</h3>
      {post.content && <p className="preview">{post.content}</p>}
      <div className="card-foot">
        <span className="meta">
          {displayName(post.author)} · {fmtDate(post.created_at)}
          {!isQnA && count > 0 && <> · 💬 {count}</>}
        </span>
        {isQnA ? (
          <span className={`answer-pill ${count > 0 ? 'done' : 'wait'}`}>
            {count > 0 ? `답변 ${count}` : '답변 대기'}
          </span>
        ) : (
          <span className="go" aria-hidden="true">→</span>
        )}
      </div>
    </article>
  )
}

/* ── 게시글 상세 ── */
function Detail({ post, onBack, onDeleted }) {
  const [comments, setComments] = useState([])
  const [cAuthor, setCAuthor] = useState('')
  const [cContent, setCContent] = useState('')
  const [busy, setBusy] = useState(false)

  const loadComments = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*')
      .eq('post_id', post.id).order('created_at', { ascending: true })
    setComments(data || [])
  }, [post.id])

  useEffect(() => { loadComments() }, [loadComments])

  const addComment = async () => {
    if (!cContent.trim()) return
    setBusy(true)
    await supabase.from('comments').insert({
      post_id: post.id,
      author: cAuthor.trim() || null,
      content: cContent.trim(),
    })
    setCContent('')
    setBusy(false)
    loadComments()
  }

  const deleteComment = async (c) => {
    if (!confirm('이 댓글을 삭제할까요?')) return
    await supabase.from('comments').delete().eq('id', c.id)
    loadComments()
  }

  const deletePost = async () => {
    if (!confirm(`'${post.title}' 글을 삭제할까요? 댓글도 함께 지워져요.`)) return
    if (post.file_path) await supabase.storage.from(BUCKET).remove([post.file_path])
    await supabase.from('posts').delete().eq('id', post.id)
    onDeleted()
  }

  const href = post.link_url || (post.file_path ? publicUrl(post.file_path) : null)

  return (
    <div className="detail">
      <button className="circle-btn" onClick={onBack} aria-label="목록으로">←</button>
      <div className="detail-head">
        <span className="badge">{post.category === '공지사항' ? '📢 공지사항' : post.category}</span>
        <h2>{post.category === 'Q&A' && <span className="q-mark">Q.</span>}{post.title}</h2>
        <p className="meta">{displayName(post.author)} · {fmtTime(post.created_at)}</p>
      </div>
      {post.content && <p className="body-text">{post.content}</p>}
      {href && (
        <a className="attach-row" href={href} target="_blank" rel="noreferrer"
          download={post.file_path ? post.file_name : undefined}>
          <span className="attach-ic">{post.link_url ? '🔗' : fileIcon(post.file_name)}</span>
          <span className="attach-name">{post.link_url ? post.link_url : post.file_name}</span>
          <span className="attach-act">{post.link_url ? '열기 →' : '내려받기 ↓'}</span>
        </a>
      )}
      <button className="text-del" onClick={deletePost}>글 삭제</button>

      <div className="comments">
        <div className="comments-title">{post.category === 'Q&A' ? `답변 ${comments.length}` : `댓글 ${comments.length}`}</div>
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <div className="comment-head">
              <span className="comment-name">{displayName(c.author)}</span>
              <span className="comment-date">{fmtDate(c.created_at)}</span>
              <button className="comment-x" onClick={() => deleteComment(c)} aria-label="댓글 삭제">×</button>
            </div>
            <p>{c.content}</p>
          </div>
        ))}
        <div className="comment-form">
          <input className="name-in" value={cAuthor} onChange={(e) => setCAuthor(e.target.value)} placeholder="이름 (선택)" />
          <input className="content-in" value={cContent} onChange={(e) => setCContent(e.target.value)}
            placeholder={post.category === 'Q&A' ? '답변을 남겨 주세요' : '댓글을 남겨 주세요'}
            onKeyDown={(e) => e.key === 'Enter' && !busy && addComment()} />
          <button className="circle-btn dark" onClick={addComment} disabled={busy} aria-label="댓글 등록">↑</button>
        </div>
      </div>
    </div>
  )
}

/* ── 떠다니는 행성 (최근 7일 새 글) ── */
const PLANETS = ['🪐', '🌍', '🌕', '☄️', '🛸', '⭐', '🌌', '💫', '🌟', '🌙', '🌛', '🔭']
const hashCode = (s) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function FloatingPlanets({ posts, onOpen }) {
  const recent = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    return posts.filter((p) => new Date(p.created_at).getTime() > weekAgo).slice(0, 10)
  }, [posts])

  if (recent.length === 0) return null

  return (
    <>
      {recent.map((p, i) => {
        const h = hashCode(p.id)
        const n = recent.length
        const top = 6 + (i * 82) / n // 균등 간격, 겹침 없음
        const offset = 14 + ((h >> 4) % 56) // 왼쪽 가장자리에서 14~70px
        const size = 26 + ((h >> 8) % 12)
        const dur = 5 + ((h >> 12) % 5)
        const delay = -((h >> 16) % 6)
        return (
          <button
            key={p.id}
            className="planet"
            style={{
              left: `${offset}px`,
              top: `${top}vh`,
              fontSize: `${size}px`,
              animationDuration: `${dur}s`,
              animationDelay: `${delay}s`,
            }}
            onClick={() => onOpen(p.id)}
            aria-label={`새 글: ${p.title}`}
          >
            <span className="planet-body">{PLANETS[i % PLANETS.length]}</span>
            <span className="planet-label">{p.title}</span>
          </button>
        )
      })}
    </>
  )
}

/* ── 앱 ── */
export default function App() {
  const [posts, setPosts] = useState([])
  const [boards, setBoards] = useState([])
  const [manage, setManage] = useState(false)
  const [year, setYear] = useState('전체')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('전체')
  const [sort, setSort] = useState('latest') // latest | comments
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [compose, setCompose] = useState(false)
  const [route, setRoute] = useState(parseHash())

  useEffect(() => {
    const onHash = () => setRoute(parseHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [postsRes, boardsRes] = await Promise.all([
      supabase.from('posts').select('*, comments(count)').order('created_at', { ascending: false }),
      supabase.from('boards').select('*').order('position').order('created_at'),
    ])
    if (!postsRes.error) setPosts(postsRes.data || [])
    if (!boardsRes.error) setBoards(boardsRes.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const classes = useMemo(() => {
    const custom = boards.map((b) => b.name).filter((n) => !DEFAULT_BOARDS.includes(n))
    const orphan = [...new Set(posts.map((p) => p.category).filter(Boolean))]
      .filter((n) => !DEFAULT_BOARDS.includes(n) && !custom.includes(n))
    return [...DEFAULT_BOARDS, ...custom, ...orphan]
  }, [boards, posts])

  const years = useMemo(() => {
    const ys = [...new Set(posts.map((p) => new Date(p.created_at).getFullYear()))]
    return ys.sort((a, b) => b - a)
  }, [posts])

  const addBoard = async () => {
    const name = prompt('새 탭 이름을 입력하세요')
    if (!name || !name.trim()) return
    const nm = name.trim()
    if (nm === '전체' || classes.includes(nm)) return alert('이미 있는 이름이에요.')
    await supabase.from('boards').insert({ name: nm, position: boards.length })
    load()
  }

  const renameBoard = async (oldName) => {
    if (DEFAULT_BOARDS.includes(oldName)) return
    const name = prompt('탭 이름 수정', oldName)
    if (!name || !name.trim() || name.trim() === oldName) return
    const nm = name.trim()
    if (nm === '전체' || classes.includes(nm)) return alert('이미 있는 이름이에요.')
    await supabase.from('boards').update({ name: nm }).eq('name', oldName)
    await supabase.from('posts').update({ category: nm }).eq('category', oldName)
    if (filter === oldName) setFilter(nm)
    load()
  }

  const deleteBoard = async (name) => {
    if (DEFAULT_BOARDS.includes(name)) return
    if (!confirm(`'${name}' 탭을 삭제할까요?\n(글은 지워지지 않고 '전체'에서 계속 볼 수 있어요)`)) return
    await supabase.from('boards').delete().eq('name', name)
    if (filter === name) setFilter('전체')
    load()
  }

  const shown = useMemo(() => {
    let list = filter === '전체' ? posts : posts.filter((p) => p.category === filter)
    if (year !== '전체') {
      list = list.filter((p) => new Date(p.created_at).getFullYear() === Number(year))
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) =>
        [p.title, p.content, p.author, p.category].some((v) => v && v.toLowerCase().includes(q)))
    }
    if (sort === 'comments') {
      list = [...list].sort((a, b) => (b.comments?.[0]?.count ?? 0) - (a.comments?.[0]?.count ?? 0))
    }
    // 공지사항은 항상 맨 위에 고정
    const notices = list.filter((p) => p.category === '공지사항')
    const rest = list.filter((p) => p.category !== '공지사항')
    return [...notices, ...rest]
  }, [posts, filter, search, sort, year])

  const openPost = (id) => { window.location.hash = `#/post/${id}` }
  const goList = () => { window.location.hash = '' }

  const current = route.view === 'post' ? posts.find((p) => p.id === route.id) : null

  return (
    <div className="canvas">
      <div className="topbar">
        <div className="pill logo-pill"><span className="logo-dot">✳</span> HWANG GEUM SCIENCE <span className="logo-heart">♥</span></div>
        <div className="topbar-right">
          {showSearch && (
            <input className="search-in" autoFocus value={search}
              onChange={(e) => setSearch(e.target.value)} placeholder="검색" />
          )}
          <button className="circle-btn" aria-label="검색"
            onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearch('') }}>🔍</button>
        </div>
      </div>

      {route.view === 'list' ? (
        <>
          <div className="hero">
            <div className="hero-glow" aria-hidden="true" />
            <div className="hero-tabs">
              {['전체', ...classes].map((t) => (
                <span key={t} className="hero-tab-wrap">
                  <button className={`hero-tab ${filter === t ? 'on' : ''}`} onClick={() => setFilter(t)}>{t}</button>
                  {manage && t !== '전체' && !DEFAULT_BOARDS.includes(t) && (
                    <span className="tab-tools">
                      <button onClick={() => renameBoard(t)} aria-label={`${t} 이름 수정`}>✎</button>
                      <button onClick={() => deleteBoard(t)} aria-label={`${t} 삭제`}>×</button>
                    </span>
                  )}
                </span>
              ))}
              {manage && <button className="tab-add" onClick={addBoard}>＋ 탭 추가</button>}
              <button className={`tab-manage ${manage ? 'on' : ''}`} onClick={() => setManage(!manage)}>
                {manage ? '완료' : '✎ 탭 편집'}
              </button>
            </div>
            <div className="sub-tabs">
              <button className={sort === 'latest' ? 'on' : ''} onClick={() => setSort('latest')}>최신순</button>
              <button className={sort === 'comments' ? 'on' : ''} onClick={() => setSort('comments')}>댓글순</button>
              {years.length > 1 && (
                <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="연도">
                  <option value="전체">전체 연도</option>
                  {years.map((y) => <option key={y} value={y}>{y}년</option>)}
                </select>
              )}
            </div>
          </div>

          <main>
            {loading ? (
              <p className="empty">불러오는 중…</p>
            ) : shown.length === 0 ? (
              <div className="empty">
                <p>{search ? '검색 결과가 없어요.' : '아직 글이 없어요. 첫 글을 남겨 보세요!'}</p>
              </div>
            ) : (
              <div className="grid">
                {shown.map((p) => <PostCard key={p.id} post={p} onOpen={openPost} />)}
              </div>
            )}
          </main>
        </>
      ) : loading ? (
        <p className="empty">불러오는 중…</p>
      ) : current ? (
        <Detail post={current} onBack={goList} onDeleted={() => { goList(); load() }} />
      ) : (
        <div className="empty">
          <p>글을 찾을 수 없어요. 삭제되었을 수 있어요.</p>
          <button className="btn-dark" onClick={goList}>목록으로</button>
        </div>
      )}

      {route.view === 'list' && <FloatingPlanets posts={posts} onOpen={openPost} />}

      <button className="fab" onClick={() => setCompose(true)}>＋ 글쓰기</button>

      {compose && (
        <ComposeModal
          classes={classes}
          initialClass={filter !== '전체' ? filter : undefined}
          onClose={() => setCompose(false)}
          onDone={() => { setCompose(false); load() }}
        />
      )}
    </div>
  )
}
