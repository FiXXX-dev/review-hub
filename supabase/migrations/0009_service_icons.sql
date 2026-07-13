-- Векторные иконки услуг: в services.icon хранится ключ
-- (cleaning/towels/water/breakfast/laundry/late_checkout/broken/taxi/bell),
-- страница рендерит его lucide-иконкой. Эмодзи тоже поддерживаются,
-- но выглядят по-разному на разных телефонах.

update public.services set icon = 'cleaning'      where icon = '🧹';
update public.services set icon = 'towels'        where icon = '🛏️';
update public.services set icon = 'water'         where icon = '💧';
update public.services set icon = 'breakfast'     where icon = '☕';
update public.services set icon = 'laundry'       where icon = '👕';
update public.services set icon = 'late_checkout' where icon = '🕐';
update public.services set icon = 'broken'        where icon = '🔧';

-- Подпись блока услуг у отеля — «Обслуживание номера»
update public.presets
set blocks = (
  select jsonb_agg(
    case
      when b ->> 'type' = 'services'
        then b || '{"label_ru":"Обслуживание номера","label_uz":"Xona xizmati"}'::jsonb
      else b
    end
  )
  from jsonb_array_elements(blocks) as b
)
where key = 'hotel';
