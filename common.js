const RTL_LANGS = ['ar', 'ur'];

function injectLangSwitcher() {
    const header = document.querySelector('header');
    if (!header) return;

    const select = document.createElement('select');
    select.id = 'lang-switcher';
    select.setAttribute('aria-label', 'Select language');

    [
        ['en', 'EN'], ['zh', '中文'], ['hi', 'हि'], ['es', 'ES'],
        ['fr', 'FR'], ['ar', 'ع'],   ['bn', 'বাং'], ['pt', 'PT'],
        ['da', 'DA'], ['ur', 'اردو'],
    ].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        select.appendChild(opt);
    });

    select.addEventListener('change', () => {
        localStorage.setItem('lang', select.value);
        applyTranslations(select.value);
    });

    header.appendChild(select);
}

function applyTranslations(lang) {
    if (typeof translations === 'undefined') return;
    const t = translations[lang] || translations['en'];

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (t[key] !== undefined) el.textContent = t[key];
    });

    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS.includes(lang) ? 'rtl' : 'ltr';

    const switcher = document.getElementById('lang-switcher');
    if (switcher) switcher.value = lang;
}

const currentLang = localStorage.getItem('lang') || 'en';
injectLangSwitcher();
applyTranslations(currentLang);

// Lightbox (only on pages that have one)
const lightbox = document.getElementById('lightbox');
if (lightbox) {
    const lightboxImg = lightbox.querySelector('img');

    document.querySelectorAll('.gallery-item').forEach(img => {
        img.addEventListener('click', () => {
            lightboxImg.src = img.src;
            lightboxImg.alt = img.alt;
            lightbox.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeLightbox() {
        lightbox.classList.remove('active');
        document.body.style.overflow = '';
    }

    document.getElementById('lightbox-close').addEventListener('click', closeLightbox);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}
