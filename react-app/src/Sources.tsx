import { useState } from 'react'

const T = {
  en: {
    dir: 'ltr' as const, title: 'Sources and policy', close: 'Close', toggle: 'עברית',
    s: [
      ['Data', <>Victim details (names, ages, gender, role, status, and event location) come from the Oct 7th Database, <a href="https://oct7database.com/" target="_blank" rel="noreferrer">https://oct7database.com/</a>. Numbers cover victims of events that took place between October 7 and 9, 2023, including people injured in the attacks who later died. Data is accurate to the best of our knowledge at the time of publication.</>],
      ['Locations', <>On the regional map, each dot is a location and its size reflects the number of victims. In the settlement view, each dot is one victim and is placed at approximate event coordinates, so positions are schematic.</>],
      ['Photos', <>Photos are shown as published by the memorial sites of the National Insurance Institute (laad.btl.gov.il) and the Israel Defense Forces (idf.il), and as in the Commission&apos;s report. The images belong to their owners and are loaded from their original sources.</>],
      ['Basemap', <>Aerial imagery: Esri, Maxar, Earthstar Geographics.</>],
      ['Policy', <>By default the map presents aggregate figures. Names and photos appear only in the settlement view, as published in the Commission&apos;s report. A family member who wants an entry corrected or removed can contact <a href="mailto:hello@nirsmilga.com">hello@nirsmilga.com</a>, and we will act on it.</>],
    ] as [string, JSX.Element][],
    foot: <>Design: Nir Smilga. Based on the &quot;Return to October&quot; exhibition at the Israel Heritage &amp; Commemoration Center (IICC).</>,
  },
  he: {
    dir: 'rtl' as const, title: 'מקורות ומדיניות', close: 'סגירה', toggle: 'English',
    s: [
      ['נתונים', <>פרטי הנפגעים (שמות, גילאים, מגדר, תפקיד, מעמד ומקום האירוע) לקוחים ממאגר Oct 7th Database, <a href="https://oct7database.com/" target="_blank" rel="noreferrer">https://oct7database.com/</a>. המספרים מתייחסים לנפגעי אירועים שהתרחשו בין 7 ל-9 באוקטובר 2023, לרבות פצועים בהתקפות שנפטרו לאחר מכן. הנתונים מדויקים למיטב ידיעתנו במועד הפרסום.</>],
      ['מיקומים', <>במפה האזורית כל נקודה מייצגת מיקום, וגודלה משקף את מספר הנפגעים. בתצוגת היישוב כל נקודה מייצגת נפגע אחד ומוצבת בקואורדינטות אירוע משוערות, ולכן המיקומים סכמטיים.</>],
      ['תמונות', <>התמונות מוצגות כפי שפורסמו באתרי ההנצחה של המוסד לביטוח לאומי (laad.btl.gov.il) ושל צה&quot;ל (idf.il), וכפי שפורסמו בדוח הוועדה. הזכויות בתמונות שייכות לבעליהן, והן נטענות מהמקורות המקוריים.</>],
      ['מפת רקע', <>תצלומי אוויר: Esri, Maxar, Earthstar Geographics.</>],
      ['מדיניות', <>כברירת מחדל המפה מציגה נתונים מצטברים. שמות ותמונות מופיעים בתצוגת היישוב בלבד, כפי שפורסמו בדוח הוועדה. בן משפחה המבקש לתקן או להסיר רשומה מוזמן לפנות אל <a href="mailto:hello@nirsmilga.com">hello@nirsmilga.com</a>, ונטפל בפנייה.</>],
    ] as [string, JSX.Element][],
    foot: <>עיצוב: ניר סמילגה. מבוסס על התערוכה Return to October של Israel Heritage &amp; Commemoration Center (IICC).</>,
  },
}

export default function Sources({ onClose }: { onClose: () => void }) {
  const [lang, setLang] = useState<'en' | 'he'>('en')
  const t = T[lang]
  return (
    <div className="src" dir={t.dir} lang={lang} onClick={e => e.stopPropagation()}>
      <div className="srcbar"><button onClick={() => setLang(lang === 'en' ? 'he' : 'en')}>{t.toggle}</button><button onClick={onClose}>{t.close}</button></div>
      <h2>{t.title}</h2>
      {t.s.map(([h, b]) => <section key={h}><h3>{h}</h3><p>{b}</p></section>)}
      <p className="sf">{t.foot}</p>
    </div>
  )
}
