export type Lang = 'en' | 'he'
export const HE_NAMES: Record<string, string> = {
  'Sderot': 'שדרות', 'Netivot': 'נתיבות', 'Ofakim': 'אופקים', 'Zikim Base': 'בסיס זיקים', 'Erez Checkpoint': 'מעבר/קיבוץ ארז', 'MASA Erez': 'מוצב מש״א ארז', 'Zikim Firing Ranges': 'מטווחי זיקים / כוח הסיור', 'Mivtahim Junction': 'צומת מבטחים',
  'Nahal Oz base': 'בסיס נחל עוז', "Re'im Base": 'בסיס רעים', 'Kisufim Base': 'בסיס כיסופים', 'Urim base': 'בסיס אורים',
  'Netiv HaAsara': 'נתיב העשרה', 'Mefalsim': 'מפלסים', 'Kfar Aza': 'כפר עזה', 'Yakhini': 'יכיני', 'Kibbutz Nahal Oz': 'קיבוץ נחל עוז',
  'Alumim': 'עלומים', "Be'eri": 'בארי', 'Nova': 'נובה', "Re'im": 'רעים', 'Ein HaShlosha': 'עין השלושה', 'Nirim': 'נירים',
  'Nir Oz': 'ניר עוז', 'Magen': 'מגן', 'Holit': 'חולית', 'Sufa': 'סופה', 'Nir Yitzhak': 'ניר יצחק', 'Pri Gan': 'פרי גן',
  'Kerem Shalom': 'כרם שלום', 'Yiftah Base': 'בסיס יפתח', 'Zikim': 'זיקים', 'Paga Base': 'בסיס פגה', 'Sufa Base': 'בסיס סופה',
  'Psyduck': 'פסיידאק', 'Gama jct': 'צומת גמה', 'Mivtahim': 'מבטחים', 'Kisufim': 'כיסופים', "Sha'ar HaNegev jct": 'צומת שער הנגב',
  'Maon jct': 'צומת מעון', 'Mop Darom': 'מוצב מופ דרום', 'White House post': 'מוצב הבית הלבן', 'Nir Am': 'ניר עם', 'K2 Outpost': 'מוצב K2',
  '?': 'מיקומים מפוזרים',
}
export const S = {
  en: {
    title: 'Oct-7th Hamas Massacre in Gaza Envelope', tot1: 'Total', fat: 'Fatalities', hostages: 'hostages', civ: 'civilians', killed: 'killed',
    hk: 'kidnapped and killed or killed and kidnapped', additional: 'Additional', ret: 'kidnapped and returned alive',
    fn1: 'Numbers refer to victims of events occurring between October 7–9, 2023, including individuals injured during the attacks and subsequently died.', fn1b: 'The majority of the victims were murdered within a few hours of the attack.',
    fn2: 'An additional 22 (including 4 females) individuals were killed outside the Gaza Envelope; their locations are therefore not reflected on this map.',
    hint: 'Click on the map locations to zoom in', scattered: 'Scattered locations', legendBtn: 'Legend', sizeLeg1: '# of victims', sizeLeg2: 'per location',
    leg: ['Military Bases', 'Civilian Locations', 'The “Nova” party', 'The “Psyduck” party', 'Border intrusion areas', 'Limits of the Hamas Massacre', 'Gaza Strip Border'],
    cCiv: 'Civilian Victims Distribution', sec: 'Security Forces on Duty', civs: 'Civilians', cGen: "Victims' Gender", incl: '(including hostages)', fem: 'Female', male: 'Male',
    cAge: "Victims' Age Distribution", excl: (n: number) => `*excluding ${n} victims with no age data`, phot: 'Photos as published in public sources',
    data: 'Data:', disc: 'Disclaimer:', discT: 'All data is accurate to the best of our knowledge at the time of publication', src: 'Sources & policy', design: 'Design:', dname: 'Nir Smilga', based: "Based on 'Return to October' exhibition at the Israel Heritage & Commemoration Center (IICC)",
    victims: 'Victims', ttK: 'Killed', ttHK: 'Kidnapped and killed', ttR: 'Kidnapped and returned alive', view: 'View victims ›',
    vic: 'victims', vicinity: 'Vicinity', schem: "Victims' locations are schematic and represent approximate event coordinates. Points at the same location are slightly spread for readability.", back: '◄ Back to Regional Map',
    dKK: 'Kidnapped,Killed', dKA: 'Kidnapped,alive', dK: 'Killed', toggle: 'עב', hideLeg: 'Hide legend', hideSize: 'Hide size legend',
  },
  he: {
    title: 'טבח ה-7 באוקטובר בעוטף עזה', tot1: 'סה״כ', fat: 'הרוגים', hostages: 'חטופים', civ: 'אזרחים', killed: 'נהרגו',
    hk: 'נחטפו ונהרגו או נהרגו ונחטפו', additional: 'בנוסף', ret: 'נחטפו וחזרו בחיים',
    fn1: 'המספרים מתייחסים לנפגעי אירועים שהתרחשו בין 7 ל-9 באוקטובר 2023, לרבות פצועים בהתקפות שנפטרו לאחר מכן.', fn1b: 'רוב הנפגעים נרצחו תוך שעות ספורות מתחילת ההתקפה.',
    fn2: '22 אנשים נוספים (כולל 4 נשים) נהרגו מחוץ לעוטף עזה, ולכן מיקומם אינו מופיע במפה זו.',
    hint: 'לחצו על מיקומים במפה כדי להתקרב', scattered: 'מיקומים מפוזרים', legendBtn: 'מקרא', sizeLeg1: 'מספר נפגעים', sizeLeg2: 'לכל מיקום',
    leg: ['בסיסים צבאיים', 'מיקומים אזרחיים', 'מסיבת "נובה"', 'מסיבת "פסיידאק"', 'אזורי חדירה מהגבול', 'גבולות הטבח של חמאס', 'גבול רצועת עזה'],
    cCiv: 'התפלגות נפגעים אזרחים', sec: 'כוחות ביטחון בתפקיד', civs: 'אזרחים', cGen: 'מגדר הנפגעים', incl: '(כולל חטופים)', fem: 'נשים', male: 'גברים',
    cAge: 'התפלגות גילאי הנפגעים', excl: (n: number) => `*לא כולל ${n} נפגעים ללא נתוני גיל`, phot: 'התמונות כפי שפורסמו במקורות פומביים',
    data: 'נתונים:', disc: 'הבהרה:', discT: 'כל הנתונים מדויקים למיטב ידיעתנו במועד הפרסום', src: 'מקורות ומדיניות', design: 'עיצוב:', dname: 'ניר סמילגה', based: 'מבוסס על התערוכה Return to October ב-Israel Heritage & Commemoration Center (IICC)',
    victims: 'נפגעים', ttK: 'נהרגו', ttHK: 'נחטפו ונהרגו', ttR: 'נחטפו וחזרו בחיים', view: '‹ לצפייה בנפגעים',
    vic: 'נפגעים', vicinity: 'והסביבה', schem: 'מיקומי הנפגעים סכמטיים ומייצגים קואורדינטות אירוע משוערות. נקודות באותו מיקום מפוזרות מעט לשם קריאות.', back: 'חזרה למפה האזורית ►',
    dKK: 'נחטפו, נהרגו', dKA: 'נחטפו, בחיים', dK: 'נהרגו', toggle: 'En', hideLeg: 'הסתר מקרא', hideSize: 'הסתר מקרא גודל',
  },
}
export const initLang = (): Lang => {
  try {
    const q = new URLSearchParams(location.search).get('lang')
    if (q === 'he' || q === 'en') return q
    const s = localStorage.getItem('o7lang'); if (s === 'he' || s === 'en') return s
  } catch { /* ignore */ }
  return 'en'
}
