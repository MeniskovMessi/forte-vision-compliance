import React, { useState, useEffect, useMemo } from 'react'
import {
  Search,
  X,
  ExternalLink,
  Scale,
  Eye,
  FileText,
  Copy,
  Check,
} from 'lucide-react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const FALLBACK_REGULATIONS = [
  {
    rule_code: 'NBRK_CASH_LEAVING_UNATTENDED_MONEY',
    violation_type: 'Оставление кассового узла и наличных денег без присмотра',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 2, пункт 34',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Кассиру категорически запрещается оставлять без присмотра наличные деньги, ценности и документы на рабочем столе при временном или постоянном оставлении рабочего места (кассового помещения). Все наличные деньги и ценности перед уходом кассира подлежат обязательной уборке и запиранию в сейф или металлический шкаф.',
    visual_pattern:
      'Кассир встает со стула и покидает кассовое помещение через дверь, при этом на рабочем столе остаются лежать наличные деньги или ценности.',
  },
  {
    rule_code: 'NBRK_CASH_LEAVING_SAFE_OPEN_UNATTENDED',
    violation_type: 'Оставление сейфа с ценностями в открытом незапертом состоянии без присмотра',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 2, пункт 36',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Сейфы и металлические шкафы для хранения ценностей в течение рабочего дня должны быть заперты на ключ в периоды отсутствия кассира либо проведения операций, не требующих непосредственного доступа к сейфу. Оставление дверцы сейфа открытой при отсутствии кассира у сейфа или при выходе из кассового помещения строго запрещается.',
    visual_pattern:
      'Дверца индивидуального сейфа или металлического шкафа кассира распахнута или не заперта, кассир отходит от сейфа, выходит из помещения или оставляет сейф без прямого визуального контроля.',
  },
  {
    rule_code: 'NBRK_CASH_LEAVING_BAG_UNATTENDED',
    violation_type: 'Оставление инкассаторской сумки с ценностями без присмотра на рабочем месте',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 4, пункт 78',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Инкассаторские сумки (мешки) с денежной наличностью и ценностями с момента приема от инкассаторов до момента пересчета или помещения в кладовую должны находиться под непрерывным контролем кассового работника. Запрещается оставлять инкассаторские сумки на рабочих столах без личного присутствия и наблюдения кассира.',
    visual_pattern:
      'Инкассаторская сумка (баул) находится на рабочем столе, кассир встает и выходит из кассового узла через дверь, оставляя сумку без присмотра.',
  },
  {
    rule_code: 'NBRK_SECURITY_UNAUTHORIZED_THIRD_PERSON',
    violation_type: 'Нахождение постороннего лица в кассовом помещении во время обслуживания клиента',
    doc_title:
      'Правила организации охраны и устройства помещений банков второго уровня, филиалов банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 14)',
    clause_ref: 'Глава 2, пункт 18',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V2000020075',
    normative_text:
      'Доступ в кассовое помещение строго ограничен. Во время проведения кассовых операций и обслуживания клиента одновременное нахождение в помещении кассы посторонних лиц, а также других сотрудников банка, не задействованных в данной операции, категорически запрещается. Входная дверь кассы должна быть закрыта на запирающее устройство.',
    visual_pattern:
      'Во время обслуживания клиента за столом кассы в помещение входит третье постороннее лицо (второй посетитель или сотрудник без оснований).',
  },
  {
    rule_code: 'NBRK_CASH_FORBIDDEN_ITEMS_FOOD_DRINKS',
    violation_type: 'Наличие посторонних предметов (напитков, продуктов питания) на рабочем столе кассира',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 2, пункт 25',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'На рабочем столе кассира категорически запрещается размещение посторонних предметов, не относящихся к выполнению кассовых операций, включая емкости с жидкостями (стаканы, кружки, напитки) и продукты питания, создающие риск повреждения банкнот, платежных документов и счетно-вычислительной техники.',
    visual_pattern:
      'На рабочем столе кассира рядом со счетной машинкой, ноутбуком или банкнотами находится стакан с кофе, кружка или напиток; кассир пьет на рабочем месте.',
  },
  {
    rule_code: 'NBRK_CASH_FORBIDDEN_ITEMS_PERSONAL_BAGS',
    violation_type: 'Размещение личных вещей, верхней одежды и сумок на рабочем столе кассы',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 2, пункт 27',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Личные вещи кассира (сумки, портфели, верхняя одежда, пакеты) должны храниться в специально отведенных индивидуальных шкафах вне рабочей зоны кассы. Нахождение личных сумок, верхней одежды и посторонних предметов на рабочей поверхности стола кассира запрещено в целях исключения смешения личных денег с ценностями банка и предотвращения хищений.',
    visual_pattern:
      'Кассир размещает на рабочей поверхности стола личную дамскую сумку, пакет или верхнюю одежду в непосредственной близости от зоны пересчета ценностей.',
  },
  {
    rule_code: 'NBRK_CASH_OMISSION_BILL_COUNTER_DETECTOR',
    violation_type:
      'Выдача или прием наличных денег без проверки подлинности и пересчета на счетно-сортировальной технике',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 3, пункт 51',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'При приеме и выдаче наличных денег кассир обязан производить полистный пересчет и проверку машиночитаемых защитных признаков банкнот с обязательным использованием детекторов подлинности и счетно-сортировальных машин. Передача денег клиенту непосредственно из рук в руки без предварительной машинной проверки и счета запрещается.',
    visual_pattern:
      'Кассир передает клиенту или принимает от клиента пачку наличных банкнот напрямую через стол без использования счетно-сортировальной машинки или детектора.',
  },
  {
    rule_code: 'NBRK_CASH_UNATTENDED_CLIENT_ZONE',
    violation_type: 'Оставление наличных денег в доступной для клиента зоне без завершения операции',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 3, пункт 55',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Кассовый работник обязан обеспечивать сохранность ценностей при проведении операций с клиентами. Запрещается оставлять пересчитанные или выданные деньги в открытом доступе на краю стола без контроля за их получением клиентом, либо позволять клиенту покидать кассовый узел до полного завершения расчета.',
    visual_pattern:
      'Клиент отходит от стола или покидает помещение, в то время как на клиентской части стола остаются лежать наличные деньги или документы.',
  },
  {
    rule_code: 'NBRK_CASH_INKASSATION_BAG_HANDOVER_PROTOCOL',
    violation_type: 'Нарушение порядка приема-передачи инкассаторской сумки с ценностями',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 4, пункт 82',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Передача инкассаторских сумок (мешков) с ценностями между инкассатором и кассиром осуществляется с обязательной проверкой целостности пломб, шпагата, ткани сумки и сверкой номеров пломб с препроводительной ведомостью непосредственно в момент передачи. Оставление сумки на столе без оформления и проверки запрещается.',
    visual_pattern:
      'Инкассатор или кассир оставляет инкассаторский мешок на столе без надлежащей сверки и немедленного приема ценностей.',
  },
  {
    rule_code: 'NBRK_SECURITY_UNLOCKED_TERMINAL_UNATTENDED',
    violation_type: 'Оставление разблокированного рабочего терминала (ноутбука) кассира при выходе из кассы',
    doc_title:
      'Требования к обеспечению информационной безопасности банков, филиалов банков-нерезидентов Республики Казахстан и организаций, осуществляющих отдельные виды банковских операций',
    clause_ref: 'Глава 2, пункт 14',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V2600038336',
    normative_text:
      'Рабочие станции и терминалы кассовых работников, имеющие доступ к банковским информационным системам и проводкам, при временном оставлении рабочего места должны быть заблокированы паролем (экран блокировки). Оставление активной рабочей сессии без присмотра запрещается.',
    visual_pattern:
      'Кассир встает и покидает рабочее место, оставляя ноутбук или монитор во включенном незаблокированном состоянии с открытой банковской программой.',
  },
  {
    rule_code: 'NBRK_SECURITY_PHONE_USAGE_DURING_OPERATIONS',
    violation_type: 'Использование личного мобильного телефона во время проведения кассовых операций',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 2, пункт 21',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'В целях предотвращения утечки конфиденциальной банковской тайны, персональных данных клиентов и обеспечения концентрации внимания кассиру категорически запрещается вести личные телефонные разговоры, использовать смартфон или отвлекаться на мобильные устройства во время приема, выдачи или пересчета денежной наличности.',
    visual_pattern:
      'Кассир держит в руках личный смартфон, просматривает экран или разговаривает по телефону во время обслуживания клиента или пересчета денег на столе.',
  },
  {
    rule_code: 'NBRK_SECURITY_KEYS_LEFT_IN_SAFE_LOCK',
    violation_type: 'Оставление ключей в замке сейфа или передача ключей третьим лицам',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 2, пункт 41',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Ключи от сейфов, металлических шкафов и кассовых тележек должны постоянно находиться при кассире в течение рабочего дня. Категорически запрещается оставлять ключи в замочных скважинах сейфов в отсутствие кассира либо передавать ключи другим лицам без оформления официального акта приема-передачи.',
    visual_pattern:
      'Ключ оставлен торчащим в замочной скважине сейфа, когда кассир отходит от сейфа, либо кассир передает ключи постороннему лицу.',
  },
  {
    rule_code: 'NBRK_SECURITY_CASH_ROOM_DOOR_UNLOCKED',
    violation_type: 'Оставление входной двери кассового узла открытой при нахождении в помещении ценностей',
    doc_title:
      'Правила организации охраны и устройства помещений банков второго уровня, филиалов банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 14)',
    clause_ref: 'Глава 2, пункт 12',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V2000020075',
    normative_text:
      'Двери кассовых помещений в период нахождения в них ценностей должны быть постоянно закрыты на внутренний замок. Запрещается фиксация дверей в распахнутом положении или оставление двери приоткрытой во время работы кассы.',
    visual_pattern:
      'Входная дверь в кассу открыта настежь или приоткрыта в течение длительного времени, когда в помещении находятся ценности или проводятся операции.',
  },
  {
    rule_code: 'NBRK_SECURITY_CLIENT_REACHING_OVER_BARRIER',
    violation_type: 'Проникновение клиента или постороннего лица за пределы барьера рабочей зоны кассира',
    doc_title:
      'Правила организации охраны и устройства помещений банков второго уровня, филиалов банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 14)',
    clause_ref: 'Глава 2, пункт 29',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V2000020075',
    normative_text:
      'Клиентам запрещается перевешиваться через кассовый барьер, проникать руками в зону хранения или пересчета денег, либо прикасаться к банковскому оборудованию и сейфам. При попытке несанкционированного доступа кассир обязан немедленно блокировать доступ к ценностям.',
    visual_pattern:
      'Клиент или посторонний человек перегибается через рабочий стол, протягивает руки в зону кассира к сейфу или оборудованию.',
  },
  {
    rule_code: 'NBRK_CASH_SMOKING_VAPING_FORBIDDEN',
    violation_type: 'Курение или использование электронных сигарет (вейпов) в кассовом узле',
    doc_title:
      'Правила пожарной безопасности Республики Казахстан (Приказ Министра по чрезвычайным ситуациям РК № 55)',
    clause_ref: 'Глава 1, пункт 8',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V2200026867',
    normative_text:
      'В помещениях касс пересчета, операционных касс и хранилищ ценностей категорически запрещается курение табачных изделий и использование электронных сигарет/вейпов ввиду повышенной пожароопасности бумажных ценностей и наличия чувствительных систем автоматического пожаротушения.',
    visual_pattern:
      'Сотрудник курит, парит вейп или держит дымящуюся электронную сигарету внутри кассового помещения.',
  },
  {
    rule_code: 'NBRK_CASH_MIXING_DIFFERENT_CLIENT_VALUABLES',
    violation_type: 'Одновременный пересчет денег разных клиентов либо смешение ценностей',
    doc_title:
      'Правила осуществления кассовых операций и операций по инкассации банкнот, монет и ценностей в банках второго уровня, филиалах банков-нерезидентов Республики Казахстан (Постановление Правления НБ РК № 208)',
    clause_ref: 'Глава 3, пункт 48',
    adilet_url: 'https://adilet.zan.kz/rus/docs/V1900019680',
    normative_text:
      'Кассир осуществляет обслуживание строго по принципу одного клиента: прием денег от следующего клиента разрешается производить только после полного завершения операции с предыдущим клиентом и уборки ценностей предыдущей операции. Смешение денег разных клиентов на столе строго запрещено.',
    visual_pattern:
      'На столе одновременно находятся несколько пачек денег от разных операций, либо кассир начинает пересчет новой пачки до передачи квитанции первому клиенту.',
  },
]

const DOC_FILTERS = [
  { id: 'ALL', label: 'Все акты', ngr: null },
  { id: 'V1900019680', label: 'Кассовые операции (№ 208)', ngr: 'V1900019680' },
  { id: 'V2000020075', label: 'Охрана и помещения (№ 14)', ngr: 'V2000020075' },
  { id: 'V2600038336', label: 'Инфобез банков (АРРФР)', ngr: 'V2600038336' },
  { id: 'V2200026867', label: 'Пожарная безопасность (№ 55)', ngr: 'V2200026867' },
]

function extractNgr(url = '') {
  const m = String(url).match(/docs\/([A-Z0-9_]+)/i)
  return m ? m[1] : 'V1900019680'
}

function getIssuerLabel(ngr) {
  if (ngr === 'V2600038336') return 'АРРФР Республики Казахстан'
  if (ngr === 'V2200026867') return 'МЧС Республики Казахстан'
  return 'Национальный Банк Республики Казахстан (НБ РК)'
}

export default function RegulationsModal({ isOpen, onClose }) {
  const [regulations, setRegulations] = useState(FALLBACK_REGULATIONS)
  const [selectedRuleCode, setSelectedRuleCode] = useState(FALLBACK_REGULATIONS[0].rule_code)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeDocFilter, setActiveDocFilter] = useState('ALL')
  const [copiedCode, setCopiedCode] = useState(false)

  // Fetch live from backend PostgreSQL pgvector table (/api/v1/regulations)
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    fetch(`${API_BASE}/api/v1/regulations`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        const list = Array.isArray(data.regulations) ? data.regulations : Array.isArray(data) ? data : []
        if (list.length > 0) {
          setRegulations(list)
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const filteredRules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return regulations.filter((item) => {
      const ngr = extractNgr(item.adilet_url)
      if (activeDocFilter !== 'ALL' && ngr !== activeDocFilter) return false
      if (!q) return true
      return (
        item.rule_code?.toLowerCase().includes(q) ||
        item.violation_type?.toLowerCase().includes(q) ||
        item.doc_title?.toLowerCase().includes(q) ||
        item.clause_ref?.toLowerCase().includes(q) ||
        item.normative_text?.toLowerCase().includes(q) ||
        ngr.toLowerCase().includes(q)
      )
    })
  }, [regulations, searchQuery, activeDocFilter])

  const activeRule = useMemo(() => {
    return (
      filteredRules.find((r) => r.rule_code === selectedRuleCode) ||
      filteredRules[0] ||
      null
    )
  }, [filteredRules, selectedRuleCode])

  // Keyboard navigation (Escape, ArrowUp, ArrowDown)
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown' && filteredRules.length > 0) {
        e.preventDefault()
        const idx = filteredRules.findIndex((r) => r.rule_code === activeRule?.rule_code)
        const next = filteredRules[(idx + 1) % filteredRules.length]
        if (next) setSelectedRuleCode(next.rule_code)
      } else if (e.key === 'ArrowUp' && filteredRules.length > 0) {
        e.preventDefault()
        const idx = filteredRules.findIndex((r) => r.rule_code === activeRule?.rule_code)
        const prev = filteredRules[(idx - 1 + filteredRules.length) % filteredRules.length]
        if (prev) setSelectedRuleCode(prev.rule_code)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredRules, activeRule, onClose])

  if (!isOpen) return null

  const activeNgr = activeRule ? extractNgr(activeRule.adilet_url) : ''
  const activeIdx = activeRule
    ? regulations.findIndex((r) => r.rule_code === activeRule.rule_code) + 1
    : 0

  const handleCopyCitation = () => {
    if (!activeRule) return
    const text = `${activeRule.doc_title} (${activeRule.clause_ref}) — «${activeRule.normative_text}» [${activeRule.adilet_url}]`
    navigator.clipboard?.writeText(text)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 1800)
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Strict Line-Design Modal Frame */}
      <div
        className="w-full max-w-6xl h-[82vh] max-h-[760px] bg-white dark:bg-[#0D0F12] border border-gray-200 dark:border-[#1C2029] rounded-md shadow-2xl flex flex-col overflow-hidden text-gray-900 dark:text-[#EDEDEF]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header Bar (h-10, crisp hairline bottom border) */}
        <div className="h-10 px-4 border-b border-gray-200/70 dark:border-[#1C2029] bg-gray-50/70 dark:bg-[#0B0D10] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <Scale className="w-3.5 h-3.5 text-gray-500 dark:text-zinc-400 shrink-0" />
            <span className="text-[11px] font-mono uppercase tracking-[0.14em] text-gray-800 dark:text-zinc-200 font-semibold truncate">
              Реестр нормативных правовых актов РК
            </span>
            <span className="text-gray-300 dark:text-zinc-700 font-mono text-xs">/</span>
            <span className="text-[11px] font-mono text-gray-500 dark:text-zinc-400 tabular-nums">
              ИПС «Әділет» • pgvector ({regulations.length})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline text-[10px] font-mono text-gray-400 dark:text-zinc-500">
              ↑↓ навигация • ESC закрыть
            </span>
            <div className="hidden sm:block h-3.5 w-[1px] bg-gray-200 dark:bg-[#1C2029]" />
            <button
              onClick={onClose}
              className="p-1 rounded text-gray-400 hover:text-gray-800 dark:hover:text-zinc-200 hover:bg-gray-200/50 dark:hover:bg-[#161A22] transition"
              title="Закрыть (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sub-Toolbar: Search Input + Horizontal Document Tabs (Hairline Grid) */}
        <div className="border-b border-gray-200/70 dark:border-[#1C2029] bg-white dark:bg-[#0D0F12] flex flex-col sm:flex-row sm:items-center justify-between shrink-0 divide-y sm:divide-y-0 sm:divide-x divide-gray-200/70 dark:divide-[#1C2029]">
          {/* Search Box */}
          <div className="relative sm:w-80 lg:w-96 shrink-0">
            <Search className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по коду, статье, тексту или НГР..."
              className="w-full h-9 pl-9 pr-7 bg-transparent text-xs text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Document NGR Filter Strip */}
          <div className="flex-1 flex items-center overflow-x-auto px-2 h-9 space-x-1 no-scrollbar">
            {DOC_FILTERS.map((tab) => {
              const active = activeDocFilter === tab.id
              const count =
                tab.id === 'ALL'
                  ? regulations.length
                  : regulations.filter((r) => extractNgr(r.adilet_url) === tab.id).length
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveDocFilter(tab.id)}
                  className={`px-2.5 h-6 rounded-sm text-[11px] font-mono whitespace-nowrap transition flex items-center space-x-1.5 ${
                    active
                      ? 'bg-gray-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-medium'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-[#161A22]'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      active
                        ? 'text-gray-300 dark:text-zinc-600'
                        : 'text-gray-400 dark:text-zinc-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Split Body: Left Index List + Right Architectural Specification */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Left Column: Hairline Rule List */}
          <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-gray-200/70 dark:border-[#1C2029] flex flex-col min-h-0 bg-gray-50/30 dark:bg-[#0B0D10]/60 shrink-0">
            <div className="px-3.5 py-2 border-b border-gray-200/60 dark:border-[#1C2029] flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500">
              <span>Нормативные составы ({filteredRules.length})</span>
              <span>НГР / Пункт</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-200/50 dark:divide-[#1C2029]">
              {filteredRules.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-xs font-mono text-gray-400 dark:text-zinc-500">
                    Нормативы по запросу не найдены
                  </p>
                </div>
              ) : (
                filteredRules.map((rule) => {
                  const isSelected = activeRule?.rule_code === rule.rule_code
                  const globalIdx =
                    regulations.findIndex((r) => r.rule_code === rule.rule_code) + 1
                  const ngr = extractNgr(rule.adilet_url)

                  return (
                    <button
                      key={rule.rule_code}
                      onClick={() => setSelectedRuleCode(rule.rule_code)}
                      className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start space-x-2.5 border-l-2 ${
                        isSelected
                          ? 'bg-white dark:bg-[#141820] border-l-gray-900 dark:border-l-zinc-100'
                          : 'border-l-transparent hover:bg-gray-100/60 dark:hover:bg-[#11141B]'
                      }`}
                    >
                      <span
                        className={`text-[10px] font-mono tabular-nums mt-0.5 shrink-0 ${
                          isSelected
                            ? 'text-gray-900 dark:text-zinc-100 font-semibold'
                            : 'text-gray-400 dark:text-zinc-600'
                        }`}
                      >
                        {String(globalIdx).padStart(2, '0')}
                      </span>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500 truncate">
                            {rule.rule_code}
                          </span>
                          <span className="text-[10px] font-mono text-gray-500 dark:text-zinc-400 shrink-0 tabular-nums">
                            {ngr}
                          </span>
                        </div>
                        <p
                          className={`text-xs leading-snug mt-1 line-clamp-2 ${
                            isSelected
                              ? 'text-gray-900 dark:text-white font-medium'
                              : 'text-gray-700 dark:text-zinc-300'
                          }`}
                        >
                          {rule.violation_type}
                        </p>
                        <span className="block text-[10px] font-mono text-gray-400 dark:text-zinc-500 mt-1">
                          {rule.clause_ref}
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Right Column: Full-Width Line-Design Specification View */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-white dark:bg-[#0D0F12] divide-y divide-gray-200/60 dark:divide-[#1C2029]">
            {activeRule ? (
              <>
                {/* 1. Rule Identifier & Action Strip */}
                <div className="px-5 py-3 bg-gray-50/40 dark:bg-[#0B0D10]/50 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-[11px] font-mono font-semibold text-gray-900 dark:text-zinc-100 tabular-nums">
                      #{String(activeIdx).padStart(2, '0')}
                    </span>
                    <span className="text-gray-300 dark:text-zinc-700">•</span>
                    <span className="text-[11px] font-mono text-gray-600 dark:text-zinc-300 truncate">
                      {activeRule.rule_code}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyCitation}
                      className="px-2.5 py-1 rounded-sm border border-gray-200 dark:border-[#1C2029] text-[11px] font-mono text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-[#161A22] transition flex items-center space-x-1.5"
                      title="Скопировать ссылку и цитату НПА"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>Скопировано</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Цитировать</span>
                        </>
                      )}
                    </button>

                    <a
                      href={activeRule.adilet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-sm bg-gray-900 hover:bg-gray-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-[11px] font-mono font-medium transition flex items-center space-x-1.5"
                    >
                      <span>Открыть в Әділет ({activeNgr})</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* 2. Violation Title */}
                <div className="px-5 py-4">
                  <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500 block mb-1.5">
                    Классификация нарушения кассовой дисциплины
                  </span>
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-zinc-100 leading-snug">
                    {activeRule.violation_type}
                  </h2>
                </div>

                {/* 3. Structured 4-Cell Hairline Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-200/60 dark:divide-[#1C2029]">
                  <div className="px-5 py-3 space-y-1">
                    <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                      Уполномоченный орган РК
                    </span>
                    <p className="text-xs font-medium text-gray-800 dark:text-zinc-200">
                      {getIssuerLabel(activeNgr)}
                    </p>
                  </div>

                  <div className="px-5 py-3 grid grid-cols-2 divide-x divide-gray-200/60 dark:divide-[#1C2029]">
                    <div className="pr-3 space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                        Структурный пункт
                      </span>
                      <p className="text-xs font-mono font-semibold text-gray-900 dark:text-zinc-100">
                        {activeRule.clause_ref}
                      </p>
                    </div>
                    <div className="pl-3 space-y-1">
                      <span className="text-[10px] font-mono uppercase tracking-[0.12em] text-gray-400 dark:text-zinc-500 block">
                        Гос. реестр (НГР)
                      </span>
                      <p className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                        {activeNgr} • Действующий
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Official Document Title & Direct URL */}
                <div className="px-5 py-3.5 space-y-2">
                  <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
                    <FileText className="w-3 h-3" />
                    <span>Официальное наименование нормативного правового акта</span>
                  </div>
                  <p className="text-xs text-gray-800 dark:text-zinc-200 leading-relaxed">
                    {activeRule.doc_title}
                  </p>
                  <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-gray-500 dark:text-zinc-400">
                    <span className="truncate">{activeRule.adilet_url}</span>
                    <a
                      href={activeRule.adilet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-900 dark:text-zinc-200 hover:underline flex items-center space-x-1 shrink-0 ml-3"
                    >
                      <span>Перейти к тексту акта</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* 5. Verbatim Normative Requirement */}
                <div className="px-5 py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
                      Диспозиция нормы (нормативное требование)
                    </span>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-500">
                      {activeRule.clause_ref}
                    </span>
                  </div>
                  <p className="text-[13px] text-gray-900 dark:text-zinc-100 leading-relaxed border-l-2 border-gray-900 dark:border-zinc-200 pl-3.5 py-0.5">
                    {activeRule.normative_text}
                  </p>
                </div>

                {/* 6. Visual Computer Vision Trigger Pattern */}
                {activeRule.visual_pattern && (
                  <div className="px-5 py-4 space-y-2 bg-gray-50/30 dark:bg-[#0B0D10]/40">
                    <div className="flex items-center space-x-1.5 text-[10px] font-mono uppercase tracking-[0.14em] text-gray-400 dark:text-zinc-500">
                      <Eye className="w-3 h-3" />
                      <span>Визуальный паттерн видеоаналитики (Stage 1–3)</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-zinc-300 leading-relaxed">
                      {activeRule.visual_pattern}
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        {/* Bottom Status Footer Bar (h-8, hairline top border) */}
        <div className="h-8 px-4 border-t border-gray-200/70 dark:border-[#1C2029] bg-gray-50/70 dark:bg-[#0B0D10] flex items-center justify-between text-[10px] font-mono text-gray-400 dark:text-zinc-500 shrink-0">
          <span>
            Семантический индекс: intfloat/multilingual-e5-small (384d cosine + rule_code boost)
          </span>
          <span className="hidden sm:inline">
            Источник: ИПС НПА РК «Әділет» (adilet.zan.kz)
          </span>
        </div>
      </div>
    </div>
  )
}
