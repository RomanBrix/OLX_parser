# Olx parser

### Що робить:

-   Парсить одну категорію, а саме першу сторінку
-   Збирає "статистику" по оголошенням на сторінці (позиції)
-   відкриває кожне оголошення та збирає задану інформацію
-   записує невідомі оголошення в бд
-   перевіряє на те як змінились оголошення відповідно до тих що були в бд
-   перевіряє оголошення які саме нас цікавлять (чи є в списку, скільки разів і т д). Перевіряє за наявністю `HIGHLIGHT_TEXT` в описі оголошення (унікальний текст)
-   відправляє дані в бота

### Як налаштувати:

всі необхідні налаштування які потрібно вказати - знаходяться в `.env` - файлі та мають опис
