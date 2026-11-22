window.__ModuleLoader__.load({
  id: 'dsh-plugin-catalog',
  factory(require) {
    var React = require('react')
    var h = React.createElement
    var PANEL_ID = 'dsh-plugin-catalog'
    var ENDPOINT = '/dsh-plugin-catalog'
    var FALLBACK = __EMBEDDED__

    var CSS = [
      '.pc-root{box-sizing:border-box;height:100%;min-height:0;overflow-y:auto;padding:24px clamp(16px,3vw,40px) 48px;color:var(--dsw-alias-label-primary,#1a202c)}',
      '.pc-inner{width:100%;max-width:1000px;margin:0 auto}',
      '.pc-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}',
      '.pc-title{font-size:20px;font-weight:600;line-height:28px;margin:0}',
      '.pc-sub{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#667085);margin:4px 0 0}',
      '.pc-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px}',
      '.pc-search{flex:1 1 240px;min-width:200px;height:32px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);background:transparent;color:inherit;font-size:13px;outline:none}',
      '.pc-search:focus{border-color:var(--dsw-alias-brand-primary,#247bbf)}',
      '.pc-btn{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);background:transparent;color:inherit;font-size:13px;cursor:pointer}',
      '.pc-btn:hover{border-color:var(--dsw-alias-brand-primary,#247bbf)}',
      '.pc-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}',
      '.pc-chip{height:26px;padding:0 10px;border-radius:13px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);background:transparent;color:inherit;font-size:12px;cursor:pointer}',
      '.pc-chip[data-on="1"]{border-color:var(--dsw-alias-brand-primary,#247bbf);background:color-mix(in srgb, var(--dsw-alias-brand-primary,#247bbf) 12%, transparent)}',
      '.pc-sec{margin-top:26px}',
      '.pc-sec-head{display:flex;align-items:baseline;gap:8px;padding-bottom:8px;border-bottom:1px solid var(--dsw-alias-border-l2,#d0d5dd)}',
      '.pc-sec-name{font-size:14px;font-weight:600}',
      '.pc-sec-count{font-size:12px;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-card{display:flex;gap:14px;padding:14px 0;border-bottom:0.5px solid var(--dsw-alias-border-l2,#d0d5dd);cursor:pointer;border-radius:8px}',
      '.pc-card:hover{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#247bbf) 4%, transparent)}',
      '.pc-card[data-open="1"]{background:color-mix(in srgb, var(--dsw-alias-brand-primary,#247bbf) 7%, transparent)}',
      '.pc-detail{margin-top:8px;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd)}',
      '.pc-detail-row{font-size:12px;line-height:19px;margin:3px 0;word-break:break-word}',
      '.pc-detail-row b{font-weight:600}',
      '.pc-pre{display:block;margin-top:3px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-secondary,#4a5568)}',
      '.pc-copy{height:22px;padding:0 8px;font-size:11px;margin-left:8px}',
      '.pc-hint{color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-badge{flex:none;width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;background:color-mix(in srgb, var(--dsw-alias-brand-primary,#247bbf) 14%, transparent);color:var(--dsw-alias-brand-primary,#247bbf)}',
      '.pc-body{flex:1;min-width:0}',
      '.pc-line1{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}',
      '.pc-name{font-size:13.5px;font-weight:600}',
      '.pc-ver{font-size:11px;padding:1px 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-upd{font-size:11px;padding:1px 6px;border-radius:6px;border:1px solid var(--dsw-alias-state-success-primary,#15803d);color:var(--dsw-alias-state-success-primary,#15803d)}',
      '.pc-upto{font-size:11px;padding:1px 6px;border-radius:6px;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-toggle{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary,#4a5568);cursor:pointer;user-select:none}',
      '.pc-toggle input{margin:0}',
      '.pc-updnote{font-size:12px;line-height:18px;margin:8px 0 0;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-pkg{font-size:11.5px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;color:var(--dsw-alias-label-secondary,#667085);word-break:break-all}',
      '.pc-why{font-size:12.5px;line-height:20px;margin:6px 0 0}',
      '.pc-how{font-size:12.5px;line-height:20px;margin:4px 0 0;color:var(--dsw-alias-label-secondary,#4a5568)}',
      '.pc-how b{font-weight:600;color:var(--dsw-alias-label-primary,#1a202c)}',
      '.pc-none{font-size:12px;margin-top:6px;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-empty{margin-top:32px;font-size:13px;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-use{margin:5px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-sort{height:30px;max-width:132px;flex:none}',
      '.pc-verts{margin:6px 0 0;padding:6px 8px;border-radius:6px;border:1px dashed var(--dsw-alias-border-l2,#d0d5dd)}',
      '.pc-vert{display:flex;align-items:center;gap:8px;font-size:12px;line-height:22px}',
      '.pc-vert-name{font-family:Consolas,monospace;min-width:88px}',
      '.pc-vert-tag{font-size:11px;padding:0 6px;border-radius:9px;background:color-mix(in srgb, var(--dsw-alias-label-primary,#111827) 8%, transparent);color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-vert-btn{font-size:11px;padding:0 8px;height:22px;line-height:20px}',
      '.pc-cat{font-size:11px;padding:1px 6px;border-radius:6px;background:color-mix(in srgb, var(--dsw-alias-label-primary,#111827) 8%, transparent);color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-use b{font-weight:600;color:var(--dsw-alias-label-primary,#1d2939)}',
      '.pc-use-none{opacity:.75}',
      '.pc-use-bar{display:inline-block;height:5px;border-radius:3px;background:var(--dsw-alias-brand-primary,#4d6bfe);vertical-align:middle;margin-right:6px;min-width:2px}',
      '.pc-foot{margin-top:28px;font-size:11.5px;line-height:18px;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-mounts{font-size:11.5px;line-height:18px;margin:6px 0 0;color:var(--dsw-alias-label-secondary,#667085)}',
      '.pc-readme{display:block;margin-top:3px;white-space:pre-wrap;word-break:break-word;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:11.5px;line-height:17px}',
      '.pc-warn{margin-top:12px;font-size:12px;line-height:18px;color:var(--dsw-alias-state-warning-primary,#b45309)}',
      '.pc-updbtn{height:22px;padding:0 8px;font-size:11px;border-radius:6px;border:1px solid var(--dsw-alias-state-success-primary,#15803d);background:transparent;color:var(--dsw-alias-state-success-primary,#15803d);cursor:pointer}',
      '.pc-updbtn:hover{background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#15803d) 12%, transparent)}',
      '.pc-updbtn[disabled]{opacity:.55;cursor:default}',
      '.pc-delbtn{height:22px;padding:0 8px;font-size:11px;border-radius:6px;border:1px solid var(--dsw-alias-state-error-primary,#b91c1c);background:transparent;color:var(--dsw-alias-state-error-primary,#b91c1c);cursor:pointer}',
      '.pc-delbtn:hover{background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#b91c1c) 12%, transparent)}',
      '.pc-delbtn[disabled]{opacity:.55;cursor:default}',
      '.pc-primary.pc-danger{background:var(--dsw-alias-state-error-primary,#b91c1c);border-color:var(--dsw-alias-state-error-primary,#b91c1c)}',
      '.pc-confirm{margin-top:8px;padding:10px 12px;border-radius:8px;border:1px solid var(--dsw-alias-state-success-primary,#15803d);background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#15803d) 7%, transparent);font-size:12px;line-height:19px}',
      '.pc-confirm-actions{display:flex;gap:8px;margin-top:8px}',
      '.pc-primary{height:26px;padding:0 12px;font-size:12px;border-radius:6px;border:1px solid var(--dsw-alias-state-success-primary,#15803d);background:var(--dsw-alias-state-success-primary,#15803d);color:#fff;cursor:pointer}',
      '.pc-ghost{height:26px;padding:0 12px;font-size:12px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#d0d5dd);background:transparent;color:inherit;cursor:pointer}',
      '.pc-updstat{margin-top:8px;font-size:12px;line-height:19px}',
      '.pc-updstat[data-ok="1"]{color:var(--dsw-alias-state-success-primary,#15803d)}',
      '.pc-updstat[data-ok="0"]{color:var(--dsw-alias-state-error-primary,#b42318)}',
      '.pc-select{height:30px;padding:0 6px;border-radius:8px;border:1px solid var(--dsw-alias-border-neutral-l1,#E1E4EA);background:var(--dsw-alias-bg-layer-1,#fff);color:inherit;font-size:12px}',
      '.pc-btn-primary{background:color-mix(in srgb, var(--dsw-alias-label-primary,#111827) 12%, transparent);border-color:color-mix(in srgb, var(--dsw-alias-label-primary,#111827) 38%, transparent);color:inherit;font-weight:600}',
      '.pc-btn-primary:hover{border-color:color-mix(in srgb, var(--dsw-alias-label-primary,#111827) 62%, transparent);background:color-mix(in srgb, var(--dsw-alias-label-primary,#111827) 20%, transparent)}',
      '.pc-btn-primary:disabled{opacity:.6;cursor:default}',
      '.pc-banner-ok{border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary,#15803d) 42%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-success-primary,#15803d) 10%, transparent);color:inherit}',
      '.pc-banner-bad{border-color:color-mix(in srgb, var(--dsw-alias-state-error-primary,#b42318) 42%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-error-primary,#b42318) 10%, transparent);color:inherit}',
      '.pc-banner-note{opacity:.8;font-size:12px}',
      '.pc-download{margin:0 6px;color:var(--dsw-alias-brand-primary,#4d6bfe);text-decoration:underline;font-weight:600}',
      '.pc-auto{font-size:11px;opacity:.7}',
      '.pc-path{display:block;margin-top:4px;font-size:12px;line-height:18px;font-family:Cascadia Mono,Consolas,monospace;word-break:break-all;opacity:.9}',
      '.pc-pathbtn{height:22px;padding:0 8px;font-size:11px;margin-left:8px}',
      '.pc-banner{margin-top:12px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:19px;border:1px solid var(--dsw-alias-state-warning-primary,#b45309);background:color-mix(in srgb, var(--dsw-alias-state-warning-primary,#b45309) 8%, transparent);color:var(--dsw-alias-state-warning-primary,#b45309)}',
    ].join('\n')

    function useCatalog() {
      var pair = React.useState({ data: FALLBACK, live: false, error: null, loading: false })
      var state = pair[0]
      var setState = pair[1]
      var load = React.useCallback(function () {
        setState(function (prev) {
          return { data: prev.data, live: prev.live, error: prev.error, loading: true }
        })
        return fetch(ENDPOINT, { headers: { accept: 'application/json' } })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.json()
          })
          .then(function (data) {
            setState({ data: data, live: true, error: null, loading: false })
          })
          .catch(function (error) {
            setState(function (prev) {
              return {
                data: prev.data,
                live: false,
                error: String((error && error.message) || error),
                loading: false,
              }
            })
          })
      }, [])
      React.useEffect(function () {
        load()
      }, [load])
      // 装完新插件切回 DSH 时自动重读一次，不必手动点「刷新」
      React.useEffect(function () {
        if (typeof document === 'undefined' || !document.addEventListener) return undefined
        function onVisible() {
          if (document.visibilityState === 'visible') load()
        }
        document.addEventListener('visibilitychange', onVisible)
        return function () {
          document.removeEventListener('visibilitychange', onVisible)
        }
      }, [load])
      return { state: state, load: load }
    }

    function stampText(value) {
  if (!value) return '—'
  const at = new Date(value)
  if (Number.isNaN(at.getTime())) return String(value)
  const pad = (n) => String(n).padStart(2, '0')
  return (
    at.getFullYear() +
    '-' +
    pad(at.getMonth() + 1) +
    '-' +
    pad(at.getDate()) +
    ' ' +
    pad(at.getHours()) +
    ':' +
    pad(at.getMinutes())
  )
}

      // 渲染期异常兜底：React 的错误边界必须是 class 组件。
      class PanelBoundary extends React.Component {
        constructor(props) {
          super(props)
          this.state = { error: null }
          this.retry = this.retry.bind(this)
        }

        static getDerivedStateFromError(error) {
          return { error: error }
        }

        componentDidCatch(error, info) {
          try {
            console.error('[dsh-plugin-catalog] 面板渲染失败', error, info)
          } catch (ignored) {
            /* 控制台不可用时什么都不做 */
          }
        }

        retry() {
          this.setState({ error: null })
        }

        render() {
          if (!this.state.error) return this.props.children
          var detail = ''
          try {
            detail = String((this.state.error && this.state.error.message) || this.state.error)
          } catch (ignored) {
            detail = '未知错误'
          }
          return h(
            'div',
            { className: 'pc-root' },
            h('style', null, CSS),
            h(
              'div',
              { className: 'pc-inner' },
              h('h2', { className: 'pc-h1' }, '插件清单面板出错了'),
              h(
                'p',
                { className: 'pc-why' },
                '渲染这个面板时抛了异常。插件清单本身没受影响，插件照旧工作，可以点下面的按钮重试，或者先到「设置 → 插件」里看。',
              ),
              h('pre', { className: 'pc-pre' }, detail),
              h('button', { className: 'pc-btn', type: 'button', onClick: this.retry }, '重试渲染'),
            ),
          )
        }
      }

      function registerMain() {
        return h(PanelBoundary, null, h(Panel, null))
      }

function useUpdates() {
      var pair = React.useState({ report: null, loading: false, error: null })
      var state = pair[0]
      var setState = pair[1]
      var check = React.useCallback(function (force) {
        setState(function (prev) {
          return { report: prev.report, loading: true, error: null }
        })
        var url = ENDPOINT + '/updates.json' + (force ? '?force=1' : '')
        return fetch(url, { headers: { accept: 'application/json' } })
          .then(function (res) {
            if (!res.ok) throw new Error('HTTP ' + res.status)
            return res.json()
          })
          .then(function (report) {
            setState({ report: report, loading: false, error: null })
          })
          .catch(function (error) {
            setState(function (prev) {
              return { report: prev.report, loading: false, error: String((error && error.message) || error) }
            })
          })
      }, [])
      React.useEffect(function () {
        check(false)
      }, [check])
      return { state: state, check: check }
    }

    function SidebarIcon(props) {
      var size = props && typeof props.size === 'number' ? props.size : 16
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        h('rect', { x: 3.5, y: 3.5, width: 17, height: 17, rx: 4 }),
        h('path', { d: 'M8 8.5h8M8 12h8M8 15.5h5' }),
      )
    }

    function Panel() {
      var catalog = useCatalog()
      var updates = useUpdates()
      var report = updates.state.report
      var updateByName = {}
      if (report && Array.isArray(report.items)) {
        report.items.forEach(function (item) {
          updateByName[item.name] = item
        })
      }
      var data = catalog.state.data || { plugins: [], categories: [], total: 0 }
      var plugins = Array.isArray(data.plugins) ? data.plugins : []
      var categoryNames = (Array.isArray(data.categories) ? data.categories : []).map(function (item) {
        return item.name
      })

      var queryPair = React.useState('')
      var query = queryPair[0]
      var setQuery = queryPair[1]
      var chipPair = React.useState('')
      var chip = chipPair[0]
      var setChip = chipPair[1]
      var openPair = React.useState('')
      var open = openPair[0]
      var setOpen = openPair[1]
      var copyPair = React.useState('')
      var copied = copyPair[0]
      var setCopied = copyPair[1]
      var onlyPair = React.useState(false)
      var onlyUpdated = onlyPair[0]
      var setOnlyUpdated = onlyPair[1]
      var updateCount = report && typeof report.outdated === 'number' ? report.outdated : 0
      var updPair = React.useState({ running: false, current: '', results: {}, restart: false })
      var upd = updPair[0]
      var setUpd = updPair[1]
      // One inline confirmation at a time, tagged with what it is about: an update and a
      // removal read very differently, and a removal has no undo.
      var confirmPair = React.useState(null)
      var exportPair = React.useState({ running: false, format: 'docx', result: null, error: null })
      var sortPair = React.useState('name')
      var confirm = confirmPair[0]
      var setConfirm = confirmPair[1]
      var exp = exportPair[0]
      var setExp = exportPair[1]
      var sort = sortPair[0]
      var setSort = sortPair[1]
      // Version history loads per card on demand: listing every version of every
      // plugin on mount would be 31 registry round trips for a view nobody opened.
      var versPair = React.useState({ name: '', running: false, data: null, error: null })
      var enPair = React.useState({ name: '', running: false, result: null, error: null })
      var vers = versPair[0]
      var setVers = versPair[1]
      var en = enPair[0]
      var setEn = enPair[1]

      function openConfirm(name, mode, version) {
        var same = confirm && confirm.name === name && confirm.mode === mode && confirm.version === version
        setConfirm(same ? null : { name: name, mode: mode, version: version || '' })
      }

      function postAction(path, payload) {
        return fetch(ENDPOINT + path, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            return res.json().then(function (body) {
              return body && typeof body === 'object' ? body : { ok: false, error: { code: 'HTTP ' + res.status } }
            })
          })
          .catch(function (error) {
            return { ok: false, error: { code: 'network', diagnostic: String((error && error.message) || error) } }
          })
      }

      function postUpdate(item) {
        return postAction('/update', { name: item.name, version: item.latest, confirm: true })
      }

      function postRemove(item) {
        return postAction('/remove', { name: item.name, confirm: true })
      }

      // One plugin at a time, in order: the manager removes and reinstalls each bundle,
      // so running them in parallel would fight over the same profile lock.
      function runUpdates(items) {
        if (!items || items.length === 0 || upd.running) return
        var results = {}
        setConfirm(null)
        setUpd({ running: true, current: items[0].name, results: {}, restart: false })
        var chain = Promise.resolve()
        items.forEach(function (item) {
          chain = chain.then(function () {
            setUpd({ running: true, current: item.name, results: Object.assign({}, results), restart: false })
            return postUpdate(item).then(function (body) {
              results[item.name] = Object.assign({}, body, { mode: 'update' })
              setUpd({ running: true, current: item.name, results: Object.assign({}, results), restart: false })
            })
          })
        })
        chain.then(function () {
          var names = Object.keys(results)
          var restart = names.some(function (name) {
            return results[name] && results[name].application === 'restart-required'
          })
          var anyOk = names.some(function (name) {
            return results[name] && results[name].ok
          })
          setUpd({ running: false, current: '', results: Object.assign({}, results), restart: restart })
          if (anyOk) {
            catalog.load()
            updates.check(true)
          }
        })
      }

      // Removing is a single card action, never a bulk one: each removal rewrites the
      // profile manifest and cannot be undone from here.
      function runRemove(item) {
        if (upd.running) return
        setConfirm(null)
        var results = Object.assign({}, upd.results)
        setUpd({ running: true, current: item.name, results: results, restart: upd.restart })
        postRemove(item).then(function (body) {
          var next = Object.assign({}, upd.results)
          next[item.name] = Object.assign({}, body, { mode: 'remove' })
          setUpd({
            running: false,
            current: '',
            results: next,
            restart: upd.restart || (body && body.application === 'restart-required') === true,
          })
          // A removed bundle is gone from the profile, so the list has to be re-read.
          if (body && body.ok) {
            catalog.load()
            updates.check(true)
          }
        })
      }

      function loadVersions(name) {
        if (vers.running && vers.name === name) return
        setVers({ name: name, running: true, data: vers.name === name ? vers.data : null, error: null })
        fetch(ENDPOINT + '/versions.json?name=' + encodeURIComponent(name), { headers: { accept: 'application/json' } })
          .then(function (res) {
            return res.json()
          })
          .then(function (body) {
            setVers({ name: name, running: false, data: body, error: body && body.error ? body.error : null })
          })
          .catch(function (error) {
            setVers({ name: name, running: false, data: null, error: { diagnostic: String((error && error.message) || error) } })
          })
      }

      // Rolling back uses the same write path as updating: the manager removes the
      // bundle and installs the exact version asked for, restoring the old one on failure.
      function runRollback(item, version) {
        if (upd.running || !version) return
        setConfirm(null)
        setUpd({ running: true, current: item.name, results: Object.assign({}, upd.results), restart: upd.restart })
        postAction('/update', { name: item.name, version: version, confirm: true }).then(function (body) {
          var next = Object.assign({}, upd.results)
          next[item.name] = Object.assign({}, body, { mode: 'rollback', requested: version })
          setUpd({
            running: false,
            current: '',
            results: next,
            restart: upd.restart || (body && body.application === 'restart-required') === true,
          })
          if (body && body.ok) {
            catalog.load()
            updates.check(true)
          }
        })
      }

      function runToggle(item, enabled) {
        if (upd.running || en.running) return
        setConfirm(null)
        setEn({ name: item.name, running: true, result: null, error: null })
        postAction('/toggle', { name: item.name, enabled: enabled, confirm: true }).then(function (body) {
          if (body && body.ok) {
            setEn({ name: item.name, running: false, result: body, error: null })
            catalog.load()
          } else {
            setEn({
              name: item.name,
              running: false,
              result: null,
              error: (body && body.error) || { code: 'unknown', diagnostic: '停用/启用失败' },
            })
          }
        })
      }

      function runExport() {
        if (exp.running) return
        setExp({ running: true, format: exp.format, result: null, error: null })
        postAction('/export', { format: exp.format, confirm: true })
          .then(function (body) {
            if (body && body.ok) {
              setExp({ running: false, format: exp.format, result: body, error: null })
            } else {
              setExp({
                running: false,
                format: exp.format,
                result: null,
                error: (body && body.error && (body.error.diagnostic || body.error.code)) || '导出失败',
              })
            }
          })
          .catch(function (error) {
            setExp({ running: false, format: exp.format, result: null, error: String(error && error.message ? error.message : error) })
          })
      }

      function downloadUrl(file) {
        return '/dsh-plugin-catalog/export/download?file=' + encodeURIComponent(file)
      }

      var updatable = report && Array.isArray(report.items)
        ? report.items.filter(function (item) {
            return item.hasUpdate
          })
        : []

      var removedNames = Object.keys(upd.results).filter(function (name) {
        var hit = upd.results[name]
        return hit && hit.mode === 'remove' && hit.ok
      })

      var terms = query
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(function (term) {
          return term.length > 0
        })
      var shown = plugins.filter(function (item) {
        if (chip && item.category !== chip) return false
        if (onlyUpdated) {
          var info = updateByName[item.name]
          if (!info || !info.hasUpdate) return false
        }
        if (terms.length === 0) return true
        var haystack = [
          item.name,
          item.title,
          item.category,
          item.purpose,
          item.how,
          item.version,
          (item.mounts || [])
            .map(function (mount) {
              return (mount.id || '') + ' ' + (mount.name || '')
            })
            .join(' '),
          (item.readme && item.readme.text) || '',
          item.usage && item.usage.tools
            ? item.usage.tools
                .map(function (tool) {
                  return tool.name
                })
                .join(' ')
            : '',
        ]
          .map(function (field) {
            return String(field == null ? '' : field).toLowerCase()
          })
          .join('\n')
        return terms.every(function (term) {
          return haystack.indexOf(term) >= 0
        })
      })

      var byTitle = function (left, right) {
        return String(left.title || left.name).localeCompare(String(right.title || right.name), 'zh-Hans-CN')
      }
      var callsOf = function (item) {
        return item.usage && typeof item.usage.calls === 'number' ? item.usage.calls : 0
      }
      var lastOf = function (item) {
        var at = item.usage && item.usage.lastAt ? Date.parse(item.usage.lastAt) : NaN
        return Number.isNaN(at) ? 0 : at
      }

      var flat = sort === 'usage' || sort === 'recent'
      var sections = []
      if (flat) {
        var ranked = shown.slice().sort(function (left, right) {
          if (sort === 'recent') return lastOf(right) - lastOf(left) || callsOf(right) - callsOf(left) || byTitle(left, right)
          return callsOf(right) - callsOf(left) || byTitle(left, right)
        })
        if (ranked.length > 0) sections.push({ name: '', list: ranked })
      } else {
        var order = categoryNames.concat(
          shown
            .map(function (item) {
              return item.category
            })
            .filter(function (name) {
              return categoryNames.indexOf(name) < 0
            }),
        )
        var seen = {}
        order.forEach(function (name) {
          if (!name || seen[name]) return
          seen[name] = true
          var list = shown
            .filter(function (item) {
              return (item.category || '') === name
            })
            .sort(byTitle)
          if (list.length > 0) sections.push({ name: name, list: list })
        })
      }

      var chips = [{ name: '', label: '全部 ' + plugins.length }].concat(
        (Array.isArray(data.categories) ? data.categories : []).map(function (item) {
          return { name: item.name, label: item.name + ' ' + item.count }
        }),
      )

      return h(
        'div',
        { className: 'pc-root' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'pc-inner' },
          h(
            'div',
            { className: 'pc-head' },
            h(
              'div',
              null,
              h('h1', { className: 'pc-title' }, '插件清单'),
              h(
                'p',
                { className: 'pc-sub' },
                '共 ' +
                  (data.total || plugins.length) +
                  ' 个插件 · 按大类看它们「是干什么的、怎么用」，点开卡片看挂载项与 README 用法' +
                  (catalog.state.live ? ' · 实时读取当前配置' : ' · 内置快照'),
              ),
            ),
            h(
              'div',
              { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
              h(
                'button',
                {
                  className: 'pc-btn',
                  type: 'button',
                  onClick: function () {
                    runUpdates(updatable)
                  },
                  disabled: upd.running || updatable.length === 0,
                },
                upd.running
                  ? '更新中…'
                  : updatable.length > 0
                    ? '一键更新（' + updatable.length + ' 个）'
                    : '一键更新',
              ),
              h(
                'button',
                {
                  className: 'pc-btn',
                  type: 'button',
                  onClick: function () {
                    updates.check(true)
                  },
                  disabled: updates.state.loading,
                },
                updates.state.loading ? '检查更新中…' : updateCount > 0 ? '检查更新（' + updateCount + ' 个可更新）' : '检查更新',
              ),
              h(
                'button',
                {
                  className: 'pc-btn',
                  type: 'button',
                  onClick: function () {
                    catalog.load()
                    updates.check(true)
                  },
                  disabled: catalog.state.loading,
                },
                catalog.state.loading ? '刷新中…' : '刷新',
              ),
              h(
                'select',
                {
                  className: 'pc-select',
                  value: exp.format,
                  onChange: function (event) {
                    setExp({ running: exp.running, format: event.target.value === 'pdf' ? 'pdf' : 'docx', result: exp.result, error: exp.error })
                  },
                  'aria-label': '导出格式',
                },
                h('option', { value: 'docx' }, 'Word'),
                h('option', { value: 'pdf' }, 'PDF'),
              ),
              h(
                'button',
                {
                  className: 'pc-btn pc-btn-primary',
                  type: 'button',
                  onClick: runExport,
                  disabled: exp.running,
                  title: '把当前清单导出到桌面：Word 或 PDF',
                },
                exp.running ? '导出中…' : '一键导出到桌面',
              ),
            ),
          ),
          h(
            'div',
            { className: 'pc-tools' },
            h(
              'select',
              {
                className: 'pc-select pc-sort',
                value: sort,
                title: '排序方式',
                onChange: function (event) {
                  setSort(event.target.value)
                },
              },
              h('option', { value: 'name' }, '按大类 / 名称'),
              h('option', { value: 'usage' }, '按使用次数'),
              h('option', { value: 'recent' }, '按最近调用'),
            ),
            h('input', {
              className: 'pc-search',
              type: 'search',
              placeholder: '搜插件名、作用、用法，比如「文献」「浏览器」',
              value: query,
              onChange: function (event) {
                setQuery(event.target.value)
              },
            }),
            h(
              'label',
              { className: 'pc-toggle' },
              h('input', {
                type: 'checkbox',
                checked: onlyUpdated,
                onChange: function (event) {
                  setOnlyUpdated(event.target.checked)
                },
              }),
              '只看可更新' + (updateCount > 0 ? '（' + updateCount + '）' : ''),
            ),
          ),
          updates.state.error
            ? h(
                'p',
                { className: 'pc-warn' },
                '更新检查失败（' + updates.state.error + '）。插件清单本身不受影响，可稍后再点「检查更新」。',
              )
            : report && report.checkedAt
              ? h(
                  'p',
                  { className: 'pc-updnote' },
                  '更新检查：' +
                    (updateCount > 0 ? updateCount + ' 个插件有新版本' : '都已是最新（或没有发布源）') +
                    ' · ' +
                    stampText(report.checkedAt) +
                    ' · 对比 npm registry，结果缓存 ' +
                    report.ttlHours +
                    ' 小时',
                )
              : null,
          upd.restart
            ? h(
                'p',
                { className: 'pc-banner' },
                '有插件已经更新到新版本，但要重启 DSH 才生效：完全退出 Harness 再打开即可（重启后本面板会自动显示新版本号）。',
              )
            : null,
          removedNames.length > 0
            ? h(
                'p',
                { className: 'pc-banner' },
                '已卸载：' +
                  removedNames
                    .map(function (name) {
                      var hit = upd.results[name]
                      return (
                        name +
                        (hit && hit.application === 'restart-required' ? '（重启 DSH 后彻底卸干净）' : '')
                      )
                    })
                    .join('、') +
                  '。要装回来请到「设置 → 插件」或插件市场重新安装。',
              )
            : null,
          exp.error
            ? h('p', { className: 'pc-banner pc-banner-bad' }, '导出失败：' + exp.error + '。插件清单本身不受影响，可以稍后再试。')
            : null,
          exp.result
            ? h(
                'div',
                { className: 'pc-banner pc-banner-ok' },
                h(
                  'span',
                  null,
                  '已导出 ' +
                    (exp.result.format === 'pdf' && exp.result.pdf ? 'PDF' : 'Word') +
                    '（' +
                    Math.max(1, Math.round(((exp.result.pdf && exp.result.pdf.bytes) || (exp.result.docx && exp.result.docx.bytes) || 0) / 1024)) +
                    ' KB' +
                    (exp.result.pdf && exp.result.pdf.pages ? '，' + exp.result.pdf.pages + ' 页' : '') +
                    '）：',
                ),
                h(
                  'a',
                  {
                    className: 'pc-download',
                    href: downloadUrl((exp.result.pdf && exp.result.pdf.name) || (exp.result.docx && exp.result.docx.name)),
                    target: '_blank',
                    rel: 'noreferrer',
                    title: '点开由浏览器另存一份，落在浏览器自己的下载目录里（通常是系统「下载」文件夹）',
                  },
                  '下载一份',
                ),
                h(
                  'span',
                  { className: 'pc-path' },
                  '已保存到桌面：' + String(exp.result.dir || '') + '\\' + String((exp.result.pdf && exp.result.pdf.name) || (exp.result.docx && exp.result.docx.name) || ''),
                ),
                h('span', { className: 'pc-banner-note' }, exp.result.note ? ' ' + exp.result.note : ' 导出的文件已经在你桌面上（就是上面这个路径），不用再点「下载一份」。'),
                h(
                  'button',
                  {
                    className: 'pc-btn pc-pathbtn',
                    type: 'button',
                    onClick: function () {
                      var target = String(exp.result.dir || '') + '\\' + String((exp.result.pdf && exp.result.pdf.name) || (exp.result.docx && exp.result.docx.name) || '')
                      if (navigator.clipboard && navigator.clipboard.writeText) {
                        navigator.clipboard.writeText(target).catch(function () {})
                      }
                    },
                  },
                  '复制路径',
                ),
              )
            : null,
          h(
            'div',
            { className: 'pc-chips' },
            chips.map(function (item) {
              return h(
                'button',
                {
                  key: item.name || 'all',
                  className: 'pc-chip',
                  type: 'button',
                  'data-on': item.name === chip ? '1' : '0',
                  onClick: function () {
                    setChip(item.name)
                  },
                },
                item.label,
              )
            }),
          ),
          catalog.state.error
            ? h(
                'p',
                { className: 'pc-warn' },
                '宿主数据路由暂时读不到（' +
                  catalog.state.error +
                  '），下面是内置快照，可能不是最新。点「刷新」重试。',
              )
            : null,
          sections.length === 0
            ? h('p', { className: 'pc-empty' }, '没有匹配的插件，换个关键词试试。')
            : sections.map(function (section) {
                return h(
                  'section',
                  { className: 'pc-sec', key: section.name },
                  h(
                    'div',
                    { className: 'pc-sec-head' },
                    h('span', { className: 'pc-sec-name' }, section.name),
                    h('span', { className: 'pc-sec-count' }, String(section.list.length)),
                  ),
                  section.list.map(function (item) {
                    var initial = String(item.title || item.name || '?').slice(0, 1)
                    return h(
                      'div',
                      {
                        className: 'pc-card',
                        key: item.name,
                        onClick: function () {
                          setOpen(open === item.name ? '' : item.name)
                        },
                        'data-open': open === item.name ? '1' : '0',
                      },
                      h('div', { className: 'pc-badge', 'aria-hidden': true }, initial),
                      h(
                        'div',
                        { className: 'pc-body' },
                        h(
                          'div',
                          { className: 'pc-line1' },
                          h('span', { className: 'pc-name' }, item.title || item.name),
                          item.version ? h('span', { className: 'pc-ver' }, 'v' + item.version) : null,
                          flat && item.category ? h('span', { className: 'pc-cat' }, item.category) : null,
                          updateByName[item.name] && updateByName[item.name].hasUpdate
                            ? h('span', { className: 'pc-upd' }, '可更新 v' + updateByName[item.name].latest)
                            : null,
                          item.title && item.title !== item.name ? h('span', { className: 'pc-pkg' }, item.name) : null,
                          updateByName[item.name] && updateByName[item.name].hasUpdate
                            ? h(
                                'button',
                                {
                                  className: 'pc-updbtn',
                                  type: 'button',
                                  disabled: upd.running,
                                  onClick: function (event) {
                                    event.stopPropagation()
                                    openConfirm(item.name, 'update')
                                  },
                                },
                                upd.running && upd.current === item.name ? '更新中…' : upd.results[item.name] ? '再更新一次' : '更新',
                              )
                            : null,
                          item.removable === true
                          ? h(
                              'button',
                              {
                                className: 'pc-delbtn',
                                type: 'button',
                                disabled: upd.running,
                                onClick: function (event) {
                                  event.stopPropagation()
                                  openConfirm(item.name, 'remove')
                                },
                              },
                              upd.running && upd.current === item.name ? '处理中…' : '卸载',
                            )
                          : null,
                        ),
                        confirm && confirm.name === item.name
                          ? h(
                              'div',
                              {
                                className: 'pc-confirm',
                                onClick: function (event) {
                                  event.stopPropagation()
                                },
                              },
                              confirm.mode === 'remove'
                                ? h(
                                    'div',
                                    null,
                                    '卸载 ' + (item.title || item.name) + (item.version ? '（v' + item.version + '）' : '') + '？',
                                  )
                                : confirm.mode === 'rollback'
                                ? h(
                                    'div',
                                    null,
                                    '把 ' + (item.title || item.name) + ' 装回 v' + confirm.version + '（当前 v' + (item.version || '?') + '）？',
                                  )
                                : confirm.mode === 'disable'
                                  ? h('div', null, '停用 ' + (item.title || item.name) + '？')
                                  : h(
                                      'div',
                                      null,
                                      '把 ' +
                                        (item.title || item.name) +
                                        ' 从 v' +
                                        (updateByName[item.name] ? updateByName[item.name].installed : item.version) +
                                        ' 更新到 v' +
                                        (updateByName[item.name] ? updateByName[item.name].latest : '?') +
                                        '？',
                                    ),
                              h(
                                'div',
                                { style: { marginTop: '4px' } },
                                confirm.mode === 'remove'
                                  ? '它会从 profile 的依赖与 bundles 声明里删除、包文件一并删掉，它注册的工具、命令和面板入口立刻消失。这里没有撤销按钮——要回来得重新安装。'
                                  : confirm.mode === 'rollback'
                                    ? '它会把当前版本卸载、装回这个旧版本，装失败自动恢复；多数情况要重启 DSH 才生效。'
                                    : confirm.mode === 'disable'
                                      ? '它会从 profile 的选择里去掉，重启后不再挂载；包文件不会删，随时可以再启用。'
                                      : '它会先卸载当前版本再装新版，装失败会自动回滚；装好之后多数情况要重启 DSH 才生效。',
                              ),
                              h(
                                'div',
                                { className: 'pc-confirm-actions' },
                                h(
                                  'button',
                                  {
                                    className: confirm.mode === 'remove' ? 'pc-primary pc-danger' : 'pc-primary',
                                    type: 'button',
                                    disabled: upd.running || (en.running && en.name === item.name),
                                    onClick: function (event) {
                                      event.stopPropagation()
                                      if (confirm.mode === 'remove') runRemove({ name: item.name })
                                      else if (confirm.mode === 'rollback') runRollback(item, confirm.version)
                                      else if (confirm.mode === 'disable') runToggle(item, false)
                                      else runUpdates([{ name: item.name, latest: updateByName[item.name].latest }])
                                    },
                                  },
                                  (upd.running && upd.current === item.name) || (en.running && en.name === item.name)
                                    ? '处理中…'
                                    : confirm.mode === 'remove'
                                      ? '确认卸载'
                                      : confirm.mode === 'rollback'
                                        ? '确认回退'
                                        : confirm.mode === 'disable'
                                          ? '确认停用'
                                          : '确认更新',
                                ),
                                h(
                                  'button',
                                  {
                                    className: 'pc-ghost',
                                    type: 'button',
                                    onClick: function (event) {
                                      event.stopPropagation()
                                      setConfirm(null)
                                    },
                                  },
                                  '取消',
                                ),
                              ),
                            )
                          : null,
                        upd.results[item.name] && upd.results[item.name].mode === 'rollback'
                          ? h(
                              'p',
                              { className: 'pc-updstat', 'data-ok': upd.results[item.name].ok ? '1' : '0' },
                              upd.results[item.name].ok
                                ? '已装回 v' +
                                  (upd.results[item.name].to || upd.results[item.name].requested || '?') +
                                  '（原 v' + (upd.results[item.name].from || '?') + '）' +
                                  (upd.results[item.name].application === 'restart-required' ? '，重启 DSH 后生效' : '，已生效')
                                : '回退失败（' +
                                  ((upd.results[item.name].error && upd.results[item.name].error.code) || 'unknown') +
                                  '）' +
                                  (upd.results[item.name].error && upd.results[item.name].error.diagnostic
                                    ? '：' + upd.results[item.name].error.diagnostic
                                    : ''),
                            )
                          : null,
                        en.name === item.name && en.error
                          ? h(
                              'p',
                              { className: 'pc-updstat', 'data-ok': '0' },
                              '停用/启用失败（' + (en.error.code || 'unknown') + '）：' + (en.error.diagnostic || ''),
                            )
                          : null,
                        en.name === item.name && en.result
                          ? h(
                              'p',
                              { className: 'pc-updstat', 'data-ok': '1' },
                              en.result.changed === false
                                ? '已经是' + (en.result.enabled ? '启用' : '停用') + '状态'
                                : '已' +
                                  (en.result.enabled ? '启用' : '停用') +
                                  (en.result.restartReason ? '，重启 DSH 后生效' : '，已生效') +
                                  '（包文件没动，可以随时改回来）',
                            )
                          : null,
                        upd.results[item.name] && upd.results[item.name].mode !== 'rollback'
                          ? h(
                              'p',
                              { className: 'pc-updstat', 'data-ok': upd.results[item.name].ok ? '1' : '0' },
                              upd.results[item.name].mode === 'remove'
                                ? upd.results[item.name].ok
                                  ? '已卸载 ' +
                                    (item.title || item.name) +
                                    (upd.results[item.name].from ? '（v' + upd.results[item.name].from + '）' : '') +
                                    (upd.results[item.name].application === 'restart-required'
                                      ? '，重启 DSH 后彻底卸干净'
                                      : '，已从 profile 移除')
                                  : '卸载失败（' +
                                    ((upd.results[item.name].error && upd.results[item.name].error.code) || 'unknown') +
                                    '）' +
                                    (upd.results[item.name].error && upd.results[item.name].error.diagnostic
                                      ? '：' + upd.results[item.name].error.diagnostic
                                      : '')
                                : upd.results[item.name].ok
                                  ? '已更新 v' +
                                    (upd.results[item.name].from || '?') +
                                    ' → v' +
                                    (upd.results[item.name].to || '?') +
                                    (upd.results[item.name].application === 'restart-required' ? '，重启 DSH 后生效' : '，已生效')
                                  : '更新失败（' +
                                    ((upd.results[item.name].error && upd.results[item.name].error.code) || 'unknown') +
                                    '）' +
                                    (upd.results[item.name].error && upd.results[item.name].error.diagnostic
                                      ? '：' + upd.results[item.name].error.diagnostic
                                      : ''),
                            )
                          : null,
                        item.purpose ? h('p', { className: 'pc-why' }, item.purpose) : null,
                        item.how
                          ? h('p', { className: 'pc-how' }, h('b', null, '怎么用：'), item.how, item.drafted ? h('span', { className: 'pc-auto' }, '　（自动起草，可润色）') : null)
                          : null,
                        !item.how && item.readme && item.readme.text
                          ? h(
                              'p',
                              { className: 'pc-how' },
                              h('b', null, '怎么用（摘自 ' + item.readme.file + '）：'),
                              h('span', { className: 'pc-readme' }, item.readme.text),
                            )
                          : null,
                        item.mounts && item.mounts.length > 0
                          ? h(
                              'p',
                              { className: 'pc-mounts' },
                              '挂载：' +
                                item.mounts
                                  .map(function (mount) {
                                    return mount.id === mount.name ? mount.id : mount.id + '（' + mount.name + '）'
                                  })
                                  .join('、'),
                            )
                          : null,
                        data.usage && data.usage.calls > 0
                          ? h(
                              'p',
                              { className: 'pc-use' + (item.usage && item.usage.calls > 0 ? '' : ' pc-use-none') },
                              h('b', null, '使用：'),
                              item.usage && item.usage.calls > 0
                                ? h(
                                    'span',
                                    null,
                                    h('span', {
                                      className: 'pc-use-bar',
                                      style: { width: Math.max(2, Math.round(item.usage.share * 1.6)) + 'px' },
                                      'aria-hidden': true,
                                    }),
                                    item.usage.calls + ' 次',
                                    ' · 占插件调用 ' + item.usage.share + '%',
                                    ' · 占全部工具调用 ' + item.usage.shareAll + '%',
                                  )
                                : '暂无工具调用记录',
                            )
                          : null,
                        open === item.name
                          ? h(
                              'div',
                              { className: 'pc-detail' },
                              h(
                                'div',
                                { className: 'pc-detail-row' },
                                h('b', null, '包名：'),
                                item.name,
                                h(
                                  'button',
                                  {
                                    className: 'pc-btn pc-copy',
                                    type: 'button',
                                    onClick: function (event) {
                                      event.stopPropagation()
                                      try {
                                        if (navigator.clipboard && navigator.clipboard.writeText) {
                                          navigator.clipboard.writeText(item.name)
                                        }
                                      } catch (error) {
                                        /* clipboard blocked: the name is on screen anyway */
                                      }
                                      setCopied(item.name)
                                    },
                                  },
                                  copied === item.name ? '已复制' : '复制包名',
                                ),
                              ),
                              h(
                                'div',
                                { className: 'pc-detail-row' },
                                h('b', null, '状态：'),
                                item.missing
                                  ? '声明了但没装上，需要重装或移除'
                                  : (item.enabled === false ? '未启用（在「设置 → 插件」里打开它的开关）' : '已启用（在 profile 的 bundles 里）') +
                                    (item.official ? ' · 官方内置，可开关不可卸载' : item.optional ? ' · 随安装包提供的可选插件' : item.removable ? ' · 可卸载' : ''),
                              ),
                              item.missing || item.self
                                ? null
                                : h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '开关：'),
                                    item.enabled === false ? '当前停用' : '当前启用',
                                    h(
                                      'button',
                                      {
                                        className: 'pc-btn',
                                        type: 'button',
                                        disabled: upd.running || en.running,
                                        onClick: function (event) {
                                          event.stopPropagation()
                                          if (item.enabled === false) runToggle(item, true)
                                          else openConfirm(item.name, 'disable')
                                        },
                                      },
                                      en.running && en.name === item.name ? '处理中…' : item.enabled === false ? '启用' : '停用',
                                    ),
                                  ),
                              item.spec
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '安装来源：'),
                                    h('span', { className: 'pc-pre' }, item.spec),
                                    item.specKind === 'git'
                                      ? '（git 引用，面板不比较提交）'
                                      : item.specKind === 'local'
                                        ? '（本地目录，跟着源目录变）'
                                        : '',
                                  )
                                : null,
                              updateByName[item.name]
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '更新：'),
                                    updateByName[item.name].hasUpdate
                                      ? '可更新到 v' +
                                        updateByName[item.name].latest +
                                        '（当前 v' +
                                        updateByName[item.name].installed +
                                        '）——点卡片上方的「更新」按钮就地升级，走宿主 pluginManager：先卸载再装精确版本，失败自动回滚，通常要重启 DSH 才生效'
                                      : updateByName[item.name].source === 'npm'
                                        ? '已是最新（npm v' + (updateByName[item.name].latest || '—') + '）'
                                        : updateByName[item.name].note,
                                  )
                                : null,
                              h(
                                'div',
                                { className: 'pc-detail-row' },
                                h('b', null, '版本历史：'),
                                h(
                                  'button',
                                  {
                                    className: 'pc-btn',
                                    type: 'button',
                                    disabled: vers.running && vers.name === item.name,
                                    onClick: function (event) {
                                      event.stopPropagation()
                                      if (vers.name === item.name && vers.data)
                                        setVers({ name: '', running: false, data: null, error: null })
                                      else loadVersions(item.name)
                                    },
                                  },
                                  vers.running && vers.name === item.name
                                    ? '读取中…'
                                    : vers.name === item.name && vers.data
                                      ? '收起版本'
                                      : '查看全部版本',
                                ),
                              ),
                              vers.name === item.name && vers.error
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    '读不到版本列表：',
                                    vers.error.diagnostic || vers.error.code || '',
                                  )
                                : null,
                              vers.name === item.name && vers.data && vers.data.absent
                                ? h('div', { className: 'pc-detail-row' }, 'npm 上没有这个包，没有版本历史可看。')
                                : null,
                              vers.name === item.name && vers.data && vers.data.versions
                                ? h(
                                    'div',
                                    { className: 'pc-verts' },
                                    vers.data.versions.slice(0, 12).map(function (entry) {
                                      var isCurrent = entry.version === item.version
                                      return h(
                                        'div',
                                        { className: 'pc-vert', key: entry.version },
                                        h('span', { className: 'pc-vert-name' }, 'v' + entry.version),
                                        isCurrent
                                          ? h('span', { className: 'pc-vert-tag' }, '当前')
                                          : h(
                                              'button',
                                              {
                                                className: 'pc-ghost pc-vert-btn',
                                                type: 'button',
                                                disabled: upd.running,
                                                onClick: function (event) {
                                                  event.stopPropagation()
                                                  openConfirm(item.name, 'rollback', entry.version)
                                                },
                                              },
                                              '装此版本',
                                            ),
                                        entry.tags && entry.tags.indexOf('latest') >= 0
                                          ? h('span', { className: 'pc-vert-tag' }, 'latest')
                                          : null,
                                        entry.prerelease
                                          ? h('span', { className: 'pc-vert-tag' }, '预发布')
                                          : null,
                                      )
                                    }),
                                  )
                                : null,
                              item.mounts && item.mounts.length
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '挂载项：'),
                                    item.mounts
                                      .map(function (mount) {
                                        return mount.id
                                      })
                                      .join('、'),
                                  )
                                : null,
                              item.usage && item.usage.calls > 0
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '最近一次调用：'),
                                    item.usage.lastAt
                                      ? new Date(item.usage.lastAt).toLocaleString('zh-CN', { hour12: false })
                                      : '—',
                                  )
                                : null,
                              item.usage && item.usage.tools && item.usage.tools.length > 0
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '被调用的工具：'),
                                    item.usage.tools
                                      .map(function (tool) {
                                        return tool.name + ' ×' + tool.calls
                                      })
                                      .join('、'),
                                  )
                                : null,
                              item.overlaps && item.overlaps.length
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, '功能可能重叠：'),
                                    item.overlaps.join('、'),
                                  )
                                : null,
                              item.readme && item.readme.text
                                ? h(
                                    'div',
                                    { className: 'pc-detail-row' },
                                    h('b', null, 'README 用法（' + item.readme.file + '）：'),
                                    h('span', { className: 'pc-pre' }, item.readme.text),
                                  )
                                : null,
                              h(
                                'div',
                                { className: 'pc-detail-row pc-hint' },
                                '在「设置 → 插件」里按这个包名能找到它的卡片、开关与详情页。',
                              ),
                            )
                          : null,
                        item.curated === false
                          ? h('p', { className: 'pc-none' }, '暂无精编使用说明，以上取自插件元数据；可到它的详情页或 README 细看。')
                          : null,
                      ),
                    )
                  }),
                )
              }),
          h(
            'p',
            { className: 'pc-foot' },
            data.usage
              ? '「使用」按本机会话日志里的工具调用统计：共 ' +
                data.usage.calls +
                ' 次调用，其中 ' +
                data.usage.attributed +
                ' 次（' +
                data.usage.coverage +
                '%）能确定归属到插件，其余是 DSH 内置工具或未登记归属的插件工具（不计入任何插件）；数据截至 ' +
                new Date(data.usage.at).toLocaleString('zh-CN', { hour12: false }) +
                '，缓存 10 分钟。'
              : '',
            '数据来自当前 profile 的插件声明与各包元数据，合并本插件内置的精编说明；「挂载」取自该包的 cordis.patch.yml，「怎么用」在没有精编说明时摘它 README 的用法小节。「检查更新」只读对比 npm registry（缓存 6 小时）；「更新 / 一键更新」与「卸载」都会真正写盘——它们经宿主的 pluginManager 执行（安装/卸载/失败回滚由它负责），只接受本机回环请求，按钮点下去还要再确认一次。可卸载性由宿主判定：官方内置包与随装可选包只能开关、没有「卸载」按钮；本插件也不卸载自己。装完或卸完多数情况要重启 DSH 才彻底生效，重启后版本号与清单会刷新。',
          ),
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        function mountSlots(scope) {
          var slots = scope && scope.slots
          if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
            console.error('[plugin-catalog] slots service unavailable')
            return false
          }
          try {
            slots.inject('sidebar.panellist', function () {
              return slots.register(
                {
                  name: 'sidebar.panellist',
                  id: PANEL_ID,
                  order: 12,
                  label: function () {
                    return '插件清单'
                  },
                },
                SidebarIcon,
              )
            })
          } catch (error) {
            console.error('[plugin-catalog] sidebar entry failed', error)
          }
          try {
            slots.inject('main', function () {
              return slots.register({ name: 'main', key: PANEL_ID }, registerMain)
            })
          } catch (error) {
            console.error('[plugin-catalog] main panel failed', error)
          }
          return true
        }
        var direct = null
        try {
          direct = mountSlots(ctx)
        } catch (error) {
          console.error('[plugin-catalog] direct slot mount failed', error)
        }
        if (direct !== true && typeof ctx.inject === 'function') {
          try {
            ctx.inject(['slots'], function (scope) {
              mountSlots(scope)
            })
          } catch (error) {
            console.error('[plugin-catalog] deferred slot mount failed', error)
          }
        }
      },
    }
  },
})
