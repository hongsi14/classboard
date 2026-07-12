import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase, BUCKET, ADMIN_CODE } from './supabase'

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
const authorName = (row) => (row.is_admin ? '금주쌤' : displayName(row.author))
const imageFromClipboard = (e) => {
  const item = [...(e.clipboardData?.items || [])].find((it) => it.type.startsWith('image/'))
  return item ? item.getAsFile() : null
}
const isPinned = (p) => p.pinned_until && new Date(p.pinned_until + 'T23:59:59') >= new Date()
const parseHash = () => {
  const m = window.location.hash.match(/^#\/post\/(.+)$/)
  return m ? { view: 'post', id: m[1] } : { view: 'list' }
}

/* ── 글쓰기 ── */
function ComposeModal({ classes, initialClass, isAdmin, onClose, onDone }) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [className, setClassName] = useState(initialClass || classes[0] || '')
  const [newClass, setNewClass] = useState('')
  const [isNew, setIsNew] = useState(classes.length === 0)
  const [author, setAuthor] = useState('')
  const [attach, setAttach] = useState('none') // none | file | link
  const [pinDate, setPinDate] = useState('')
  const [file, setFile] = useState(null)
  const [linkUrl, setLinkUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const onPaste = (e) => {
    const f = imageFromClipboard(e)
    if (!f) return
    e.preventDefault()
    setAttach('file')
    setFile(f)
  }

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
        is_admin: !!isAdmin,
        pinned_until: isAdmin && pinDate ? pinDate : null,
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
      <div className="modal" onPaste={onPaste}>
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
        {isAdmin ? (
          <p className="muted fixed-name">금주쌤으로 올라가요 👩‍🏫</p>
        ) : (
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="비워 두면 '익명'으로 올라가요" />
        )}

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
              : <span className="muted">여기를 눌러 파일 선택 · 사진은 Ctrl+V 붙여넣기도 돼요 (최대 {MAX_FILE_MB}MB)</span>}
          </label>
        )}
        {attach === 'link' && (
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https:// 로 시작하는 주소" />
        )}

        {isAdmin && (
          <>
            <label>📌 상단 고정 (관리자)</label>
            <div className="pin-row">
              <input type="date" value={pinDate} onChange={(e) => setPinDate(e.target.value)} />
              <span className="muted pin-hint">{pinDate ? `${pinDate}까지 맨 위에 고정돼요` : '날짜를 고르면 그날까지 맨 위에 고정돼요 (선택)'}</span>
            </div>
          </>
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
        {isPinned(post) && <span className="pin-ic" title={`${post.pinned_until}까지 고정`}>📌</span>}
        {(post.file_path || post.link_url) && (
          <span className="attach-dot">{post.link_url ? '🔗' : fileIcon(post.file_name)}</span>
        )}
      </div>
      <h3>{isQnA && <span className="q-mark">Q.</span>}{post.title}</h3>
      {post.content && <p className="preview">{post.content}</p>}
      <div className="card-foot">
        <span className="meta">
          {post.is_admin && <span className="admin-chip">금주쌤</span>}
          {authorName(post)} · {fmtDate(post.created_at)}
          {count > 0 && <> · 💬 {count}</>}
        </span>
        {isQnA ? (
          <span className={`answer-pill ${post.answered ? 'done' : 'wait'}`}>
            {post.answered ? '✓ 답변 완료' : '답변 대기'}
          </span>
        ) : (
          <span className="go" aria-hidden="true">→</span>
        )}
      </div>
    </article>
  )
}

/* ── 게시글 상세 ── */
function Detail({ post, onBack, onDeleted, onChanged, isAdmin }) {
  const [pinDate, setPinDate] = useState('')
  const [comments, setComments] = useState([])
  const [cAuthor, setCAuthor] = useState('')
  const [cContent, setCContent] = useState('')
  const [cImage, setCImage] = useState(null)
  const [busy, setBusy] = useState(false)

  const loadComments = useCallback(async () => {
    const { data } = await supabase.from('comments').select('*')
      .eq('post_id', post.id).order('created_at', { ascending: true })
    setComments(data || [])
  }, [post.id])

  useEffect(() => { loadComments() }, [loadComments])

  const addComment = async () => {
    if (!cContent.trim() && !cImage) return
    setBusy(true)
    let image_path = null
    if (cImage) {
      const safe = cImage.name.replace(/[^\w.가-힣-]/g, '_')
      image_path = `comments/${Date.now()}_${safe}`
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(image_path, cImage)
      if (upErr) {
        alert('사진 올리기에 실패했어요. 잠시 후 다시 시도해 주세요.')
        setBusy(false)
        return
      }
    }
    await supabase.from('comments').insert({
      post_id: post.id,
      author: cAuthor.trim() || null,
      content: cContent.trim() || null,
      image_path,
      is_admin: !!isAdmin,
    })
    setCContent('')
    setCImage(null)
    setBusy(false)
    loadComments()
  }

  const deleteComment = async (c) => {
    if (!confirm('이 댓글을 삭제할까요?')) return
    if (c.image_path) await supabase.storage.from(BUCKET).remove([c.image_path])
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
        <p className="meta">{post.is_admin && <span className="admin-chip">금주쌤</span>}{authorName(post)} · {fmtTime(post.created_at)}</p>
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
      {isAdmin && post.category === 'Q&A' && (
        <div className="pin-box">
          {post.answered ? (
            <>
              <span>✓ 답변 완료로 표시된 질문이에요</span>
              <button className="btn-ghost sm" onClick={async () => {
                await supabase.from('posts').update({ answered: false }).eq('id', post.id)
                onChanged()
              }}>완료 해제</button>
            </>
          ) : (
            <button className="btn-dark sm" onClick={async () => {
              await supabase.from('posts').update({ answered: true }).eq('id', post.id)
              onChanged()
            }}>✓ 답변 완료로 표시</button>
          )}
        </div>
      )}
      {isAdmin && (
        <div className="pin-box">
          {isPinned(post) ? (
            <>
              <span>📌 {post.pinned_until}까지 상단 고정 중</span>
              <button className="btn-ghost sm" onClick={async () => {
                await supabase.from('posts').update({ pinned_until: null }).eq('id', post.id)
                onChanged()
              }}>고정 해제</button>
            </>
          ) : (
            <>
              <input type="date" value={pinDate} onChange={(e) => setPinDate(e.target.value)} />
              <button className="btn-dark sm" disabled={!pinDate} onClick={async () => {
                await supabase.from('posts').update({ pinned_until: pinDate }).eq('id', post.id)
                onChanged()
              }}>📌 이 날짜까지 고정</button>
            </>
          )}
        </div>
      )}
      {isAdmin && <button className="text-del" onClick={deletePost}>글 삭제</button>}

      <div className="comments">
        <div className="comments-title">{post.category === 'Q&A' ? `답변 ${comments.length}` : `댓글 ${comments.length}`}</div>
        {comments.map((c) => (
          <div key={c.id} className="comment">
            <div className="comment-head">
              <span className="comment-name">{c.is_admin && <span className="admin-chip">금주쌤</span>}{authorName(c)}</span>
              <span className="comment-date">{fmtDate(c.created_at)}</span>
              {isAdmin && <button className="comment-x" onClick={() => deleteComment(c)} aria-label="댓글 삭제">×</button>}
            </div>
            {c.content && <p>{c.content}</p>}
            {c.image_path && (
              <a href={publicUrl(c.image_path)} target="_blank" rel="noreferrer">
                <img className="comment-img" src={publicUrl(c.image_path)} alt="댓글 사진" loading="lazy" />
              </a>
            )}
          </div>
        ))}
        {cImage && (
          <div className="img-preview">
            <img src={URL.createObjectURL(cImage)} alt="첨부할 사진 미리보기" />
            <button onClick={() => setCImage(null)} aria-label="사진 빼기">×</button>
          </div>
        )}
        <div className="comment-form">
          {isAdmin ? (
            <span className="fixed-name-chip">금주쌤</span>
          ) : (
            <input className="name-in" value={cAuthor} onChange={(e) => setCAuthor(e.target.value)} placeholder="이름 (선택)" />
          )}
          <input className="content-in" value={cContent} onChange={(e) => setCContent(e.target.value)}
            placeholder={post.category === 'Q&A' ? '답변을 남겨 주세요 (사진은 Ctrl+V)' : '댓글을 남겨 주세요 (사진은 Ctrl+V)'}
            onKeyDown={(e) => e.key === 'Enter' && !busy && addComment()}
            onPaste={(e) => {
              const f = imageFromClipboard(e)
              if (f) { e.preventDefault(); setCImage(f) }
            }} />
          <label className="circle-btn cam-btn" aria-label="사진 첨부">
            📷
            <input type="file" accept="image/*" hidden
              onChange={(e) => setCImage(e.target.files[0] || null)} />
          </label>
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
        const side = i % 2 === 0 ? 'left' : 'right'
        const perSide = Math.ceil(recent.length / 2)
        const slot = Math.floor(i / 2)
        const top = 8 + (slot * 80) / perSide // 좌우 각각 균등 간격, 겹침 없음
        const offset = 14 + ((h >> 4) % 56) // 가장자리에서 14~70px
        const size = 26 + ((h >> 8) % 12)
        const dur = 5 + ((h >> 12) % 5)
        const delay = -((h >> 16) % 6)
        return (
          <button
            key={p.id}
            className="planet"
            style={{
              [side]: `${offset}px`,
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
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('hg_admin') === '1')
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
    const ys = new Set(posts.map((p) => new Date(p.created_at).getFullYear()))
    ys.add(new Date().getFullYear())
    return [...ys].sort((a, b) => b - a)
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
    // 📌 고정 글(마감일 전)은 항상 맨 위
    const pinned = list.filter(isPinned)
    const rest = list.filter((p) => !isPinned(p))
    return [...pinned, ...rest]
  }, [posts, filter, search, sort, year])

  const toggleAdmin = () => {
    if (isAdmin) {
      if (confirm('관리자 모드를 해제할까요?')) {
        setIsAdmin(false)
        setManage(false)
        localStorage.removeItem('hg_admin')
      }
      return
    }
    if (!ADMIN_CODE) return alert('관리자 비밀번호가 설정되어 있지 않아요.\n(GitHub Secret의 VITE_ACCESS_CODE)')
    const code = prompt('관리자 비밀번호를 입력하세요')
    if (code === null) return
    if (code === ADMIN_CODE) {
      setIsAdmin(true)
      localStorage.setItem('hg_admin', '1')
    } else {
      alert('비밀번호가 맞지 않아요.')
    }
  }

  const banner = useMemo(() => {
    const list = posts.filter((p) => p.category === '공지사항' && isPinned(p))
    return list[0] || null
  }, [posts])
  const [bannerFold, setBannerFold] = useState(() => localStorage.getItem('hg_banner_fold') || '')

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
          {isAdmin ? (
            <button className="pill admin-pill" onClick={toggleAdmin}>🔓 관리자 모드</button>
          ) : (
            <button className="circle-btn" aria-label="관리자" onClick={toggleAdmin}>🔑</button>
          )}
        </div>
      </div>

      {route.view === 'list' && banner && bannerFold !== banner.id && (
        <div className="notice-bar" onClick={() => openPost(banner.id)} role="button" tabIndex={0}>
          <span className="notice-mega">📢</span>
          <span className="notice-text"><b>공지</b> {banner.title}</span>
          <button className="notice-fold" aria-label="공지 접기"
            onClick={(e) => { e.stopPropagation(); setBannerFold(banner.id); localStorage.setItem('hg_banner_fold', banner.id) }}>∧</button>
        </div>
      )}
      {route.view === 'list' && banner && bannerFold === banner.id && (
        <button className="notice-bar folded" aria-label="공지 펼치기"
          onClick={() => { setBannerFold(''); localStorage.removeItem('hg_banner_fold') }}>
          <span className="notice-mega">📢</span><span className="notice-text">공지 펼치기</span><span className="notice-fold">∨</span>
        </button>
      )}
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
              {isAdmin && (
                <button className={`tab-manage ${manage ? 'on' : ''}`} onClick={() => setManage(!manage)}>
                  {manage ? '완료' : '✎ 탭 편집'}
                </button>
              )}
            </div>
            <div className="sub-tabs">
              <button className={sort === 'latest' ? 'on' : ''} onClick={() => setSort('latest')}>최신순</button>
              <button className={sort === 'comments' ? 'on' : ''} onClick={() => setSort('comments')}>댓글순</button>
              <select className="year-select" value={year} onChange={(e) => setYear(e.target.value)} aria-label="연도">
                <option value="전체">전체 연도</option>
                {years.map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
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
        <Detail post={current} isAdmin={isAdmin} onBack={goList} onChanged={load} onDeleted={() => { goList(); load() }} />
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
          isAdmin={isAdmin}
          initialClass={filter !== '전체' ? filter : undefined}
          onClose={() => setCompose(false)}
          onDone={() => { setCompose(false); load() }}
        />
      )}
    </div>
  )
}
