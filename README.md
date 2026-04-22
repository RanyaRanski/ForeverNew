# Forever Living — Static HTML version

Чистий статичний сайт без фреймворків. Просто відкрий `index.html` у браузері.

## Структура

```
static/
├── index.html          # Єдина сторінка з усіма секціями
├── css/
│   ├── main.css        # Базові токени, типографіка, кнопки, утиліти
│   ├── header.css      # Шапка + мобільне меню
│   ├── hero.css        # Hero-секція
│   ├── marquee.css     # Біжучий рядок
│   ├── about.css       # Про нас + статистика
│   ├── products.css    # 3 категорії продуктів
│   ├── nutrition.css   # Консультації нутриціолога
│   ├── business.css    # FBO, переваги, 3 кроки
│   ├── testimonials.css# Відгуки
│   ├── contact.css     # Контактна форма
│   └── toast.css       # Сповіщення
├── js/
│   └── main.js         # Мобільне меню + сабміт форми + тости
└── images/
    ├── hero-aloe.jpg
    ├── product-aloe-gel.jpg
    ├── product-nutrition.jpg
    ├── product-beauty.jpg
    └── business-lifestyle.jpg
```

## Запуск
- Просто відкрити `index.html` у браузері, або
- Запустити локальний сервер: `python3 -m http.server 8000` у папці `static/` і відкрити http://localhost:8000

## Хостинг
Можна викласти на будь-який статичний хостинг: GitHub Pages, Netlify, Vercel, Cloudflare Pages, звичайний Apache/Nginx.

## Кольори (Forever Living)
- `--lime` — золотистий жовтий акцент
- `--mint` — зелень алое
- `--forest` — глибокий гірчично-жовтий (текст / темні секції)
- `--cream` — теплий світлий фон
