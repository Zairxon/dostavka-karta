// Четыре языка: русский, узбекский (латиница), узбекский (кириллица, получается из латиницы), английский.
export const LANGS = [
  { v: 'ru', l: 'Русский' },
  { v: 'uzl', l: "O'zbekcha (lotin)" },
  { v: 'uzc', l: 'Ўзбекча (кирилл)' },
  { v: 'en', l: 'English' },
];

const S = {
  app_name: ['Карта доставки', 'Yetkazib berish xaritasi', 'Delivery map'],
  login_title: ['Вход', 'Kirish', 'Sign in'],
  login: ['Логин', 'Login', 'Login'],
  password: ['Пароль', 'Parol', 'Password'],
  sign_in: ['Войти', 'Kirish', 'Sign in'],
  sign_out: ['Выйти', 'Chiqish', 'Sign out'],
  bad_login: ['Неверный логин или пароль', "Login yoki parol noto'g'ri", 'Wrong login or password'],
  version: ['Версия', 'Versiya', 'Version'],
  update_avail: ['Есть обновление', 'Yangilanish bor', 'Update available'],
  update_btn: ['Обновить', 'Yangilash', 'Update'],
  language: ['Язык', 'Til', 'Language'],
  change_pass: ['Сменить пароль', "Parolni o'zgartirish", 'Change password'],
  old_pass: ['Старый пароль', 'Eski parol', 'Old password'],
  new_pass: ['Новый пароль', 'Yangi parol', 'New password'],
  short_pass: ['Пароль не короче 4 символов', "Parol kamida 4 belgidan iborat bo'lsin", 'Password must be at least 4 characters'],
  pass_changed: ['Пароль изменён', "Parol o'zgartirildi", 'Password changed'],
  cancel: ['Отмена', 'Bekor qilish', 'Cancel'],
  ok: ['Понятно', 'Tushunarli', 'OK'],
  save: ['Сохранить', 'Saqlash', 'Save'],
  saved: ['Сохранено', 'Saqlandi', 'Saved'],
  delete: ['Удалить', "O'chirish", 'Delete'],
  edit: ['Изменить', "O'zgartirish", 'Edit'],
  add: ['Добавить', "Qo'shish", 'Add'],
  fill_required: ['Заполните обязательные поля', "Majburiy maydonlarni to'ldiring", 'Fill in the required fields'],
  bad_phone: ['Неверный номер', "Noto'g'ri raqam", 'Invalid number'],
  offline: ['Нет связи с сервером', "Server bilan aloqa yo'q", 'No connection to the server'],
  error_generic: ['Не получилось. Попробуйте ещё раз', "Bajarilmadi. Qayta urinib ko'ring", 'Something went wrong. Try again'],
  forbidden: ['Нет доступа', "Ruxsat yo'q", 'No access'],
  not_found: ['Не найдено', 'Topilmadi', 'Not found'],
  loading: ['Загрузка…', 'Yuklanmoqda…', 'Loading…'],

  role_admin: ['Администратор', 'Administrator', 'Administrator'],
  role_agent: ['Агент', 'Agent', 'Agent'],
  role_courier: ['Доставщик', 'Yetkazuvchi', 'Courier'],

  tab_map: ['Карта', 'Xarita', 'Map'],
  tab_orders: ['Заказы', 'Buyurtmalar', 'Orders'],
  tab_stock: ['Склад', 'Ombor', 'Stock'],
  tab_people: ['Люди', 'Xodimlar', 'People'],
  tab_more: ['Ещё', 'Yana', 'More'],
  tab_route: ['Маршрут', "Yo'nalish", 'Route'],
  tab_points: ['Точки', 'Nuqtalar', 'Points'],

  shop: ['Магазин', "Do'kon", 'Shop'],
  warehouse: ['Склад', 'Ombor', 'Warehouse'],
  points: ['Точки', 'Nuqtalar', 'Points'],
  point_name: ['Название', 'Nomi', 'Name'],
  address: ['Адрес / ориентир', "Manzil / mo'ljal", 'Address / landmark'],
  phone: ['Телефон', 'Telefon', 'Phone'],
  add_shop: ['Новый магазин', "Yangi do'kon", 'New shop'],
  add_wh: ['Новый склад', 'Yangi ombor', 'New warehouse'],
  edit_point: ['Точка', 'Nuqta', 'Point'],
  pick_on_map: ['Нажмите на карте, где находится точка', 'Nuqta joylashgan joyni xaritada bosing', 'Tap the map where the point is'],
  pick_cancel: ['Отменить выбор', 'Tanlovni bekor qilish', 'Cancel selection'],
  my_place: ['Моё место', 'Mening joyim', 'My location'],
  place_here: ['Поставить здесь', "Shu yerga qo'yish", 'Place here'],
  point_busy: ['По этой точке есть незавершённые заказы', 'Bu nuqta bo\'yicha tugallanmagan buyurtmalar bor', 'This point has unfinished orders'],
  confirm_delete: ['Удалить?', "O'chirilsinmi?", 'Delete?'],
  nothing: ['Пока ничего нет', "Hozircha hech narsa yo'q", 'Nothing here yet'],
  show_on_map: ['Показать на карте', "Xaritada ko'rsatish", 'Show on map'],

  products: ['Товары', 'Mahsulotlar', 'Products'],
  product_name: ['Название товара', 'Mahsulot nomi', 'Product name'],
  unit: ['Единица', 'Birlik', 'Unit'],
  unit_pcs: ['шт', 'dona', 'pcs'],
  unit_block: ['блок', 'blok', 'block'],
  unit_box: ['коробка', 'quti', 'box'],
  cap_per_unit: ['Мест в кузове на единицу', "Kuzovda bir birlik egallaydigan joy", 'Truck space per unit'],
  add_product: ['Новый товар', 'Yangi mahsulot', 'New product'],
  product_busy: ['Товар есть в незавершённых заказах', 'Mahsulot tugallanmagan buyurtmalarda bor', 'Product is in unfinished orders'],

  stock: ['Остатки', 'Qoldiq', 'Stock'],
  receive: ['Приход', 'Kirim', 'Receive'],
  writeoff: ['Списание', 'Chiqim', 'Write off'],
  qty: ['Количество', 'Miqdor', 'Quantity'],
  reason: ['Комментарий', 'Izoh', 'Comment'],
  moves: ['История склада', 'Ombor tarixi', 'Stock history'],
  no_moves: ['Движений пока нет', "Harakatlar hozircha yo'q", 'No movements yet'],
  not_enough_stock: ['На складе столько нет', "Omborda buncha yo'q", 'Not enough in stock'],
  bad_qty: ['Неверное количество', "Noto'g'ri miqdor", 'Invalid quantity'],
  choose_wh: ['Выберите склад', 'Omborni tanlang', 'Choose a warehouse'],
  choose_product: ['Выберите товар', 'Mahsulotni tanlang', 'Choose a product'],
  no_wh: ['Сначала добавьте склад', "Avval ombor qo'shing", 'Add a warehouse first'],
  no_products: ['Сначала добавьте товары', "Avval mahsulot qo'shing", 'Add products first'],
  order_move: ['Выдано по заказу', 'Buyurtma bo\'yicha berildi', 'Issued for order'],

  orders: ['Заказы', 'Buyurtmalar', 'Orders'],
  new_order: ['Новый заказ', 'Yangi buyurtma', 'New order'],
  choose_shop: ['Магазин', "Do'kon", 'Shop'],
  items: ['Состав заказа', 'Buyurtma tarkibi', 'Order items'],
  add_item: ['Добавить товар', "Mahsulot qo'shish", 'Add item'],
  note: ['Примечание', 'Izoh', 'Note'],
  need_items: ['Добавьте хотя бы один товар', "Kamida bitta mahsulot qo'shing", 'Add at least one item'],
  order_no: ['Заказ №', 'Buyurtma №', 'Order #'],
  agent: ['Агент', 'Agent', 'Agent'],
  courier: ['Доставщик', 'Yetkazuvchi', 'Courier'],
  unassigned: ['Не назначен', 'Tayinlanmagan', 'Unassigned'],
  assign: ['Назначить доставщика', 'Yetkazuvchini tayinlash', 'Assign courier'],
  unassign: ['Снять с доставщика', 'Yetkazuvchidan olish', 'Unassign'],
  cancel_order: ['Отменить заказ', 'Buyurtmani bekor qilish', 'Cancel order'],
  status_new: ['Новый', 'Yangi', 'New'],
  status_assigned: ['Назначен', 'Tayinlangan', 'Assigned'],
  status_picked: ['Загружен', 'Yuklangan', 'Loaded'],
  status_delivered: ['Доставлен', 'Yetkazilgan', 'Delivered'],
  status_cancelled: ['Отменён', 'Bekor qilingan', 'Cancelled'],
  over_capacity: ['Не помещается в кузов этого доставщика', 'Bu yetkazuvchining kuzoviga sig\'maydi', 'Does not fit in this courier\'s truck'],
  bad_status: ['Статус заказа уже изменился', "Buyurtma holati allaqachon o'zgargan", 'The order status has already changed'],
  order_created: ['Заказ создан', 'Buyurtma yaratildi', 'Order created'],
  active: ['Активные', 'Faol', 'Active'],
  done_recent: ['Завершённые (3 дня)', 'Tugallangan (3 kun)', 'Finished (3 days)'],

  people: ['Люди', 'Xodimlar', 'People'],
  add_user: ['Новый сотрудник', 'Yangi xodim', 'New user'],
  edit_user: ['Сотрудник', 'Xodim', 'User'],
  full_name: ['Имя', 'Ism', 'Name'],
  user_role: ['Роль', 'Rol', 'Role'],
  capacity: ['Вместимость кузова (мест)', "Kuzov sig'imi (joy)", 'Truck capacity (spaces)'],
  is_active: ['Работает', 'Ishlaydi', 'Active'],
  login_taken: ['Такой логин уже есть', 'Bunday login mavjud', 'This login is already taken'],
  self_lock: ['Нельзя отключить или удалить себя', "O'zingizni o'chirib bo'lmaydi", "You can't disable or delete yourself"],
  need_login_pass: ['Нужны логин и пароль', 'Login va parol kerak', 'Login and password required'],
  new_pass_opt: ['Новый пароль (пусто — не менять)', "Yangi parol (bo'sh — o'zgarmaydi)", 'New password (empty — keep)'],
  yes: ['Да', 'Ha', 'Yes'],
  no: ['Нет', "Yo'q", 'No'],

  route: ['Маршрут', "Yo'nalish", 'Route'],
  build_route: ['Построить маршрут', "Yo'nalishni qurish", 'Build route'],
  rebuilding: ['Считаю лучший путь…', "Eng yaxshi yo'l hisoblanmoqda…", 'Calculating the best route…'],
  no_stops: ['Заданий пока нет', "Hozircha topshiriq yo'q", 'No tasks yet'],
  stop_pickup: ['Забрать на складе', 'Omborda olish', 'Pick up at warehouse'],
  stop_deliver: ['Доставить', 'Yetkazish', 'Deliver'],
  stop_visit: ['Заехать', "Kirib o'tish", 'Visit'],
  btn_picked: ['Забрал', 'Oldim', 'Picked up'],
  btn_delivered: ['Доставил', 'Yetkazdim', 'Delivered'],
  btn_visited: ['Был здесь', 'Shu yerda bo\'ldim', 'Visited'],
  btn_remove: ['Убрать', 'Olib tashlash', 'Remove'],
  picked_ok: ['Товар получен со склада', 'Mahsulot ombordan olindi', 'Goods picked up'],
  nothing_to_pick: ['На этом складе для вас ничего нет', 'Bu omborda siz uchun hech narsa yo\'q', 'Nothing for you at this warehouse'],
  not_picked: ['Сначала заберите весь товар на складе', 'Avval hamma mahsulotni ombordan oling', 'Pick up all goods at the warehouse first'],
  delivered_ok: ['Доставка отмечена', 'Yetkazish belgilandi', 'Delivery marked'],
  shortage: ['Не хватает на складах', 'Omborlarda yetishmaydi', 'Not enough in warehouses'],
  on_the_way: ['Склад по пути', "Yo'l-yo'lakay ombor", 'Warehouse on the way'],
  on_the_way_hint: ['можно забрать товар (+{m} мин)', 'mahsulot olish mumkin (+{m} daqiqa)', 'you can pick up goods (+{m} min)'],
  total: ['Всего', 'Jami', 'Total'],
  min: ['мин', 'daqiqa', 'min'],
  km: ['км', 'km', 'km'],
  load: ['Загрузка', 'Yuklama', 'Load'],
  approx: ['Приблизительно (нет связи с картой дорог)', "Taxminan (yo'l xaritasi bilan aloqa yo'q)", 'Approximate (road service unavailable)'],
  my_marks: ['Мои точки', 'Mening nuqtalarim', 'My points'],
  mark_point: ['Отметить точку', 'Nuqtani belgilash', 'Mark a point'],
  mark_for: ['Отправить доставщика на точку', 'Yetkazuvchini nuqtaga yo\'naltirish', 'Send a courier to a point'],
  marked: ['Точка добавлена в маршрут', "Nuqta yo'nalishga qo'shildi", 'Point added to the route'],
  gps_off: ['Не удаётся определить местоположение', "Joylashuvni aniqlab bo'lmadi", 'Cannot get your location'],
  couriers_live: ['Доставщики на карте', 'Xaritadagi yetkazuvchilar', 'Couriers on the map'],
  seen: ['был(а) в сети', "so'nggi marta", 'last seen'],
  ago_min: ['{m} мин назад', '{m} daqiqa oldin', '{m} min ago'],
  just_now: ['только что', 'hozirgina', 'just now'],
  no_signal: ['нет данных', "ma'lumot yo'q", 'no data'],
  open_nav: ['Открыть в навигаторе', 'Navigatorda ochish', 'Open in navigator'],
  legend_shop: ['Магазин', "Do'kon", 'Shop'],
  legend_wh: ['Склад', 'Ombor', 'Warehouse'],
  legend_courier: ['Доставщик', 'Yetkazuvchi', 'Courier'],
  auth: ['Нужно войти заново', 'Qayta kiring', 'Please sign in again'],
  bad_kind: ['Неверный тип точки', "Nuqta turi noto'g'ri", 'Invalid point type'],
  need_name: ['Укажите название', 'Nomini kiriting', 'Enter a name'],
  notif_new_order: ['Новый заказ №{n}: {shop}', 'Yangi buyurtma №{n}: {shop}', 'New order #{n}: {shop}'],
  notif_assigned: ['Вам назначен заказ №{n}: {shop}', 'Sizga buyurtma №{n} tayinlandi: {shop}', 'Order #{n} assigned to you: {shop}'],
  notif_unassigned: ['Заказ №{n} снят с вас', 'Buyurtma №{n} sizdan olindi', 'Order #{n} was taken off you'],
  notif_delivered: ['Заказ №{n} доставлен: {shop}', 'Buyurtma №{n} yetkazildi: {shop}', 'Order #{n} delivered: {shop}'],
  notif_cancelled: ['Заказ №{n} отменён: {shop}', 'Buyurtma №{n} bekor qilindi: {shop}', 'Order #{n} cancelled: {shop}'],
  notif_on: ['Системные уведомления', 'Tizim bildirishnomalari', 'System notifications'],
  notif_enable: ['Включить уведомления', 'Bildirishnomalarni yoqish', 'Enable notifications'],
  notif_enabled: ['Уведомления включены', 'Bildirishnomalar yoqilgan', 'Notifications are on'],
  notif_denied: ['Уведомления запрещены в браузере', 'Bildirishnomalar brauzerda taqiqlangan', 'Notifications are blocked in the browser'],
  notif_hint: ['Работают, пока приложение открыто (в том числе в фоне)', "Ilova ochiq bo'lganda ishlaydi (fonda ham)", 'Work while the app is open (also in background)'],
  search: ['Поиск', 'Qidiruv', 'Search'],
  search_ph: ['Название или адрес', 'Nomi yoki manzil', 'Name or address'],
  search_none: ['Ничего не найдено', 'Hech narsa topilmadi', 'Nothing found'],
  report: ['Отчёты', 'Hisobotlar', 'Reports'],
  period: ['Период', 'Davr', 'Period'],
  p_today: ['Сегодня', 'Bugun', 'Today'],
  p_7: ['7 дней', '7 kun', '7 days'],
  p_30: ['30 дней', '30 kun', '30 days'],
  r_created: ['Создано заказов', 'Yaratilgan buyurtmalar', 'Orders created'],
  r_delivered: ['Доставлено', 'Yetkazildi', 'Delivered'],
  r_cancelled: ['Отменено', 'Bekor qilindi', 'Cancelled'],
  r_open: ['В работе сейчас', 'Hozir jarayonda', 'In progress now'],
  r_couriers: ['Доставщики', 'Yetkazuvchilar', 'Couriers'],
  r_agents: ['Агенты', 'Agentlar', 'Agents'],
  r_products: ['Доставлено по товарам', 'Mahsulotlar bo\'yicha yetkazildi', 'Delivered by product'],
  r_shops: ['Магазины с наибольшим числом доставок', "Eng ko'p yetkazilgan do'konlar", 'Shops with most deliveries'],
  r_orders_n: ['заказов', 'buyurtma', 'orders'],
  r_stock_total: ['Остатки на складах', 'Ombor qoldiqlari', 'Warehouse stock'],
  region: ['Регион', 'Hudud', 'Region'],
  region_khorezm: ['Хорезмская область', 'Xorazm viloyati', 'Khorezm region'],
  region_kk: ['Каракалпакстан', "Qoraqalpog'iston", 'Karakalpakstan'],
  go_region: ['Перейти к региону', "Hududga o'tish", 'Go to region'],
  as_user: ['Вы вошли как', 'Siz quyidagi sifatida kirdingiz', 'Signed in as'],
  back_admin: ['Вернуться', 'Qaytish', 'Go back'],
  switch_user: ['Войти как сотрудник', 'Xodim sifatida kirish', 'Sign in as an employee'],
  open_yandex: ['Открыть в Яндекс Картах', 'Yandex Xaritada ochish', 'Open in Yandex Maps'],
  open_google: ['Открыть в Google Maps', 'Google Maps da ochish', 'Open in Google Maps'],
  nav_app: ['Навигатор', 'Navigator', 'Navigator'],
  route_all: ['Весь маршрут в навигаторе', "Butun yo'nalishni navigatorda ochish", 'Open the whole route in navigator'],
  route_to_wh: ['К складу', 'Omborga', 'To warehouse'],
  route_to_shop: ['К магазину', "Do'konga", 'To shop'],
  route_to_pt: ['К точке', 'Nuqtaga', 'To point'],
  gps_denied: ['Доступ к местоположению запрещён. Разрешите его для этого сайта в настройках браузера и обновите страницу', "Joylashuvga ruxsat berilmagan. Brauzer sozlamalarida bu sayt uchun ruxsat bering va sahifani yangilang", 'Location access is blocked. Allow it for this site in the browser settings and reload'],
  gps_unavailable: ['Местоположение недоступно. Включите геолокацию (GPS) на телефоне', "Joylashuv mavjud emas. Telefonda geolokatsiyani (GPS) yoqing", 'Location is unavailable. Turn on location (GPS) on your phone'],
  gps_timeout: ['Не удаётся быстро определить место. Выйдите на открытое место и нажмите ◉', "Joylashuvni tez aniqlab bo'lmadi. Ochiq joyga chiqing va ◉ ni bosing", 'Cannot get your location yet. Move to an open area and tap ◉'],
  need_coords: ['Укажите точку на карте', 'Nuqtani xaritada belgilang', 'Pick the point on the map'],
};

const cyr = (() => {
  const two = [['sh', 'ш'], ['ch', 'ч'], ['yo', 'ё'], ['yu', 'ю'], ['ya', 'я'], ['ye', 'е'], ['ng', 'нг'], ['ts', 'ц'],
    ["o'", 'ў'], ["o‘", 'ў'], ["oʻ", 'ў'], ["g'", 'ғ'], ["g‘", 'ғ'], ["gʻ", 'ғ']];
  const one = { a: 'а', b: 'б', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', x: 'х', y: 'й', z: 'з' };
  return s => {
    let out = '';
    for (let i = 0; i < s.length;) {
      const low = s.slice(i, i + 2).toLowerCase(); let hit = null;
      for (const [k, v] of two) if (low === k) { hit = [k, v]; break; }
      const prev = s[i - 1], atStart = !prev || /[^a-zA-Z'ʻ‘]/.test(prev);
      if (hit) {
        let v = hit[1];
        if (hit[0] === 'ye' && atStart) v = 'е';
        const up = s[i] !== s[i].toLowerCase();
        out += up ? (s[i + 1] !== s[i + 1].toLowerCase() ? v.toUpperCase() : v[0].toUpperCase() + v.slice(1)) : v; i += 2; continue;
      }
      const c = s[i], lc = c.toLowerCase();
      if (lc === 'e' && atStart) { out += c === lc ? 'э' : 'Э'; i++; continue; }
      if (lc === "'" || lc === 'ʼ' || lc === '’') { out += 'ъ'; i++; continue; }
      if (one[lc]) { out += c === lc ? one[lc] : one[lc].toUpperCase(); i++; continue; }
      out += c; i++;
    }
    return out;
  };
})();

let lang = 'ru';
try { lang = localStorage.getItem('dl_lang') || 'ru'; } catch {}
export const getLang = () => lang;
export function setLang(l) { lang = l; try { localStorage.setItem('dl_lang', l); } catch {} }
export function t(k, vars) {
  const e = S[k];
  let s = e ? (lang === 'ru' ? e[0] : lang === 'uzl' ? e[1] : lang === 'uzc' ? cyr(e[1]) : e[2]) : k;
  if (vars) for (const x in vars) s = s.replace('{' + x + '}', vars[x]);
  return s;
}
export function errText(e) {
  const c = (e && e.code) || '';
  if (S[c]) return t(c);
  if (c === 'offline') return t('offline');
  if (c === 'bad_login') return t('bad_login');
  return t('error_generic');
}
