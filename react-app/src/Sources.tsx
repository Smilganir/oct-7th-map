import { useState } from 'react'
import { track } from './track'

const T = {
  en: {
    dir: 'ltr' as const, title: 'Sources and policy', close: 'Close', toggle: 'עברית',
    s: [
      ['Data', <>Victim details (names, ages, gender, role, status, and event location) come from the Oct 7th Database, <a href="https://oct7database.com/" target="_blank" rel="noreferrer">https://oct7database.com/</a>. Numbers cover victims of events that took place between October 7 and 9, 2023, including people injured in the attacks who later died. Data is accurate to the best of our knowledge at the time of publication.</>],
      ['Locations', <>On the regional map, each dot is a location and its size reflects the number of victims. In the settlement view, each dot is one victim and is placed at approximate event coordinates, so positions are schematic.</>],
      ['Photos', <>Photos come from several sources, including memorial sites and other published sources. Where a memorial page exists, the record links to it from the settlement view. Rights in the photos remain with their respective owners. Some entries show a placeholder symbol instead of a photo.</>],
      ['Basemap', <>Aerial imagery: Source: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community. Powered by Esri. Fallback basemap, shown only if the aerial imagery is unavailable: Mapbox (© Mapbox, © OpenStreetMap) or, if that is unavailable, © OpenStreetMap contributors.</>],
      ['Policy', <>By default the map presents aggregate figures. Names and photos appear only in the settlement view. To ask about a photo or a record, including a request for correction or removal, write to <a href="mailto:hello@nirsmilga.com">hello@nirsmilga.com</a> with the name of the person or a link to the record, the details of the request, and a way to reach you.</>],
    ] as [string, JSX.Element][],
    foot: <>Design: Nir Smilga. Based on the &quot;Return to October&quot; exhibition at the Israel Heritage &amp; Commemoration Center (IICC).</>,
  },
  he: {
    dir: 'rtl' as const, title: 'מקורות ומדיניות', close: 'סגירה', toggle: 'English',
    s: [
      ['נתונים', <>פרטי הנפגעים (שמות, גילאים, מגדר, תפקיד, מעמד ומקום האירוע) לקוחים ממאגר Oct 7th Database, <a href="https://oct7database.com/" target="_blank" rel="noreferrer">https://oct7database.com/</a>. המספרים מתייחסים לנפגעי אירועים שהתרחשו בין 7 ל-9 באוקטובר 2023, לרבות פצועים בהתקפות שנפטרו לאחר מכן. הנתונים מדויקים למיטב ידיעתנו במועד הפרסום.</>],
      ['מיקומים', <>במפה האזורית כל נקודה מייצגת מיקום, וגודלה משקף את מספר הנפגעים. בתצוגת היישוב כל נקודה מייצגת נפגע אחד ומוצבת בקואורדינטות אירוע משוערות, ולכן המיקומים סכמטיים.</>],
      ['תמונות', <>התמונות מגיעות ממקורות שונים, ובהם אתרי הנצחה ופרסומים אחרים. כאשר קיים דף הנצחה, הרשומה בתצוגת היישוב מקשרת אליו. הזכויות בתמונות שמורות לבעליהן. בחלק מהרשומות מוצג סימן ממלא מקום במקום תמונה.</>],
      ['מפת רקע', <>תצלומי אוויר: <span dir="ltr" style={{ display: 'block', textAlign: 'right' }}>Source: Esri, Vantor, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community. Powered by Esri.</span> מפת גיבוי, מוצגת רק אם תצלומי האוויר אינם זמינים: <span dir="ltr" style={{ display: 'block', textAlign: 'right' }}>© Mapbox, © OpenStreetMap contributors</span></>],
      ['מדיניות', <>כברירת מחדל המפה מציגה נתונים מצטברים. שמות ותמונות מופיעים בתצוגת היישוב בלבד. לפנייה בנוגע לתמונה או לרשומה, לרבות בקשת תיקון או הסרה, ניתן לפנות אל <a href="mailto:hello@nirsmilga.com">hello@nirsmilga.com</a> ולציין את שם האדם או קישור לרשומה, את פרטי הבקשה ודרך ליצירת קשר.</>],
    ] as [string, JSX.Element][],
    foot: <>עיצוב: ניר סמילגה. מבוסס על התערוכה Return to October של Israel Heritage &amp; Commemoration Center (IICC).</>,
  },
}

export default function Sources({ onClose, lang: l0 }: { onClose: () => void; lang: 'en' | 'he' }) {
  const [lang, setLang] = useState<'en' | 'he'>(l0)
  const t = T[lang]
  return (
    <div className="src" dir={t.dir} lang={lang} onClick={e => e.stopPropagation()}>
      <div className="srcbar"><button onClick={() => { const n = lang === 'en' ? 'he' : 'en'; track('lang_toggle', { to: n, where: 'sources' }); setLang(n) }}>{t.toggle}</button><button onClick={onClose}>{t.close}</button></div>
      <h2>{t.title}</h2>
      {t.s.map(([h, b]) => <section key={h}><h3>{h}</h3><p>{b}</p></section>)}
      <p className="sf">{t.foot}</p>
    </div>
  )
}
